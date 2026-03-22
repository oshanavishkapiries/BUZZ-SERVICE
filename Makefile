.PHONY: help build run test clean docker-up docker-down docker-logs lint fmt

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

build: ## Build the application
	go build -o bin/buzz-service ./cmd/server

run: ## Run the application
	go run ./cmd/server/main.go

test: ## Run tests
	go test -v ./...

clean: ## Clean build artifacts
	rm -rf bin/

docker-up: ## Start docker containers
	docker-compose up -d

docker-down: ## Stop docker containers
	docker-compose down

docker-logs: ## View docker logs
	docker-compose logs -f buzz-service

lint: ## Run linter
	golangci-lint run

fmt: ## Format code
	go fmt ./...

tidy: ## Tidy dependencies
	go mod tidy
