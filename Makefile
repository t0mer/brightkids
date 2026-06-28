# BrightKids — build & dev targets.
# CGO is disabled everywhere for clean static cross-compilation.

BINARY      := brightkids
PKG         := github.com/t0mer/brightkids
WEB_DIR     := web
DIST_DIR    := internal/server/dist
SCANS_DIR   := scans

VERSION     ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)
COMMIT      ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo none)
DATE        ?= $(shell date -u +%Y-%m-%dT%H:%M:%SZ)
LDFLAGS     := -s -w \
	-X $(PKG)/internal/version.Version=$(VERSION) \
	-X $(PKG)/internal/version.Commit=$(COMMIT) \
	-X $(PKG)/internal/version.Date=$(DATE)

export CGO_ENABLED=0

.PHONY: all web build run dev test lint scan docker release clean tidy

all: build

## web: install deps + build the SPA into the Go embed dir
web:
	cd $(WEB_DIR) && npm ci && npm run build

## build: build the SPA then the Go binary (embeds the SPA)
build: web
	go build -trimpath -ldflags "$(LDFLAGS)" -o ./$(BINARY) ./cmd/$(BINARY)

## build-go: build only the Go binary (assumes dist already populated)
build-go:
	go build -trimpath -ldflags "$(LDFLAGS)" -o ./$(BINARY) ./cmd/$(BINARY)

## run: build and run with local config
run: build
	./$(BINARY) --log-format text --log-level debug

## dev: vite dev server + go run with hot reload (run in two shells if needed)
dev:
	@echo "Frontend: cd $(WEB_DIR) && npm run dev  (proxies /api -> :8080)"
	@echo "Backend:  go run ./cmd/$(BINARY) --log-format text --log-level debug"
	go run ./cmd/$(BINARY) --log-format text --log-level debug

## test: go tests (race) + frontend tests
test:
	go test ./... -race -coverprofile=coverage.out
	cd $(WEB_DIR) && npm run test --if-present

## lint: golangci-lint + eslint
lint:
	golangci-lint run ./...
	cd $(WEB_DIR) && npm run lint --if-present

## scan: security scans -> scans/ (gitignored)
scan:
	@mkdir -p $(SCANS_DIR)
	-gitleaks detect --no-banner --report-path $(SCANS_DIR)/gitleaks.json || true
	-govulncheck ./... | tee $(SCANS_DIR)/govulncheck.txt
	-gosec -quiet -fmt=json -out=$(SCANS_DIR)/gosec.json ./... || true
	@echo "Scan reports written to $(SCANS_DIR)/ (review before committing)"

## docker: local multi-arch buildx
docker:
	docker buildx build --platform linux/amd64,linux/arm64 \
		--build-arg VERSION=$(VERSION) --build-arg COMMIT=$(COMMIT) --build-arg DATE=$(DATE) \
		-t techblog/$(BINARY):$(VERSION) .

## release: goreleaser snapshot (local artifacts)
release: web
	goreleaser release --snapshot --clean

## tidy: go mod tidy
tidy:
	go mod tidy

clean:
	rm -f ./$(BINARY) coverage.out
	rm -rf $(DIST_DIR)/assets
	find $(DIST_DIR) -mindepth 1 ! -name '.gitkeep' -delete 2>/dev/null || true
	rm -rf $(WEB_DIR)/dist $(WEB_DIR)/node_modules
