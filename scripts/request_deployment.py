"""Request production deployment from Actions and wait for origin health checks."""

import json
import os
import subprocess
import time


def api(endpoint: str, body: dict | None = None):
    command = ["gh", "api", endpoint]
    if body is not None:
        command += ["--method", "POST", "--input", "-"]
    result = subprocess.run(
        command,
        input=json.dumps(body) if body is not None else None,
        text=True,
        capture_output=True,
        timeout=40,
        check=False,
    )
    if result.returncode:
        raise RuntimeError("GitHub deployment API request failed")
    return json.loads(result.stdout)


def main() -> None:
    repository = os.environ["GITHUB_REPOSITORY"]
    deployment = api(
        f"repos/{repository}/deployments",
        {
            "ref": os.environ["GITHUB_SHA"],
            "auto_merge": False,
            "required_contexts": [],
            "environment": "production",
            "production_environment": True,
            "payload": {"application": "cedar", "run_id": int(os.environ["GITHUB_RUN_ID"])},
            "description": "Deploy checked main commit to cedar.mrlonely.top",
        },
    )
    endpoint = f"repos/{repository}/deployments/{deployment['id']}/statuses"
    print(f"Deployment requested: {deployment['id']}", flush=True)
    deadline = time.monotonic() + 600
    previous_state = None
    while time.monotonic() < deadline:
        try:
            statuses = api(endpoint)
        except (RuntimeError, subprocess.TimeoutExpired):
            time.sleep(10)
            continue
        state = statuses[0]["state"] if statuses else "queued"
        if state != previous_state:
            print(f"Deployment: {state}", flush=True)
            previous_state = state
        if state == "success":
            print("Cedar deployed: https://cedar.mrlonely.top", flush=True)
            return
        if state == "inactive":
            print("Deployment superseded by newer main commit", flush=True)
            return
        if state in {"failure", "error"}:
            raise SystemExit("Production deployment failed; see deployment status")
        time.sleep(10)
    api(endpoint, {"state": "error", "description": "Timed out waiting for production deployment"})
    raise SystemExit("Production deployment timed out")


if __name__ == "__main__":
    main()
