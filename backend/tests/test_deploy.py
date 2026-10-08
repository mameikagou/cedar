import importlib.util
from pathlib import Path

import pytest

script = Path(__file__).resolve().parents[2] / "scripts/deploy_agent.py"
spec = importlib.util.spec_from_file_location("cedar_deploy_agent", script)
assert spec is not None and spec.loader is not None
agent = importlib.util.module_from_spec(spec)
spec.loader.exec_module(agent)


def test_failed_release_restores_and_checks_previous_release(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    previous = tmp_path / ("a" * 40)
    release = tmp_path / ("b" * 40)
    previous.mkdir()
    release.mkdir()
    current = tmp_path / "current"
    current.symlink_to(previous)
    restarts = []
    checked = []
    monkeypatch.setattr(agent, "restart_service", lambda: restarts.append(current.resolve()))

    def check_ready(sha: str) -> None:
        checked.append(sha)
        if sha == release.name:
            raise RuntimeError("Database readiness failed")

    monkeypatch.setattr(agent, "wait_ready", check_ready)
    with pytest.raises(RuntimeError, match="Database readiness failed"):
        agent.activate_release(release, current)
    assert current.resolve() == previous
    assert restarts == [release, previous]
    assert checked == [release.name, previous.name]


@pytest.mark.parametrize("invalid_case", ["fork", "failed_checks", "pull_request", "stale_sha"])
def test_deployment_rejects_untrusted_or_unchecked_commits(invalid_case: str) -> None:
    sha = "a" * 40
    deployment = {"sha": sha, "creator": {"login": "github-actions[bot]"}}
    run = {
        "repository": {"full_name": "mameikagou/cedar"},
        "path": ".github/workflows/ci.yml",
        "head_branch": "main",
        "head_sha": sha,
        "event": "push",
        "status": "in_progress",
    }
    jobs = [{"name": "check", "conclusion": "success"}]
    main_sha = sha
    if invalid_case == "fork":
        run["repository"] = {"full_name": "someone/cedar"}
    elif invalid_case == "failed_checks":
        jobs[0]["conclusion"] = "failure"
    elif invalid_case == "pull_request":
        run["event"] = "pull_request"
    else:
        main_sha = "b" * 40
    with pytest.raises(ValueError):
        agent.authorize(deployment, run, jobs, main_sha)


@pytest.mark.parametrize("case", ["valid", "no_bars", "wrong_source", "date_mismatch"])
def test_market_health_requires_imported_product_snapshot(monkeypatch, case):
    import io
    import json

    snapshot = {
        "symbol": "601975.SH",
        "sourceDataset": "a_share.daily_1d",
        "sourceVersion": "source-version",
        "syncedAt": "2026-10-08T15:00:00Z",
        "volumeUnit": "share",
        "amountUnit": "CNY",
        "latestTradingDate": "2026-09-18",
        "candles": [{"time": "2026-09-18"}],
    }
    if case == "no_bars":
        snapshot["candles"] = []
    elif case == "wrong_source":
        snapshot["sourceDataset"] = "direct-provider"
    elif case == "date_mismatch":
        snapshot["latestTradingDate"] = "2026-10-08"
    monkeypatch.setattr(
        agent.urllib.request,
        "urlopen",
        lambda *args, **kwargs: io.BytesIO(json.dumps(snapshot).encode()),
    )
    assert agent.check_market_snapshot() is (case == "valid")
