"""Poll checked GitHub deployment requests and deploy immutable Cedar releases."""

import argparse
import fcntl
import io
import json
import os
import re
import subprocess
import tarfile
import time
import urllib.error
import urllib.request
from pathlib import Path

REPOSITORY = "mameikagou/cedar"
ROOT = Path("/srv/cedar")
ORIGIN = "http://127.0.0.1:9483"
PUBLIC_URL = "https://frontend.mrlonely.top"
SHA_PATTERN = re.compile(r"[0-9a-f]{40}")
TERMINAL_STATES = {"success", "failure", "error", "inactive"}


class GitHubAPIError(RuntimeError):
    pass


def command(arguments: list[str], *, cwd: Path | None = None, data: str | None = None) -> str:
    result = subprocess.run(
        arguments, cwd=cwd, input=data, text=True, capture_output=True, timeout=180, check=False
    )
    if result.returncode:
        raise RuntimeError(f"Command failed: {Path(arguments[0]).name}")
    return result.stdout


def api(endpoint: str, body: dict | None = None):
    arguments = ["gh", "api", f"repos/{REPOSITORY}/{endpoint}"]
    if body is not None:
        arguments += ["--method", "POST", "--input", "-"]
    try:
        return json.loads(command(arguments, data=json.dumps(body) if body is not None else None))
    except (RuntimeError, subprocess.TimeoutExpired) as error:
        raise GitHubAPIError("GitHub API is unavailable; retry on next timer tick") from error


def authorize(deployment: dict, run: dict, jobs: list[dict], main_sha: str) -> None:
    if deployment.get("creator", {}).get("login") != "github-actions[bot]":
        raise ValueError("Deployment must originate from GitHub Actions")
    if not SHA_PATTERN.fullmatch(deployment.get("sha", "")):
        raise ValueError("Deployment requires a full commit SHA")
    if deployment["sha"] != main_sha:
        raise ValueError("Deployment is superseded")
    if (
        run.get("repository", {}).get("full_name") != REPOSITORY
        or run.get("path") != ".github/workflows/ci.yml"
        or run.get("head_branch") != "main"
        or run.get("head_sha") != deployment["sha"]
        or run.get("event") not in {"push", "workflow_dispatch"}
        or (run.get("status") == "completed" and run.get("conclusion") != "success")
    ):
        raise ValueError("Deployment does not match a trusted main workflow")
    if not any(job.get("name") == "check" and job.get("conclusion") == "success" for job in jobs):
        raise ValueError("CI checks have not succeeded")


def prepare_release(sha: str) -> Path:
    if not SHA_PATTERN.fullmatch(sha):
        raise ValueError("Invalid release commit")
    repository = ROOT / "repository.git"
    if not repository.exists():
        command(["git", "init", "--bare", str(repository)])
        command(
            [
                "git",
                f"--git-dir={repository}",
                "remote",
                "add",
                "origin",
                f"https://github.com/{REPOSITORY}.git",
            ]
        )
    existing = subprocess.run(
        ["git", f"--git-dir={repository}", "cat-file", "-e", f"{sha}^{{commit}}"],
        capture_output=True,
        timeout=10,
        check=False,
    )
    if existing.returncode:
        command(
            [
                "git",
                "-c",
                "http.lowSpeedLimit=1",
                "-c",
                "http.lowSpeedTime=20",
                f"--git-dir={repository}",
                "fetch",
                "--depth=1",
                "origin",
                sha,
            ]
        )
    release = ROOT / "releases" / sha
    release.mkdir(parents=True, exist_ok=True)
    if not (release / ".prepared").is_file():
        archive = subprocess.run(
            ["git", f"--git-dir={repository}", "archive", sha],
            capture_output=True,
            timeout=30,
            check=False,
        )
        if archive.returncode:
            raise RuntimeError("Unable to export release source")
        with tarfile.open(fileobj=io.BytesIO(archive.stdout)) as source:
            source.extractall(release, filter="data")
        command(
            [str(Path.home() / ".local/bin/uv"), "sync", "--frozen", "--no-dev"],
            cwd=release / "backend",
        )
        (release / ".cedar-revision").write_text(sha + "\n")
        (release / ".prepared").touch()
    return release


def restart_service() -> None:
    command(["sudo", "-n", "systemctl", "restart", "cedar.service"])


def wait_ready(sha: str, timeout: float = 30) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(f"{ORIGIN}/api/health", timeout=3) as response:
                health = json.load(response)
            with urllib.request.urlopen(f"{ORIGIN}/api/ready", timeout=3) as response:
                ready = json.load(response)
            with urllib.request.urlopen(f"{ORIGIN}/", timeout=3) as response:
                homepage = response.read().decode()
            if (
                health.get("revision") == sha
                and health.get("status") == "ok"
                and ready.get("database") == "connected"
                and "<title>Cedar</title>" in homepage
            ):
                return
        except (OSError, urllib.error.URLError, ValueError):
            pass
        time.sleep(1)
    raise RuntimeError("Release did not pass API, database and homepage health checks")


def switch_current(current: Path, target: Path) -> None:
    if current.exists() and not current.is_symlink():
        raise RuntimeError("Production current path must be a symlink")
    temporary = current.with_name(".current-new")
    temporary.unlink(missing_ok=True)
    temporary.symlink_to(target)
    os.replace(temporary, current)


def activate_release(release: Path, current: Path) -> None:
    previous = current.resolve() if current.is_symlink() else None
    switch_current(current, release)
    try:
        restart_service()
        wait_ready(release.name)
    except Exception:
        if previous is not None:
            switch_current(current, previous)
            restart_service()
            wait_ready(previous.name)
        else:
            command(["sudo", "-n", "systemctl", "stop", "cedar.service"])
            current.unlink(missing_ok=True)
        raise


def report(deployment: dict, state: str, description: str) -> None:
    run_id = deployment.get("payload", {}).get("run_id")
    api(
        f"deployments/{deployment['id']}/statuses",
        {
            "state": state,
            "description": description,
            "environment_url": PUBLIC_URL,
            "log_url": f"https://github.com/{REPOSITORY}/actions/runs/{run_id}",
            "auto_inactive": True,
        },
    )


def poll_once() -> None:
    deployments = api("deployments?environment=production&per_page=10")
    for deployment in reversed(deployments):
        payload = deployment.get("payload")
        if not isinstance(payload, dict) or payload.get("application") != "cedar":
            continue
        statuses = api(f"deployments/{deployment['id']}/statuses?per_page=1")
        if statuses and statuses[0]["state"] in TERMINAL_STATES:
            continue
        try:
            run_id = int(payload["run_id"])
            main_sha = api("git/ref/heads/main")["object"]["sha"]
            if deployment["sha"] != main_sha:
                report(deployment, "inactive", "Superseded by newer main commit")
                continue
            run = api(f"actions/runs/{run_id}")
            jobs = api(f"actions/runs/{run_id}/jobs")["jobs"]
            authorize(deployment, run, jobs, main_sha)
            report(deployment, "in_progress", "Preparing checked commit on production host")
            release = prepare_release(deployment["sha"])
            if api("git/ref/heads/main")["object"]["sha"] != deployment["sha"]:
                report(deployment, "inactive", "Superseded while preparing production release")
                continue
            activate_release(release, ROOT / "current")
            report(deployment, "success", "API, PostgreSQL and frontend health checks passed")
            print(f"Deployed {deployment['sha']}", flush=True)
        except GitHubAPIError:
            raise
        except Exception as error:
            report(deployment, "failure", f"Deployment failed: {type(error).__name__}")
            print(f"Deployment {deployment['id']} failed: {error}", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true")
    parser.parse_args()
    ROOT.mkdir(parents=True, exist_ok=True)
    with (ROOT / ".deploy.lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return
        poll_once()


if __name__ == "__main__":
    main()
