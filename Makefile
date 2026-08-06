.PHONY: install dev build typecheck lint test up down logs migrate seed prisma

install:
	npm install

dev: ## Run api + web in watch mode (requires local postgres/redis or `make up`)
	npm run dev

build:
	npm run build

typecheck:
	npm run typecheck

lint:
	npm run lint

test:
	npm run test

migrate:
	npm run db:migrate

seed:
	npm run db:seed

prisma:
	npm run db:generate

up: ## One-command local start of the entire stack
	docker compose up --build -d
	@echo "── CreditOS ────────────────────────────────────────────"
	@echo "  Web UI      http://localhost:3000"
	@echo "  API docs    http://localhost:3001/docs"
	@echo "  MailHog     http://localhost:8025"
	@echo "  MinIO UI    http://localhost:9001"
	@echo "  Postgres    localhost:5432  Redis: localhost:6379"

down:
	docker compose down

logs:
	docker compose logs -f --tail=200
