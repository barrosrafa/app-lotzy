import { z } from 'zod';
import useSWR from 'swr';
import { useState, useCallback } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api(\/v1)?\/?$/, '')
  : 'http://localhost:3000';
const API_URL = `${API_BASE}/api/v1`;

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
  acumulado: z.boolean().optional(),
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
export type FilterCatalogItem = { key: string; label: string; domain: { min: number; max: number }; expected?: number; stdDev?: number; suggested?: { min: number; max: number }; nature: string; note?: string; deprecationHint?: string };
export type FilterCatalog = { data: FilterCatalogItem[]; disclaimer: string };
export type FilteredRequest = { quantity: number; numbersPerGame: number; fixedNumbers: number[]; excludedNumbers: number[]; filters: Record<string, unknown> };
export type StatsDelay = { dezena: number; frequenciaTotal: number; atrasoAtual: number; atrasoMedio: number; maiorAtraso: number; ultimoConcurso: number | null };
export type StatsTemperature = { janela: number; concursos: number; data: Array<{ dezena: number; frequencia: number; percentual: number }>; disclaimer: string };
export type CycleResponse = { cicloAtual: number; dezenasFaltantes: number[]; concursosNoCiclo: number; historicoCiclos: Array<{ concurso: number; dezenas: number[] }>; disclaimer: string };
export type CompositionResponse = {
  status: string;
  data: {
    totalConcursos: number;
    medias: { primos: number; pares: number; impares: number; moldura: number; miolo: number; maiorSequencia: number };
    distribuicoes: {
      primos: Record<string, number>;
      moldura: Record<string, number>;
      miolo: Record<string, number>;
      pares: Record<string, number>;
      impares: Record<string, number>;
      linhas: Record<string, number>;
      colunas: Record<string, number>;
      sequencias: { longas: number; curtas: number };
    };
  };
  disclaimer: string;
};
export type AnalysisResponse = { data: Array<{ game: Game; metrics: { sum: number; [key: string]: unknown } }>; aggregate: { meanSum: number; stdDevSum: number; meanPopularity: number }; diversity: Record<string, unknown>; pagination: { page: number; pageSize: number; totalGames: number } };

export type LatestConcursoResponse = {
  status: string;
  concurso: HistoryResult;
  estatisticas: {
    analiseUltimoSorteio: {
      sum: number;
      evens: number;
      odds: number;
      primes: number;
      fibonacci: number;
      frame: number;
      core: number;
      maxConsecutiveRun: number;
      popularity: { score: number };
    };
    atrasos: StatsDelay[];
    ciclo: CycleResponse;
    frequencias: Array<{ dezena: number; frequencia: number; percentual: number }>;
    totalConcursos: number;
    calculadoEm: string;
  };
  disclaimer: string;
};

export type DesdobrarRequest = {
  dezenas?: number[];
  numbers?: number[];
  regras?: {
    targetSize?: number;
    filters?: Record<string, unknown>;
    limit?: number;
  };
  format?: 'json' | 'ndjson';
};

export type DesdobrarResponse = {
  status: string;
  total: number;
  cartoes: number[][];
  data: number[][];
};

export type SimularRequest = {
  cartoes?: number[][];
  jogos?: number[][];
  games?: number[][];
  dezenas?: number[];
  concursoInicio?: number;
  concursoFim?: number;
  historicDraws?: number[][];
};

export type SimularResponse = {
  status: string;
  meta: {
    totalCartoes: number;
    totalConcursos: number;
    totalApostasSimples: number;
  };
  data: {
    totalConcursos: number;
    totalApostasSimples: number;
    custoTotalCents: number;
    premioTotalCents: number;
    saldoLiquidoCents: number;
    roi: number;
    roiPercentual: string;
    acertosPorFaixa: Record<string, number>;
    maiorAcerto: number;
    mediaAcertos: number;
  };
  disclaimer: string;
};

async function request<T>(path: string, init?: RequestInit, schema?: z.ZodType<T>): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/api') ? path : `/api/v1${path}`}`;
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(init?.headers ?? {}) },
  });
  const requestId = response.headers.get('X-Request-Id') ?? undefined;
  const raw: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const problem = raw as Problem;
    throw new Error(`${problem.detail ?? problem.title ?? `A API respondeu ${response.status}`} · requestId: ${requestId ?? 'indisponível'}`);
  }
  return schema ? schema.parse(raw) : (raw as T);
}

// REST endpoints
export async function getLatestConcurso(): Promise<LatestConcursoResponse> {
  return request('/api/concursos/latest');
}

export async function desdobrarJogos(payload: DesdobrarRequest): Promise<DesdobrarResponse> {
  return request('/api/jogos/desdobrar', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function simularJogos(payload: SimularRequest): Promise<SimularResponse> {
  return request('/api/jogos/simular', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function generateRandom(quantity: number, numbersPerGame: number): Promise<GeneratedResponse> {
  return request('/games/generate-random', { method: 'POST', body: JSON.stringify({ quantity, numbersPerGame }) }, generatedSchema);
}

export async function generateFiltered(payload: FilteredRequest): Promise<GeneratedResponse> {
  return request('/games/generate-filtered', { method: 'POST', body: JSON.stringify(payload) }, generatedSchema);
}

export type WeightedStrategy = 'quentes' | 'frias' | 'overdue';
export async function generateWeighted(payload: { quantity: number; numbersPerGame: number; fixedNumbers?: number[]; excludedNumbers?: number[]; strategy: WeightedStrategy; filters?: Record<string, unknown> }): Promise<GeneratedResponse> {
  return request('/games/generate/ponderado', { method: 'POST', body: JSON.stringify(payload) }, generatedSchema);
}

export async function getFilters(): Promise<FilterCatalog> {
  return request('/games/filters');
}

export async function validateGame(game: Game): Promise<unknown> {
  return request('/games/validate', { method: 'POST', body: JSON.stringify({ game }) });
}

export async function validateAndAnalyzeBatch(batch: GeneratedResponse): Promise<{ batch: GeneratedResponse; analysis: AnalysisResponse; validations: unknown[] }> {
  const games = batch.data.map((item) => item.game);
  const validations = await Promise.all(games.map(validateGame));
  const analysis = await analyzeGames(games);
  return { batch, analysis, validations };
}

export async function analyzeGames(games: Game[]): Promise<AnalysisResponse> {
  return request('/games/analyze', { method: 'POST', body: JSON.stringify({ games, page: 1, pageSize: 100 }) });
}

export async function checkGames(drawnNumbers: Game, games: Game[]): Promise<unknown> {
  return request('/games/check', { method: 'POST', body: JSON.stringify({ drawnNumbers, games }) });
}

export async function bankrollCheck(monthlyBudgetCents: number, horizonMonths: number): Promise<unknown> {
  return request('/tools/bankroll-check', { method: 'POST', body: JSON.stringify({ monthlyBudgetCents, horizonMonths }) });
}

export async function getHistory(query: HistoryQuery): Promise<HistoryResponse> {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    limit: String(query.limit ?? 50),
    order: query.order ?? 'desc',
  });
  for (const key of ['dataInicio', 'dataFim', 'concurso'] as const) {
    if (query[key]) params.set(key, query[key] as string);
  }
  return request(`/api/history?${params.toString()}`, undefined, historyResponseSchema);
}

export function parseNumbers(value: string): number[] {
  return [...new Set(value.split(/[\s,#*;]+/).map(Number).filter((number) => Number.isInteger(number) && number >= 1 && number <= 25))].sort((a, b) => a - b);
}

export async function getSeasonal(month: number): Promise<{ month: number; totalConcursos: number; data: Array<{ dezena: number; frequencia: number; percentual: number }>; disclaimer: string }> {
  return request(`/stats/seasonal?month=${month}`);
}

export async function generateVariations(game: Game, count: number): Promise<{ data: Array<{ game: Game }> }> {
  return request('/games/generate/variations', { method: 'POST', body: JSON.stringify({ game, count }) });
}

export async function getPrices(): Promise<unknown> {
  return request('/tabela-precos');
}

export async function getDelays(): Promise<{ data: StatsDelay[]; disclaimer: string }> {
  return request('/stats/atrasos');
}

export async function getTemperature(windowSize: 10 | 20 | 50): Promise<StatsTemperature> {
  return request(`/stats/temperatura?janela=${windowSize}`);
}

export async function getCycles(): Promise<CycleResponse> {
  return request('/stats/ciclos');
}

export async function getCompositionStats(): Promise<CompositionResponse> {
  return request('/stats/composicao');
}

export async function generateCycle(quantity: number, numbersPerGame: number): Promise<{ data: Array<{ game: Game }>; ciclo: CycleResponse; disclaimer: string }> {
  return request('/games/generate/ciclo', { method: 'POST', body: JSON.stringify({ quantity, numbersPerGame }) });
}

export async function checkGamesBatch(text: string, drawnNumbers: Game): Promise<unknown> {
  const origin = API_BASE;
  const response = await fetch(`${origin}/api/v1/games/check/lote?drawnNumbers=${encodeURIComponent(drawnNumbers.join(','))}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: text,
  });
  const raw = await response.json();
  if (!response.ok) throw new Error((raw as Problem).detail ?? 'Não foi possível conferir o lote.');
  return raw;
}

export function exportUrl(path: string, format: string): string {
  const cleanPath = path.startsWith('/api') ? path : `/api/v1${path}`;
  return `${API_BASE}${cleanPath}${cleanPath.includes('?') ? '&' : '?'}format=${encodeURIComponent(format)}`;
}

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

// SWR Hooks
export function useLatestConcurso() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<LatestConcursoResponse>(
    '/api/concursos/latest',
    getLatestConcurso,
    { revalidateOnFocus: false, dedupingInterval: 30000 },
  );

  return {
    latest: data,
    isLoading,
    isValidating,
    error: error instanceof Error ? error.message : error ? String(error) : null,
    mutate,
  };
}

export function useDesdobrar() {
  const [data, setData] = useState<DesdobrarResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const desdobrar = useCallback(async (payload: DesdobrarRequest) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await desdobrarJogos(payload);
      setData(result);
      return result;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Falha ao desdobrar dezenas.';
      setError(message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return { desdobrar, data, isLoading, error, reset };
}

export function useSimular() {
  const [data, setData] = useState<SimularResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const simular = useCallback(async (payload: SimularRequest) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await simularJogos(payload);
      setData(result);
      return result;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Falha ao simular jogos.';
      setError(message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return { simular, data, isLoading, error, reset };
}

export { generatedSchema };
