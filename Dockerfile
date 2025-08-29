FROM golang:1.24-alpine AS build

WORKDIR /build

COPY api/go.* .

RUN go mod download -x

COPY api .

RUN CGO_ENABLED=0 go build -o api.bin .

FROM oven/bun:latest AS frontend

WORKDIR /app

COPY frontend/package*.json ./

RUN bun i

COPY frontend .

RUN bun run build

FROM alpine:latest
COPY --from=build /build/api.bin /app/api
COPY --from=frontend /app/build /app/dist

ENTRYPOINT [ "/app/api" ]
