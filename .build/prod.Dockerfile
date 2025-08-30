FROM golang:1.25-alpine AS build

WORKDIR /build

COPY go.* .

RUN go mod download -x

COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o api.amd64 -ldflags "-s -w" .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -o api.arm64 -ldflags "-s -w" .

FROM gcr.io/distroless/static-debian12
WORKDIR /app

COPY build/api.amd64 /app/amd64
COPY build/api.arm64 /app/arm64
COPY static /app/dist
