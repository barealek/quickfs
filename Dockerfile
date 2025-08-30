FROM golang:1.25-alpine AS build

WORKDIR /build

COPY go.* .

RUN go mod download -x

COPY . .

RUN CGO_ENABLED=0 go build -o api.bin -ldflags "-s -w" .

FROM gcr.io/distroless/static-debian12
WORKDIR /app

COPY --from=build /build/api.bin /app/api
COPY static /app/dist

ENTRYPOINT [ "/app/api", "--static", "./dist" ]
