.PHONY: setup dev dev-backend dev-frontend build check

BUN ?= bun

setup:
	cd backend && uv sync --frozen
	cd frontend && $(BUN) install --frozen-lockfile

dev:
	BUN="$(BUN)" python3 scripts/dev.py

dev-backend:
	cd backend && uv run --frozen uvicorn cedar_api.main:app --reload --host 127.0.0.1 --port 8000

dev-frontend:
	cd frontend && $(BUN) run dev

build:
	cd frontend && $(BUN) run build

check:
	cd frontend && $(BUN) run typecheck
	cd frontend && $(BUN) run lint
	$(MAKE) build
	cd backend && uv run --frozen ruff check .
	cd backend && uv run --frozen ruff format --check .
	cd backend && uv run --frozen ruff check ../scripts
	cd backend && uv run --frozen ruff format --check ../scripts
	cd backend && uv run --frozen pytest
