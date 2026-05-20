# Grafana dashboards

Drop dashboard JSON files in this directory and they'll be auto-loaded on Grafana start
(provisioned via [../provisioning/dashboards/k6.yml](../provisioning/dashboards/k6.yml)).

## Recommended dashboard

The k6 community dashboard for InfluxDB v1 is well-maintained:
**[Grafana.com dashboard ID 2587](https://grafana.com/grafana/dashboards/2587-k6-load-testing-results/)**

Two options to install it:

**Option A — Import via UI (one-time):**
1. `make up`
2. Open http://localhost:3000 → Dashboards → Import
3. Paste dashboard ID `2587` → select `k6-influxdb` datasource → Import

**Option B — Provision via JSON (committed):**
Download the dashboard JSON from the link above and save it as `k6-load-testing.json`
in this directory. Grafana will load it on the next `make up`.

We don't ship the JSON in the repo to keep the artifact lightweight and let users
pick the latest version of the community dashboard.
