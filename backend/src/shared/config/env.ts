import { z } from "zod";
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  CORS_ORIGINS: z
    .string()
    .default("")
    .transform((s) => s.split(",").filter(Boolean)),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().int().default(100),
  RESPONSIBLE_GAMBLING_URL: z
    .string()
    .url()
    .default(
      "https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/j/jogo-patologico",
    ),
  PRICE_TABLE_VERSION: z.string().default("2024-11-04"),
  WHEEL_CATALOG_VERSION: z.string().default("wheels-2026-09"),
  POPULARITY_MODEL_VERSION: z.string().default("popularity-2026-09"),
  AUTH_JWT_SECRET: z.string().default(""),
  ADMIN_API_KEYS: z.string().default("").transform((value) => value.split(",").filter(Boolean).map((entry) => {
    const [key, role = "admin"] = entry.split(":");
    return { key, role: role === "user" ? "user" : "admin" } as const;
  })),
  RATE_LIMIT_STORE: z.enum(["memory", "redis"]).default("memory"),
  REDIS_URL: z.string().url().optional(),
});
export type Env = z.infer<typeof schema>;
export const env: Env = schema.parse(process.env);
