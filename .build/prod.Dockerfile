FROM gcr.io/distroless/static-debian12
WORKDIR /app

COPY build/api.amd64 /app/amd64
COPY build/api.arm64 /app/arm64
COPY static /app/dist
