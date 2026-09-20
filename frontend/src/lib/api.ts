import { z } from 'zod';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export const gameSchema = z.array(z.number().int().min(1).max(25)).min(15).max(20);
const responseSchema = z.object({
  status: z.string(),
  meta: z.object({ generatedQuantity: z.number(), numbersPerGame: z.number() }).passthrough(),
  data: z.array(z.object({ game: gameSchema }).passthrough()),
  cost: z.object({ simpleBets: z.number(), totalCents: z.number(), formatted: z.string() }).passthrough(),
  expectedValue: z.object({ fixedTiersCents: z.number() }).passthrough().optional(),
  disclaimer: z.string(),
}).passthrough();

const historyStatsSchema = z.object({
  drawCount: z.number().int().positive(),
  frequency: z.array(z.number().int().nonnegative()).length(25),
  sumDistribution: z.object({ min: z.number(), max: z.number(), mean: z.number(), percentiles: z.object({ p10: z.number(), p25: z.number(), p50: z.number(), p75: z.number(), p90: z.number() }) }),
  averages: z.object({ even: z.number(), odd: z.number(), primes: z.number(), frame: z.number() }),
  repetitionAverage: z.number(),
});
const historyResponseSchema = z.object({ data: historyStatsSchema, disclaimer: z.string() });

export type Game = number[];
export type GeneratedResponse = z.infer<typeof responseSchema>;
export type HistoryResponse = z.infer<typeof historyResponseSchema>;
export type Problem = { title?: string; detail?: string; type?: string; status?: number; requestId?: string; violations?: Array<{ constraint: string; achievable?: { min?: number; max?: number } }> };
export type HistoricalFilters = { sum: { min: number; max: number }; evens: { min: number; max: number }; primes: { min: number; max: number }; frame: { min: number; max: number } };

async function request<T>(path: string, init?: RequestInit, schema?: z.ZodType<T>): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { ...init, headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(init?.headers ?? {}) } });
  const requestId = response.headers.get('X-Request-Id') ?? undefined;
  const raw: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const problem = raw as Problem;
    throw new Error(`${problem.detail ?? problem.title ?? `A API respondeu ${response.status}`} · requestId: ${requestId ?? 'indisponível'}`);
  }
  return schema ? schema.parse(raw) : raw as T;
}

export async function generateRandom(quantity: number, numbersPerGame: number): Promise<GeneratedResponse> {
  return request('/games/generate-random', { method: 'POST', body: JSON.stringify({ quantity, numbersPerGame }) }, responseSchema);
}

export async function generateFiltered(quantity: number, numbersPerGame: number, filters: HistoricalFilters): Promise<GeneratedResponse> {
  return request('/games/generate-filtered', { method: 'POST', body: JSON.stringify({ quantity, numbersPerGame, filters }) }, responseSchema);
}

export async function fetchHistoryStats(): Promise<HistoryResponse> {
  return request('/history/stats', undefined, historyResponseSchema);
}
export async function getFilters(): Promise<unknown> { return request('/games/filters'); }
export async function validateGame(game: Game): Promise<unknown> { return request('/games/validate', { method: 'POST', body: JSON.stringify({ game }) }); }
export async function analyzeGames(games: Game[]): Promise<unknown> { return request('/games/analyze', { method: 'POST', body: JSON.stringify({ games, page: 1, pageSize: 100 }) }); }
export async function checkGames(drawnNumbers: Game, games: Game[]): Promise<unknown> { return request('/games/check', { method: 'POST', body: JSON.stringify({ drawnNumbers, games }) }); }
export async function bankrollCheck(monthlyBudgetCents: number, horizonMonths: number): Promise<unknown> { return request('/tools/bankroll-check', { method: 'POST', body: JSON.stringify({ monthlyBudgetCents, horizonMonths }) }); }
