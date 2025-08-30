FROM gcr.io/distroless/static-debian12
WORKDIR /app

# Copy the correct binary based on the target platform
ARG TARGETARCH
COPY build/api.${TARGETARCH} /app/api
COPY static /app/dist
