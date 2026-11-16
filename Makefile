.PHONY: install migrate backend frontend test build docker

install:
	python3 -m pip install -r backend/requirements.txt -r backend/requirements-dev.txt
	cd frontend && npm install

migrate:
	cd backend && alembic upgrade head

backend:
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

frontend:
	cd frontend && npm run dev

test:
	cd backend && pytest

e2e:
	cd frontend && npm run test:e2e

e2e-live:
	cd frontend && E2E_LIVE=1 npm run test:e2e:live

build:
	cd frontend && npm run build

docker:
	docker compose up --build
