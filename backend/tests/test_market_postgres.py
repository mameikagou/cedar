"""Opt-in PostgreSQL atomicity test, confined to session-local temporary tables."""

import os
from datetime import UTC, date, datetime
from uuid import uuid4

import psycopg
import pytest

from cedar_api.import_market import LakeVersion, persist
from cedar_api.market import Candle


@pytest.mark.skipif(not os.environ.get("CEDAR_TEST_DATABASE_URL"), reason="Local PostgreSQL opt-in")
def test_import_rollback_and_symbol_isolation():
    with psycopg.connect(os.environ["CEDAR_TEST_DATABASE_URL"], autocommit=True) as connection:
        connection.execute(
            "CREATE TEMP TABLE market_daily (LIKE public.market_daily INCLUDING ALL)"
        )
        connection.execute("CREATE TEMP TABLE market_sync (LIKE public.market_sync INCLUDING ALL)")
        connection.execute("ALTER TABLE pg_temp.market_daily ADD CHECK (close > 0)")
        connection.execute("SET search_path TO pg_temp")
        now = datetime.now(UTC)
        old_version = LakeVersion(uuid4(), "a" * 64, now, 1, ())
        new_version = LakeVersion(uuid4(), "b" * 64, now, 1, ())
        candle = Candle(
            time=date(2026, 9, 18),
            open=4.5,
            high=4.72,
            low=4.41,
            close=4.64,
            pre_close=4.6,
            pct_change=0.8696,
            volume=225824688,
            amount=1035666813,
        )
        persist(connection, old_version, [candle])
        connection.execute(
            "INSERT INTO market_daily SELECT 'OTHER', trade_date, open, high, low, close, "
            "pre_close, pct_change, volume, amount FROM market_daily WHERE symbol='601975.SH'"
        )
        before = connection.execute("SELECT * FROM market_daily ORDER BY symbol").fetchall()
        provenance = connection.execute("SELECT * FROM market_sync").fetchall()
        with pytest.raises(psycopg.errors.CheckViolation):
            persist(connection, new_version, [candle.model_copy(update={"close": -1})])
        assert connection.execute("SELECT * FROM market_daily ORDER BY symbol").fetchall() == before
        assert connection.execute("SELECT * FROM market_sync").fetchall() == provenance
        persist(connection, new_version, [candle.model_copy(update={"close": 4.65})])
        assert connection.execute(
            "SELECT close FROM market_daily WHERE symbol='OTHER'"
        ).fetchone() == (4.64,)
        assert connection.execute("SELECT source_version FROM market_sync").fetchone() == (
            new_version.version_id,
        )
        assert connection.execute(
            "SELECT close FROM market_daily WHERE symbol='601975.SH'"
        ).fetchone() == (4.65,)
