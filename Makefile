.PHONY: help smoke load stress spike soak breakpoint e2e all-tests \
        report up down dashboard clean lint format ci docker-run install

K6 ?= k6
ENV ?= staging
RESULTS_DIR ?= results
TIMESTAMP := $(shell date +%Y%m%d-%H%M%S)
OUT_JSON := --out json=$(RESULTS_DIR)/$(TEST_NAME)-$(TIMESTAMP)-raw.json
SUMMARY_ENV := K6_SUMMARY_HTML=$(RESULTS_DIR)/$(TEST_NAME)-$(TIMESTAMP).html \
               K6_SUMMARY_JSON=$(RESULTS_DIR)/$(TEST_NAME)-$(TIMESTAMP).json

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install dev dependencies (linting/formatting)
	npm install

results-dir:
	@mkdir -p $(RESULTS_DIR)

smoke: TEST_NAME=smoke
smoke: results-dir ## Run smoke test (~30s, 1 VU) — fail fast on broken endpoints
	$(SUMMARY_ENV) $(K6) run -e ENV=$(ENV) $(OUT_JSON) tests/smoke/api-smoke.js

load: TEST_NAME=load
load: results-dir ## Run load test (~8 min, ramping to peak)
	$(SUMMARY_ENV) $(K6) run -e ENV=$(ENV) $(OUT_JSON) tests/load/browse-ratings.js

load-lifecycle: TEST_NAME=load-lifecycle
load-lifecycle: results-dir ## Run pizza-lifecycle load test (~8 min, login + generate + rate)
	$(SUMMARY_ENV) $(K6) run -e ENV=$(ENV) $(OUT_JSON) tests/load/pizza-lifecycle.js

stress: TEST_NAME=stress
stress: results-dir ## Run stress test (~15 min, push past capacity)
	$(SUMMARY_ENV) $(K6) run -e ENV=$(ENV) $(OUT_JSON) tests/stress/auth-stress.js

spike: TEST_NAME=spike
spike: results-dir ## Run spike test (~3 min, sudden 20x burst)
	$(SUMMARY_ENV) $(K6) run -e ENV=$(ENV) $(OUT_JSON) tests/spike/public-spike.js

soak: TEST_NAME=soak
soak: results-dir ## Run soak test (~2h, steady load — memory leak detection)
	$(SUMMARY_ENV) $(K6) run -e ENV=$(ENV) $(OUT_JSON) tests/soak/steady-state.js

breakpoint: TEST_NAME=breakpoint
breakpoint: results-dir ## Run breakpoint test (slow ramp, find capacity knee)
	$(SUMMARY_ENV) $(K6) run -e ENV=$(ENV) $(OUT_JSON) tests/breakpoint/capacity.js

e2e: TEST_NAME=e2e
e2e: results-dir ## Run full end-to-end user journey
	$(SUMMARY_ENV) $(K6) run -e ENV=$(ENV) $(OUT_JSON) scenarios/e2e-user-journey.js

all-tests: smoke load spike ## Run smoke + load + spike (full CI suite, ~15 min)

up: ## Start InfluxDB + Grafana stack for live dashboards
	docker compose -f docker/docker-compose.yml up -d
	@echo "Grafana:  http://localhost:3000  (admin/admin)"
	@echo "InfluxDB: http://localhost:8086"

down: ## Stop the observability stack
	docker compose -f docker/docker-compose.yml down

dashboard: ## Open the Grafana k6 dashboard
	open http://localhost:3000/d/k6/k6-load-testing-results

docker-run: ## Run a test inside the k6 docker container (use TEST=tests/smoke/api-smoke.js)
	docker compose -f docker/docker-compose.yml run --rm k6 run /scripts/$(TEST)

lint: ## Lint all JS files
	npm run lint

format: ## Auto-format all JS files
	npm run format

ci: smoke ## CI entrypoint — runs smoke as gate
	@echo "CI smoke passed."

clean: ## Remove all results
	rm -rf $(RESULTS_DIR)/*
	@echo "Cleaned $(RESULTS_DIR)/"
