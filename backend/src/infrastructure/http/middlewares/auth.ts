import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "../../../shared/config/env.js";
import { AppError } from "../../../shared/errors/AppError.js";

type Role = "user" | "admin";
export type AuthUser = { sub: string; role: Role };

declare global {
  namespace Express {
    interface Request { user?: AuthUser; }
  }
}

function base64url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function verifyJwt(token: string): AuthUser | null {
  if (!env.AUTH_JWT_SECRET) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedPayload, signature] = parts;
  const expected = createHmac("sha256", env.AUTH_JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as { sub?: string; role?: Role; exp?: number };
    if (!payload.sub || !payload.role || !["user", "admin"].includes(payload.role)) return null;
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { sub: payload.sub, role: payload.role };
  } catch { return null; }
}

function apiKeyUser(value: string): AuthUser | null {
  const match = env.ADMIN_API_KEYS.find((entry) => entry.key === value);
  return match ? { sub: `api-key:${match.key.slice(0, 8)}`, role: match.role } : null;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const authorization = req.header("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
  const user = token ? verifyJwt(token) : apiKeyUser(req.header("x-api-key") ?? "");
  if (!user) return next(new AppError("UNAUTHORIZED", "Autenticação necessária.", 401));
  req.user = user;
  next();
}

export function requireRole(role: Role) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== role) return next(new AppError("FORBIDDEN", "Permissão insuficiente.", 403));
    next();
  };
}

export function signTestToken(user: AuthUser) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({ ...user, exp: Math.floor(Date.now() / 1000) + 3600 }));
  const signature = createHmac("sha256", env.AUTH_JWT_SECRET || "test-secret").update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}
