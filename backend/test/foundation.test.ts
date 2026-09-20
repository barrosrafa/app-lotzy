import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

const app = createApp();

describe("fundação operacional", () => {
  it("expõe readiness com verificação do dataset", async () => {
    const response = await request(app).get("/ready");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ready");
    expect(response.body.checks.historyCount).toBeGreaterThan(0);
  });

  it("expõe métricas Prometheus com contagem HTTP", async () => {
    await request(app).get("/health");
    const response = await request(app).get("/metrics");
    expect(response.status).toBe(200);
    expect(response.text).toContain("lotzy_http_requests_total");
    expect(response.text).toContain("lotzy_up 1");
  });

  it("nega sincronização administrativa sem autenticação", async () => {
    const response = await request(app).post("/api/v1/admin/sync");
    expect(response.status).toBe(401);
    expect(response.body.type).toContain("unauthorized");
  });

  it("mantém sincronização desligada por padrão mesmo após autenticação ausente", async () => {
    const response = await request(app).post("/api/v1/admin/sync").set("x-api-key", "invalid");
    expect(response.status).toBe(401);
  });
});
