# Client Build stage
FROM node:20-alpine AS client-builder
WORKDIR /app/client
# Copy package files first to leverage caching
COPY client/package*.json ./
RUN npm install
# Copy the rest of the client code
COPY client ./
RUN npm run build

# Go Build stage
FROM golang:1.26-alpine AS builder
WORKDIR /app
# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download
# Copy source code
COPY . .
# Build application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o buzz-service ./cmd/server

# Runtime stage
FROM alpine:latest
RUN apk --no-cache add ca-certificates tzdata
WORKDIR /root/

# Copy binary from Go builder
COPY --from=builder /app/buzz-service .
# Copy built static client assets
COPY --from=client-builder /app/client/out ./client/out

# Expose port
EXPOSE 8080

# Run application
CMD ["./buzz-service"]
