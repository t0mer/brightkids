# syntax=docker/dockerfile:1

# Stage 1: build the SPA once on the native build platform (static output is
# platform-independent — never build it per-arch under QEMU).
FROM --platform=$BUILDPLATFORM node:22-alpine AS web
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
# Vite's outDir is ../internal/server/dist; ensure the dir exists for the embed.
RUN mkdir -p /app/internal/server/dist
COPY internal/server/dist/.gitkeep /app/internal/server/dist/.gitkeep
RUN npm run build

# Stage 2: cross-compile the Go binary on the native build platform.
FROM --platform=$BUILDPLATFORM golang:1.25-alpine AS build
WORKDIR /app
ENV GOTOOLCHAIN=local
ENV CGO_ENABLED=0
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=web /app/internal/server/dist ./internal/server/dist
ARG VERSION=dev
ARG COMMIT=none
ARG DATE=unknown
ARG TARGETOS
ARG TARGETARCH
RUN GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build -trimpath \
    -ldflags "-s -w \
      -X github.com/t0mer/brightkids/internal/version.Version=${VERSION} \
      -X github.com/t0mer/brightkids/internal/version.Commit=${COMMIT} \
      -X github.com/t0mer/brightkids/internal/version.Date=${DATE}" \
    -o /brightkids ./cmd/brightkids
# Pre-create a writable data dir owned by the non-root user (scratch has no
# shell to mkdir/chown at runtime, and a root-owned volume isn't writable).
RUN mkdir -p /data

# Stage 3: minimal runtime.
FROM scratch
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=build /brightkids /brightkids
COPY --from=build --chown=65534:65534 /data /data
USER 65534:65534
EXPOSE 8080
VOLUME ["/data"]
ENV BRIGHTKIDS_SERVER_HOST=0.0.0.0 \
    BRIGHTKIDS_SERVER_PORT=8080 \
    BRIGHTKIDS_DB_PATH=/data/brightkids.db
ENTRYPOINT ["/brightkids"]
