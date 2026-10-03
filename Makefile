.PHONY: setup dev check

setup:
	cd backend && uv sync --frozen

dev:
	cd backend && uv run --frozen uvicorn cedar_api.main:app --reload --reload-dir src --reload-dir ../frontend --host 127.0.0.1 --port 8000

check:
	cd backend && uv run --frozen ruff check .
	cd backend && uv run --frozen ruff format --check .
	cd backend && uv run --frozen ruff check ../scripts
	cd backend && uv run --frozen ruff format --check ../scripts
	cd backend && uv run --frozen pytest
	node --check frontend/app.js
	node --check frontend/api/client.js
	node --check frontend/components/status-card.js
	node --check frontend/pages/home.js
