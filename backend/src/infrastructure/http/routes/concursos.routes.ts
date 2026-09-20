import { Router } from "express";
import { estatisticaCache } from "../../cache/EstatisticaCache.js";

export const concursosRoutes = Router();

concursosRoutes.get("/latest", (_req, res, next) => {
  try {
    const latest = estatisticaCache.getLatest();
    res.set("Cache-Control", "public, max-age=300").json({
      status: "success",
      concurso: latest.concurso,
      estatisticas: latest.estatisticas,
      disclaimer: latest.disclaimer,
    });
  } catch (error) {
    next(error);
  }
});
