import { z } from "zod";

const booleanFromEnv = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const schema = z.object({
  ENABLE_AI: booleanFromEnv,
  ENABLE_ML: booleanFromEnv,
  ENABLE_PRNG_ANALYSIS: booleanFromEnv,
  ENABLE_DATA_SYNC: booleanFromEnv,
});

export const features = schema.parse({
  ENABLE_AI: process.env.FEATURE_AI,
  ENABLE_ML: process.env.FEATURE_ML,
  ENABLE_PRNG_ANALYSIS: process.env.FEATURE_PRNG_ANALYSIS,
  ENABLE_DATA_SYNC: process.env.FEATURE_DATA_SYNC,
});

export type Features = typeof features;
export type FeatureName = keyof Features;
