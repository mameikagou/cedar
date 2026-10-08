"""Product-facing OHLCV contracts and reads from Cedar PostgreSQL only."""

from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from psycopg_pool import AsyncConnectionPool
from pydantic import BaseModel, ConfigDict, Field, model_validator

SYMBOL = "601975.SH"
COLUMNS = "trade_date, open, high, low, close, pre_close, pct_change, volume, amount"
# Shared by API startup and the separate importer. No lake access here.
SCHEMA_STATEMENTS = (
    """CREATE TABLE IF NOT EXISTS market_daily (
        symbol TEXT NOT NULL, trade_date DATE NOT NULL,
        open DOUBLE PRECISION NOT NULL CHECK (open > 0),
        high DOUBLE PRECISION NOT NULL CHECK (high > 0),
        low DOUBLE PRECISION NOT NULL CHECK (low > 0),
        close DOUBLE PRECISION NOT NULL CHECK (close > 0),
        pre_close DOUBLE PRECISION, pct_change DOUBLE PRECISION,
        volume DOUBLE PRECISION NOT NULL CHECK (volume >= 0),
        amount DOUBLE PRECISION CHECK (amount >= 0),
        PRIMARY KEY (symbol, trade_date)
    )""",
    "ALTER TABLE market_daily ALTER COLUMN pre_close DROP NOT NULL",
    "ALTER TABLE market_daily ALTER COLUMN pct_change DROP NOT NULL",
    "ALTER TABLE market_daily ALTER COLUMN amount DROP NOT NULL",
    """CREATE TABLE IF NOT EXISTS market_sync (
        symbol TEXT PRIMARY KEY, fetched_at TIMESTAMPTZ NOT NULL
    )""",
    "ALTER TABLE market_sync ADD COLUMN IF NOT EXISTS source_dataset TEXT",
    "ALTER TABLE market_sync ADD COLUMN IF NOT EXISTS source_version UUID",
    "ALTER TABLE market_sync ADD COLUMN IF NOT EXISTS source_hash TEXT",
    "ALTER TABLE market_sync ADD COLUMN IF NOT EXISTS source_published_at TIMESTAMPTZ",
    "ALTER TABLE market_sync ADD COLUMN IF NOT EXISTS checked_at TIMESTAMPTZ",
    "ALTER TABLE market_sync ADD COLUMN IF NOT EXISTS importer_version INTEGER",
)


class MarketDataError(Exception):
    pass


class Candle(BaseModel):
    model_config = ConfigDict(populate_by_name=True, allow_inf_nan=False)
    time: date
    open: float = Field(gt=0)
    high: float = Field(gt=0)
    low: float = Field(gt=0)
    close: float = Field(gt=0)
    pre_close: float | None = Field(default=None, gt=0, alias="preClose")
    pct_change: float | None = Field(default=None, alias="pctChange")
    volume: float = Field(ge=0)
    amount: float | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def check_prices(self):
        if self.low > min(self.open, self.close) or self.high < max(self.open, self.close):
            raise ValueError("Invalid OHLC bounds")
        return self


class MarketSnapshot(BaseModel):
    symbol: str = SYMBOL
    name: str = "招商南油"
    source: str = "analyze2quant 数据湖"
    sourceDataset: str
    sourceVersion: str
    sourcePublishedAt: datetime
    adjustment: str = "none"
    currency: str = "CNY"
    volumeUnit: str = "share"
    amountUnit: str = "CNY"
    syncedAt: datetime
    latestTradingDate: date
    stale: bool
    candles: list[Candle]


async def initialize_market(pool: AsyncConnectionPool) -> None:
    async with pool.connection() as connection:
        for statement in SCHEMA_STATEMENTS:
            await connection.execute(statement)


class MarketService:
    def __init__(self, pool: AsyncConnectionPool):
        self.pool = pool

    async def snapshot(self) -> MarketSnapshot:
        async with self.pool.connection() as connection:
            async with connection.transaction():
                await connection.execute(
                    "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY"
                )
                metadata = await (
                    await connection.execute(
                        "SELECT fetched_at, source_dataset, source_version, "
                        "source_published_at, checked_at FROM market_sync "
                        "WHERE symbol = %s AND source_version IS NOT NULL",
                        (SYMBOL,),
                    )
                ).fetchone()
                if not metadata:
                    raise MarketDataError("招商南油行情尚未导入 Cedar 数据库，请运行行情导入任务。")
                rows = await (
                    await connection.execute(
                        f"SELECT {COLUMNS} FROM market_daily WHERE symbol = %s ORDER BY trade_date",
                        (SYMBOL,),
                    )
                ).fetchall()
        if not rows:
            raise MarketDataError("Cedar 数据库中缺少招商南油日线。")
        keys = [
            "time",
            "open",
            "high",
            "low",
            "close",
            "pre_close",
            "pct_change",
            "volume",
            "amount",
        ]
        candles = [Candle(**dict(zip(keys, row, strict=True))) for row in rows]
        now = datetime.now(UTC)
        last_day = candles[-1].time
        # A conservative historical-data notice, not a trading-calendar claim.
        old_history = (now.astimezone(ZoneInfo("Asia/Shanghai")).date() - last_day).days > 7
        unchecked = metadata[4] is None or now - metadata[4] > timedelta(hours=1)
        return MarketSnapshot(
            syncedAt=metadata[0],
            sourceDataset=metadata[1],
            sourceVersion=str(metadata[2]),
            sourcePublishedAt=metadata[3],
            latestTradingDate=last_day,
            stale=old_history or unchecked,
            candles=candles,
        )
