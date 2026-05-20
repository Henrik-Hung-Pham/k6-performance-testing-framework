# Custom k6 image — only needed if/when you want xk6 extensions baked in
# (e.g., xk6-output-prometheus-remote, xk6-faker, xk6-sql).
#
# Most users won't need this — `grafana/k6:latest` in docker-compose.yml is sufficient.

FROM grafana/xk6:latest AS builder
RUN xk6 build \
    --with github.com/grafana/xk6-output-prometheus-remote@latest \
    --with github.com/grafana/xk6-faker@latest

FROM grafana/k6:latest
COPY --from=builder /xk6/k6 /usr/bin/k6
ENTRYPOINT ["k6"]
