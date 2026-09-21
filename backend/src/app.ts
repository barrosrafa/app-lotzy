import express from "express";
import cors from "cors";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import rateLimit from "express-rate-limit";
import { env } from "./shared/config/env.js";
import { errorHandler } from "./infrastructure/http/middlewares/errorHandler.js";
import {
  gameRoutes,
  toolRoutes,
} from "./infrastructure/http/routes/api.routes.js";
import { advancedRoutes } from "./infrastructure/http/routes/advanced.routes.js";
import { historyRoutes } from "./infrastructure/http/routes/history.routes.js";
import { openapi } from "./infrastructure/http/openapi/openapi.js";
import { statsRoutes } from "./infrastructure/http/routes/stats.routes.js";
import { loteRoutes } from "./infrastructure/http/routes/lote.routes.js";
import { phase2Routes } from "./infrastructure/http/routes/phase2.routes.js";
import { concursosRoutes } from "./infrastructure/http/routes/concursos.routes.js";
import { jogosRoutes } from "./infrastructure/http/routes/jogos.routes.js";
import { adminRoutes } from "./infrastructure/http/routes/admin.routes.js";
import { aiRoutes } from "./infrastructure/http/routes/ai.routes.js";
import { loadResults } from "./infrastructure/data/results.js";
import { metricsRegistry, httpRequestsTotal, httpRequestDuration, readinessFailures } from "./infrastructure/metrics/prometheus.js";
import { features } from "./shared/config/features.js";
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", env.NODE_ENV === "production" ? 1 : false);
  app.use((req, res, next) => {
    const id = String(req.headers["x-request-id"] ?? randomUUID());
    req.headers["x-request-id"] = id;
    res.setHeader("X-Request-Id", id);
    next();
  });
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGINS.length
        ? env.CORS_ORIGINS
        : env.NODE_ENV === "production"
          ? false
          : true,
      methods: ["GET", "POST", "OPTIONS"],
    }),
  );
  app.use(express.json({ limit: "256kb" }));
  app.use((req, res, next) => {
    const started = process.hrtime.bigint();
    res.on("finish", () => {
      const route = req.route?.path ?? req.path;
      httpRequestsTotal.labels(req.method, route, String(res.statusCode)).inc();
      httpRequestDuration.labels(req.method, route).observe(Number(process.hrtime.bigint() - started) / 1e9);
    });
    next();
  });
  app.use(
    "/api/v1/games/check/lote",
    express.text({
      type: [
        "text/plain",
        "text/csv",
        "application/x-ndjson",
        "multipart/form-data",
      ],
      limit: "2mb",
    }),
  );
  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/ready", (_req, res) => {
    let history = true;
    let historyCount = 0;
    try { historyCount = loadResults().length; history = historyCount > 0; } catch { history = false; }
    const checks = { priceTable: true, wheelCatalog: true, history, historyCount };
    if (!history) readinessFailures.inc();
    return res.status(history ? 200 : 503).json({ status: history ? "ready" : "not_ready", checks, features });
  });
  app.use("/api", historyRoutes);
  app.use("/api/v1/stats", phase2Routes);
  app.use("/api/v1", phase2Routes);
  app.use("/api/v1/stats", statsRoutes);
  app.use("/api/v1/games", statsRoutes);
  app.use("/api/v1/games/check/lote", loteRoutes);
  app.get("/metrics", (_req, res) =>
    metricsRegistry.metrics().then((body) => res.type(metricsRegistry.contentType).send(body)),
  );
  app.get("/api/v1/openapi.json", (_req, res) => res.json(openapi));
  const standard = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
  });
  const heavy = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use("/api/v1/games/expand", heavy);
  app.use("/api/v1/tools/backtest", heavy);
  app.use("/api/jogos/desdobrar", heavy);
  app.use("/api/jogos/simular", heavy);
  app.use("/api/v1/jogos/desdobrar", heavy);
  app.use("/api/v1/jogos/simular", heavy);
  app.use("/api/concursos", standard, concursosRoutes);
  app.use("/api/v1/concursos", standard, concursosRoutes);
  app.use("/api/jogos", standard, jogosRoutes);
  app.use("/api/v1/jogos", standard, jogosRoutes);
  app.use("/api/v1/games", standard, gameRoutes);
  app.use("/api/v1/games", heavy, advancedRoutes);
  app.use("/api/v1/ai", heavy, aiRoutes);
  app.use("/api/v1/tools", standard, toolRoutes);
  app.use("/api/v1/admin", adminRoutes);
  app.use(errorHandler);
  return app;
}
