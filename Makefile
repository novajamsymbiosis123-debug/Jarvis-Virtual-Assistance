.PHONY: help up down build logs test

help:
	@echo "Usage:"
	@echo "  make up           Start all services"
	@echo "  make down         Stop all services"
	@echo "  make build        Rebuild containers"
	@echo "  make logs         Tail all logs"
	@echo "  make test         Run backend tests"
	@echo "  make dev-backend  Run backend locally"
	@echo "  make dev-frontend Run frontend locally"

up:
	docker-compose up -d

down:
	docker-compose down

build:
	docker-compose build --no-cache

logs:
	docker-compose logs -f

logs-backend:
	docker-compose logs -f backend

test:
	cd backend && pytest tests/ -v

dev-backend:
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev-frontend:
	cd frontend && npm run dev

clean:
	docker-compose down -v
	docker system prune -f
