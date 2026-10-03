from html.parser import HTMLParser

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
    class Assets(HTMLParser):
        def __init__(self) -> None:
            super().__init__()
            self.paths: list[str] = []

        def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
            attributes = dict(attrs)
            if tag == "script" and attributes.get("src"):
                self.paths.append(attributes["src"])
            if tag == "link" and attributes.get("rel") == "stylesheet":
                self.paths.append(attributes["href"])

    with TestClient(app) as client:
        homepage = client.get("/")
        assert homepage.status_code == 200
        assert '<div id="root">' in homepage.text
        assets = Assets()
        assets.feed(homepage.text)
        assert any(path.endswith(".js") for path in assets.paths)
        assert any(path.endswith(".css") for path in assets.paths)
        for path in assets.paths:
            response = client.get(path)
            assert response.status_code == 200
            assert response.content
        assert client.get("/src/main.tsx").status_code == 404
        assert client.get("/example/client-route").text == homepage.text
        assert client.get("/assets/missing.js").status_code == 404
        assert client.get("/api/unknown").status_code == 404
        assert client.get("/api/health").status_code == 200
