.PHONY: swagger build run

swagger:
	@which swag > /dev/null 2>&1 || go install github.com/swaggo/swag/cmd/swag@latest
	swag init -g cmd/server/main.go --output docs/

build:
	go build -o server ./cmd/server

run:
	go run ./cmd/server
