from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import psycopg
from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from psycopg_pool import AsyncConnectionPool, PoolTimeout
from pydantic import BaseModel

from cedar_api.config import database_url, frontend_directory, revision


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncIterator[None]:
    dsn = database_url()
    if not dsn:
        application.state.db_pool = None
        yield
        return
    async with AsyncConnectionPool(
        dsn,
        min_size=1,
        max_size=5,
        open=False,
        timeout=3,
        kwargs={"connect_timeout": 5, "options": "-c statement_timeout=5000"},
        check=AsyncConnectionPool.check_connection,
    ) as pool:
        await pool.wait(timeout=10)
        application.state.db_pool = pool
        yield


app = FastAPI(title="Cedar API", version="0.1.0", lifespan=lifespan)


class HealthResponse(BaseModel):
    status: str
    service: str
    revision: str


@app.get("/api/health", response_model=HealthResponse, tags=["health"])
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="cedar-api", revision=revision())


@app.get("/api/ready", tags=["health"])
async def ready(request: Request) -> dict[str, str]:
    pool = request.app.state.db_pool
    if pool is None:
        raise HTTPException(status_code=503, detail="Database is not configured")
    try:
        async with pool.connection() as connection:
            await connection.execute("SELECT 1")
    except (psycopg.Error, PoolTimeout):
        raise HTTPException(status_code=503, detail="Database is unavailable") from None
    return {"status": "ok", "database": "connected"}


web_directory = frontend_directory()
if web_directory.is_dir():
    app.mount("/", StaticFiles(directory=web_directory, html=True), name="frontend")
