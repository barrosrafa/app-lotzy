import type { RequestHandler } from "express";
import { AppError } from "../../../shared/errors/AppError.js";
import { features, type FeatureName } from "../../../shared/config/features.js";

export function featureGate(feature: FeatureName): RequestHandler {
  return (_req, _res, next) => {
    if (!features[feature]) return next(new AppError("FEATURE_DISABLED", `Recurso '${feature}' desativado.`, 404, { feature }));
    next();
  };
}
