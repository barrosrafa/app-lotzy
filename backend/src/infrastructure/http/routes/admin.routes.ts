import { Router } from "express";
import { featureGate } from "../middlewares/featureGate.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";

export const adminRoutes = Router();

adminRoutes.post("/sync", requireAuth, requireRole("admin"), featureGate("ENABLE_DATA_SYNC"), (_req, res) => {
  res.status(202).json({ status: "accepted", message: "Sincronização agendada." });
});
