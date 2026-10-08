import asyncio
import hashlib
from datetime import UTC, date, datetime
from pathlib import Path
from uuid import uuid4

import pyarrow as pa
import pyarrow.parquet as pq
import pytest
from fastapi.testclient import TestClient

from cedar_api import import_market
from cedar_api.import_market import (
    LakeObject,
    LakeVersion,
    normalize_rows,
    object_path,
    read_candles,
)
from cedar_api.main import app
from cedar_api.market import Candle, MarketDataError, MarketService


def source_row():
    return dict(
        ts_code="601975.SH",
        trade_date=date(2026, 9, 18),
        open=4.5,
        high=4.72,
        low=4.41,
        close=4.64,
        pre_close=4.6,
        pct_chg=0.8696,
        volume=2258246.88,
        amount=1035666.813,
        source="tushare.daily",
    )


def test_product_units_and_nullable_reference_are_not_invented():
    row = source_row()
    candle = normalize_rows([row])[0]
    assert candle.volume == 225824688
    assert candle.amount == 1035666813
    assert candle.model_dump(mode="json", by_alias=True)["preClose"] == 4.6
    row.update(pre_close=0, pct_chg=None, amount=None)
    missing = normalize_rows([row])[0]
    assert missing.pre_close is None
    assert missing.pct_change is None
    assert missing.amount is None


@pytest.mark.parametrize(
    "case", ["wrong_symbol", "wrong_source", "duplicate", "bad_ohlc", "nan", "empty"]
)
def test_invalid_lake_rows_are_rejected(case):
    rows = [source_row()]
    if case == "wrong_symbol":
        rows[0]["ts_code"] = "000001.SZ"
    elif case == "wrong_source":
        rows[0]["source"] = "unknown-units"
    elif case == "duplicate":
        rows.append(rows[0].copy())
    elif case == "bad_ohlc":
        rows[0]["high"] = 4.4
    elif case == "nan":
        rows[0]["volume"] = float("nan")
    else:
        rows.clear()
    with pytest.raises(MarketDataError):
        normalize_rows(rows)


def version_for(path: Path):
    obj = LakeObject(
        path.name, hashlib.sha256(path.read_bytes()).hexdigest(), path.stat().st_size, 2
    )
    return LakeVersion(uuid4(), "a" * 64, datetime.now(UTC), 2, (obj,))


def test_registered_parquet_is_verified_and_only_requested_symbol_is_imported(tmp_path):
    other = source_row() | {"ts_code": "000001.SZ"}
    path = tmp_path / "daily.parquet"
    pq.write_table(pa.Table.from_pylist([source_row(), other]), path)
    version = version_for(path)
    assert len(read_candles(version, tmp_path)) == 1
    data = bytearray(path.read_bytes())
    data[10] ^= 1  # same size; the hash must catch corruption before decoding
    path.write_bytes(data)
    with pytest.raises(MarketDataError, match="校验和"):
        read_candles(version, tmp_path)


def test_registered_path_cannot_escape_root_by_symlink(tmp_path):
    outside = tmp_path / "outside.parquet"
    outside.touch()
    root = tmp_path / "root"
    root.mkdir()
    (root / "alias.parquet").symlink_to(outside)
    with pytest.raises(MarketDataError, match="越界"):
        object_path(root, "alias.parquet")


class Result:
    def __init__(self, rows):
        self.rows = rows

    async def fetchone(self):
        return self.rows

    async def fetchall(self):
        return self.rows


class Connection:
    def __init__(self, metadata):
        self.metadata = metadata
        self.queries = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass

    def transaction(self):
        return self

    async def execute(self, query, params=None):
        self.queries.append(query)
        if "FROM market_sync" in query:
            return Result(self.metadata)
        if "FROM market_daily" in query:
            return Result(
                [(date(2026, 9, 18), 4.5, 4.72, 4.41, 4.64, 4.6, 0.8696, 225824688, 1035666813)]
            )
        return Result(None)

    def connection(self):
        return self


def test_http_market_reads_only_product_database(monkeypatch):
    now = datetime.now(UTC)
    db = Connection((now, "a_share.daily_1d", uuid4(), now, now))
    monkeypatch.setattr(import_market, "read_candles", lambda *_: pytest.fail("API read lake"))
    monkeypatch.setattr(
        import_market, "resolve_version", lambda *_: pytest.fail("API queried source")
    )
    result = asyncio.run(MarketService(db).snapshot())
    assert result.source == "analyze2quant 数据湖"
    assert result.candles[-1].volume == 225824688
    assert "READ ONLY" in db.queries[0]
    assert all("api.dataset" not in query for query in db.queries)
    assert result.model_dump(mode="json", by_alias=True)["syncedAt"]


def test_missing_database_data_never_triggers_import():
    with pytest.raises(MarketDataError, match="尚未导入"):
        asyncio.run(MarketService(Connection(None)).snapshot())


def test_api_missing_configuration_is_explicit(monkeypatch):
    monkeypatch.setenv("CEDAR_DATABASE_URL", "")
    with TestClient(app) as client:
        response = client.get("/api/market/kline")
    assert response.status_code == 503
    assert "数据库尚未配置" in response.json()["detail"]


def test_ohlcv_rejects_non_finite_price():
    with pytest.raises(ValueError):
        Candle(time="2026-09-18", open=float("inf"), high=5, low=4, close=4.6, volume=1)
