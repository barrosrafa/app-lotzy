import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from "prom-client";

export const metricsRegistry = new Registry();
collectDefaultMetrics({ register: metricsRegistry, prefix: "lotzy_" });
export const httpRequestsTotal = new Counter({ name: "lotzy_http_requests_total", help: "Total de requisições HTTP.", labelNames: ["method", "route", "status"], registers: [metricsRegistry] });
export const httpRequestDuration = new Histogram({ name: "lotzy_http_request_duration_seconds", help: "Duração das requisições HTTP.", labelNames: ["method", "route"], registers: [metricsRegistry], buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5] });
export const readinessFailures = new Counter({ name: "lotzy_readiness_failures_total", help: "Falhas de readiness.", registers: [metricsRegistry] });
export const apiUp = new Gauge({ name: "lotzy_up", help: "API disponível.", registers: [metricsRegistry],
});
apiUp.set(1);
