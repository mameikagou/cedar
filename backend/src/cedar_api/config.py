import os
from pathlib import Path

from dotenv import dotenv_values


def runtime_value(key: str) -> str | None:
    """Environment variables override private runtime config and local .env."""
    if key in os.environ:
        return os.environ[key] or None
    runtime_file = Path(
        os.environ.get("CEDAR_ENV_FILE", "~/.config/cedar/runtime.env")
    ).expanduser()
    local_file = Path(__file__).resolve().parents[2] / ".env"
    for path in (local_file, runtime_file):
        if path.is_file():
            value = dotenv_values(path).get(key)
            if value:
                return value
    return None


def database_url() -> str | None:
    return runtime_value("CEDAR_DATABASE_URL")


def frontend_directory() -> Path:
    default = Path(__file__).resolve().parents[3] / "frontend" / "dist"
    return Path(os.environ.get("CEDAR_WEB_DIR", str(default))).expanduser()


def revision() -> str:
    revision_file = Path(__file__).resolve().parents[3] / ".cedar-revision"
    return revision_file.read_text().strip() if revision_file.is_file() else "development"
