import { z } from 'zod';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export const gameSchema = z.array(z.number().int().min(1).max(25)).min(15).max(20);
const generatedSchema = z.object({
  status: z.string(),
  meta: z.object({ generatedQuantity: z.number(), numbersPerGame: z.number() }).passthrough(),
  data: z.array(z.object({ game: gameSchema }).passthrough()),
  cost: z.object({ simpleBets: z.number(), totalCents: z.number(), formatted: z.string() }).passthrough(),
  expectedValue: z.object({ fixedTiersCents: z.number() }).passthrough().optional(),
  disclaimer: z.string(),
}).passthrough();
const historyResultSchema = z.object({
  concurso: z.number().int(),
  data: z.string(),
  dezenas: z.array(z.number().int().min(1).max(25)),
  acumulado: z.boolean(),
}).passthrough();
const historyResponseSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
  data: z.array(historyResultSchema),
}).passthrough();

export type Game = number[];
export type GeneratedResponse = z.infer<typeof generatedSchema>;
export type HistoryResult = z.infer<typeof historyResultSchema>;
export type HistoryResponse = z.infer<typeof historyResponseSchema>;
export type HistoryQuery = { dataInicio?: string; dataFim?: string; concurso?: string; page?: number; limit?: number; order?: 'asc' | 'desc' };
export type Problem = { title?: string; detail?: string; type?: string; status?: number; requestId?: string; violations?: Array<{ constraint: string; achievable?: { min?: number; max?: number } }> };

async function request<T>(path: string, init?: RequestInit, schema?: z.ZodType<T>): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_URL}${path}`;
  const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(init?.headers ?? {}) } });
  const requestId = response.headers.get('X-Request-Id') ?? undefined;
  const raw: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const problem = raw as Problem;
    throw new Error(`${problem.detail ?? problem.title ?? `A API respondeu ${response.status}`} · requestId: ${requestId ?? 'indisponível'}`);
  }
  return schema ? schema.parse(raw) : raw as T;
}

export async function generateRandom(quantity: number, numbersPerGame: number): Promise<GeneratedResponse> {
  return request('/games/generate-random', { method: 'POST', body: JSON.stringify({ quantity, numbersPerGame }) }, generatedSchema);
}

export async function getFilters(): Promise<unknown> { return request('/games/filters'); }
export async function validateGame(game: Game): Promise<unknown> { return request('/games/validate', { method: 'POST', body: JSON.stringify({ game }) }); }
export async function analyzeGames(games: Game[]): Promise<unknown> { return request('/games/analyze', { method: 'POST', body: JSON.stringify({ games, page: 1, pageSize: 100 }) }); }
export async function checkGames(drawnNumbers: Game, games: Game[]): Promise<unknown> { return request('/games/check', { method: 'POST', body: JSON.stringify({ drawnNumbers, games }) }); }
export async function bankrollCheck(monthlyBudgetCents: number, horizonMonths: number): Promise<unknown> { return request('/tools/bankroll-check', { method: 'POST', body: JSON.stringify({ monthlyBudgetCents, horizonMonths }) }); }
export async function getHistory(query: HistoryQuery): Promise<HistoryResponse> {
  const params = new URLSearchParams({ page: String(query.page ?? 1), limit: String(query.limit ?? 50), order: query.order ?? 'desc' });
  for (const key of ['dataInicio', 'dataFim', 'concurso'] as const) if (query[key]) params.set(key, query[key] as string);
  const apiOrigin = API_URL.replace(/\/api\/v1\/?$/, '');
  return request(`${apiOrigin}/api/history?${params.toString()}`, undefined, historyResponseSchema);
}
