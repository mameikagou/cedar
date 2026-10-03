import pytest
from fastapi.testclient import TestClient

from cedar_api.main import app


@pytest.fixture(autouse=True)
def isolate_database(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CEDAR_DATABASE_URL", "")


def test_health_contract() -> None:
    with TestClient(app) as client:
        response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "cedar-api", "revision": "development"}


def test_openapi_exposes_health_endpoint() -> None:
    with TestClient(app) as client:
        response = client.get("/openapi.json")
    assert response.status_code == 200
    assert "/api/health" in response.json()["paths"]


def test_readiness_without_database() -> None:
    with TestClient(app) as client:
        response = client.get("/api/ready")
    assert response.status_code == 503
    assert response.json() == {"detail": "Database is not configured"}


def test_frontend_assets_and_api_share_origin() -> None:
    with TestClient(app) as client:
        assert "Cedar" in client.get("/").text
        assert client.get("/app.js").status_code == 200
        assert client.get("/styles.css").status_code == 200
        for path in ("/api/client.js", "/components/status-card.js", "/pages/home.js"):
            assert client.get(path).status_code == 200
        assert client.get("/api/health").status_code == 200
