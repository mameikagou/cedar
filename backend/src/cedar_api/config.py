import os
from pathlib import Path

from dotenv import dotenv_values


def database_url() -> str | None:
    """Environment variables override private runtime config and local .env."""
    if "CEDAR_DATABASE_URL" in os.environ:
        return os.environ["CEDAR_DATABASE_URL"] or None
    runtime_file = Path(
        os.environ.get("CEDAR_ENV_FILE", "~/.config/cedar/runtime.env")
    ).expanduser()
    local_file = Path(__file__).resolve().parents[2] / ".env"
    for path in (local_file, runtime_file):
        if path.is_file():
            value = dotenv_values(path).get("CEDAR_DATABASE_URL")
            if value:
                return value
    return None


def frontend_directory() -> Path:
    default = Path(__file__).resolve().parents[3] / "frontend"
    return Path(os.environ.get("CEDAR_WEB_DIR", str(default))).expanduser()


def revision() -> str:
    revision_file = Path(__file__).resolve().parents[3] / ".cedar-revision"
    return revision_file.read_text().strip() if revision_file.is_file() else "development"
