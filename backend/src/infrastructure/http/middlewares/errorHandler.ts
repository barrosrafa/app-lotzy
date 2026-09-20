import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../../../shared/errors/AppError.js";
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  res.type("application/problem+json");
  const requestId = String(req.headers["x-request-id"] ?? "unknown");
  const log = (
    req as typeof req & {
      log?: { error: (context: { err: unknown }, message: string) => void };
    }
  ).log;
  if (err instanceof ZodError) {
    return res.status(422).json({
      type: "https://api.lotofacil.internal/errors/validation-failed",
      title: "Unprocessable Entity",
      status: 422,
      detail: "Um ou mais campos do payload são inválidos.",
      instance: req.originalUrl,
      requestId,
      invalidParams: err.issues.map((i) => ({
        name: i.path.join("."),
        reason: i.message,
      })),
    });
  }
  if (err instanceof AppError)
    return res.status(err.statusCode).json({
      type: `https://api.lotofacil.internal/errors/${err.code.toLowerCase().replaceAll("_", "-")}`,
      title: err.name,
      status: err.statusCode,
      detail: err.message,
      instance: req.originalUrl,
      requestId,
      ...err.extensions,
    });
  if (log) {
    log.error({ err }, "unhandled");
  } else {
    console.error(err);
  }
  return res.status(500).json({
    type: "https://api.lotofacil.internal/errors/internal",
    title: "Internal Server Error",
    status: 500,
    detail:
      process.env.NODE_ENV === "production"
        ? "Erro interno. Consulte o suporte informando o requestId."
        : err instanceof Error
          ? err.message
          : "Erro interno. Consulte o suporte informando o requestId.",
    instance: req.originalUrl,
    requestId,
  });
};
