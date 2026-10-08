"""Separate lake → product database importer; never invoked by an HTTP request."""

import argparse
import hashlib
import logging
import os
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from uuid import UUID

import psycopg
import pyarrow.compute as pc
import pyarrow.parquet as pq
from pydantic import ValidationError

from cedar_api.config import database_url, runtime_value
from cedar_api.market import COLUMNS, SCHEMA_STATEMENTS, SYMBOL, Candle, MarketDataError

DATASET = "a_share.daily_1d"
IMPORTER_VERSION = 1
LOCK_KEY = 0x4345444152  # CEDAR, scoped to its own database.
SOURCE_COLUMNS = (
    "ts_code",
    "trade_date",
    "open",
    "high",
    "low",
    "close",
    "pre_close",
    "pct_chg",
    "volume",
    "amount",
    "source",
)


@dataclass(frozen=True)
class LakeObject:
    relative_path: str
    content_hash: str
    byte_count: int
    row_count: int


@dataclass(frozen=True)
class LakeVersion:
    version_id: UUID
    content_hash: str
    published_at: datetime
    row_count: int
    objects: tuple[LakeObject, ...]


def resolve_version(reader_dsn: str) -> LakeVersion:
    with psycopg.connect(
        reader_dsn,
        connect_timeout=5,
        options="-c default_transaction_read_only=on -c statement_timeout=10000",
    ) as connection:
        connection.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY")
        row = connection.execute(
            "SELECT version_id, content_hash, published_at, row_count, contract_version "
            "FROM api.dataset_current WHERE dataset_key = %s",
            (DATASET,),
        ).fetchone()
        if not row or row[4] not in (3, 4):
            raise MarketDataError("数据湖日线缺失或合同版本尚未支持。")
        objects = connection.execute(
            "SELECT relative_path, object_content_hash, object_byte_count, object_row_count, "
            "version_status, physical_status FROM api.dataset_version_objects "
            "WHERE dataset_key = %s AND version_id = %s ORDER BY ordinal",
            (DATASET, row[0]),
        ).fetchall()
    if not objects or any(o[4] != "available" or o[5] != "available" for o in objects):
        raise MarketDataError("数据湖版本包含不可用对象。")
    if sum(o[3] for o in objects) != row[3]:
        raise MarketDataError("数据湖对象行数与发布版本不一致。")
    if len({o[0] for o in objects}) != len(objects):
        raise MarketDataError("数据湖版本包含重复对象。")
    return LakeVersion(row[0], row[1], row[2], row[3], tuple(LakeObject(*o[:4]) for o in objects))


def object_path(root: Path, relative_path: str) -> Path:
    root = root.resolve(strict=True)
    path = (root / relative_path).resolve(strict=True)
    if not path.is_relative_to(root) or path.suffix != ".parquet":
        raise MarketDataError("数据湖对象路径越界或类型错误。")
    return path


def normalize_rows(rows: list[dict]) -> list[Candle]:
    """Contract v3/v4 retains Tushare units: hands and thousand CNY."""
    candles = []
    try:
        for row in rows:
            if row["ts_code"] != SYMBOL or row["source"] != "tushare.daily":
                raise MarketDataError("证券代码或行情单位来源合同不匹配。")
            reference = row["pre_close"]
            candles.append(
                Candle(
                    time=row["trade_date"],
                    open=row["open"],
                    high=row["high"],
                    low=row["low"],
                    close=row["close"],
                    pre_close=reference if reference is not None and reference != 0 else None,
                    pct_change=row["pct_chg"],
                    volume=float(Decimal(str(row["volume"])) * 100),
                    amount=None
                    if row["amount"] is None
                    else float(Decimal(str(row["amount"])) * 1000),
                )
            )
    except (KeyError, TypeError, ValueError, ValidationError, ArithmeticError):
        raise MarketDataError("数据湖行情字段校验失败。") from None
    candles.sort(key=lambda c: c.time)
    if not candles or len({c.time for c in candles}) != len(candles):
        raise MarketDataError("数据湖中该股行情为空或含重复日期。")
    return candles


def read_candles(version: LakeVersion, root: Path) -> list[Candle]:
    rows = []
    for obj in version.objects:
        path = object_path(root, obj.relative_path)
        # Hash and decode one opened file, avoiding replaced-path inconsistencies.
        with path.open("rb") as source:
            if os.fstat(source.fileno()).st_size != obj.byte_count:
                raise MarketDataError("数据湖对象大小与登记值不一致。")
            if hashlib.file_digest(source, "sha256").hexdigest() != obj.content_hash:
                raise MarketDataError("数据湖对象校验和不匹配。")
            source.seek(0)
            parquet = pq.ParquetFile(source)
            if parquet.metadata.num_rows != obj.row_count:
                raise MarketDataError("数据湖对象行数校验失败。")
            if not set(SOURCE_COLUMNS).issubset(parquet.schema_arrow.names):
                raise MarketDataError("数据湖行情对象字段不完整。")
            table = parquet.read(columns=list(SOURCE_COLUMNS))
            rows.extend(table.filter(pc.equal(table["ts_code"], SYMBOL)).to_pylist())
    return normalize_rows(rows)


def persist(connection: psycopg.Connection, version: LakeVersion, candles: list[Candle]) -> None:
    """Replace only this instrument; candles and provenance commit together."""
    if not candles:
        raise MarketDataError("拒绝用空行情替换现有数据。")
    now = datetime.now(UTC)
    with connection.transaction():
        connection.execute("DELETE FROM market_daily WHERE symbol = %s", (SYMBOL,))
        with connection.cursor() as cursor:
            cursor.executemany(
                f"INSERT INTO market_daily (symbol, {COLUMNS}) VALUES "
                "(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                [
                    (
                        SYMBOL,
                        c.time,
                        c.open,
                        c.high,
                        c.low,
                        c.close,
                        c.pre_close,
                        c.pct_change,
                        c.volume,
                        c.amount,
                    )
                    for c in candles
                ],
            )
        connection.execute(
            "INSERT INTO market_sync (symbol, fetched_at, source_dataset, source_version, "
            "source_hash, source_published_at, checked_at, importer_version) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (symbol) DO UPDATE SET "
            "fetched_at=EXCLUDED.fetched_at, source_dataset=EXCLUDED.source_dataset, "
            "source_version=EXCLUDED.source_version, source_hash=EXCLUDED.source_hash, "
            "source_published_at=EXCLUDED.source_published_at, checked_at=EXCLUDED.checked_at, "
            "importer_version=EXCLUDED.importer_version",
            (
                SYMBOL,
                now,
                DATASET,
                version.version_id,
                version.content_hash,
                version.published_at,
                now,
                IMPORTER_VERSION,
            ),
        )


def sync_market(*, force: bool = False) -> dict:
    target_dsn = database_url()
    reader_dsn = runtime_value("CEDAR_LAKE_READER_DATABASE_URL")
    root = Path(runtime_value("CEDAR_LAKE_ROOT") or "/srv/qrant-data/datasets")
    if not target_dsn or not reader_dsn:
        raise MarketDataError("行情导入的 Cedar 数据库或数据湖只读入口尚未配置。")
    with psycopg.connect(target_dsn, autocommit=True, connect_timeout=5) as connection:
        if connection.execute("SELECT current_database()").fetchone()[0] != "cedar":
            raise MarketDataError("目标不是 Cedar 数据库，拒绝写入。")
        if not connection.execute("SELECT pg_try_advisory_lock(%s)", (LOCK_KEY,)).fetchone()[0]:
            return {"status": "busy"}
        try:
            with connection.transaction():
                for statement in SCHEMA_STATEMENTS:
                    connection.execute(statement)
            version = resolve_version(reader_dsn)
            existing = connection.execute(
                "SELECT source_version, source_hash, importer_version FROM market_sync "
                "WHERE symbol = %s",
                (SYMBOL,),
            ).fetchone()
            if not force and existing == (
                version.version_id,
                version.content_hash,
                IMPORTER_VERSION,
            ):
                connection.execute(
                    "UPDATE market_sync SET checked_at=%s WHERE symbol=%s",
                    (datetime.now(UTC), SYMBOL),
                )
                return {
                    "status": "unchanged",
                    "symbol": SYMBOL,
                    "sourceVersion": str(version.version_id),
                }
            candles = read_candles(version, root)
            persist(connection, version, candles)
            return {
                "status": "imported",
                "symbol": SYMBOL,
                "bars": len(candles),
                "firstTradingDate": str(candles[0].time),
                "latestTradingDate": str(candles[-1].time),
                "sourceVersion": str(version.version_id),
            }
        finally:
            connection.execute("SELECT pg_advisory_unlock(%s)", (LOCK_KEY,))


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Import published lake OHLCV into Cedar PostgreSQL"
    )
    parser.add_argument(
        "--force", action="store_true", help="Rebuild even if the source is unchanged"
    )
    args = parser.parse_args()
    try:
        print(sync_market(force=args.force))
    except Exception as error:
        # Do not emit database DSNs, file paths or provider errors to service logs.
        logging.error(
            "Cedar market import failed (%s); previous snapshot retained", type(error).__name__
        )
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
