FROM golang:1.24-alpine AS build

WORKDIR /build

COPY api/go.* .

RUN go mod download -x

COPY api .

RUN CGO_ENABLED=0 go build -o api.bin .

FROM node:24-alpine AS frontend

WORKDIR /app

COPY frontend/package*.json ./

RUN npm install

COPY frontend .

RUN npm run build

FROM alpine:latest
COPY --from=build /build/api.bin /app/api
COPY --from=frontend /app/build /app/dist

ENTRYPOINT [ "/app/api" ]
