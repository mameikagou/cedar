"""Run the API and Rspack together; stop both on exit or a child failure."""

import os
import signal
import subprocess
import time
from pathlib import Path


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    processes: list[subprocess.Popen] = []

    def interrupted(_signum, _frame):
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, interrupted)
    try:
        for directory, arguments in (
            (
                "backend",
                [
                    "uv",
                    "run",
                    "--frozen",
                    "uvicorn",
                    "cedar_api.main:app",
                    "--reload",
                    "--host",
                    "127.0.0.1",
                    "--port",
                    "8000",
                ],
            ),
            ("frontend", [os.environ.get("BUN", "bun"), "run", "dev"]),
        ):
            processes.append(
                subprocess.Popen(arguments, cwd=root / directory, start_new_session=True)
            )
        print("Cedar: http://127.0.0.1:3000 · API docs: http://127.0.0.1:8000/docs", flush=True)
        while all(process.poll() is None for process in processes):
            time.sleep(0.2)
        return next(process.returncode or 1 for process in processes if process.poll() is not None)
    except KeyboardInterrupt:
        return 0
    finally:
        for process in processes:
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGTERM)
        for process in processes:
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()


if __name__ == "__main__":
    raise SystemExit(main())
