import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FRAME, PRIMES } from '../games/constants.js';
import { GameAnalyzer } from '../games/services/GameAnalyzer.js';

type HistoryRow = readonly [number, string, ...number[]];

export interface HistoryStats {
  drawCount: number;
  frequency: number[];
  sumDistribution: {
    min: number;
    max: number;
    mean: number;
    percentiles: { p10: number; p25: number; p50: number; p75: number; p90: number };
  };
  averages: { even: number; odd: number; primes: number; frame: number };
  repetitionAverage: number;
}

const percentile = (sorted: number[], fraction: number): number => {
  if (!sorted.length) return 0;
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower] ?? 0;
  const weight = index - lower;
  return Math.round((sorted[lower] ?? 0) + ((sorted[upper] ?? 0) - (sorted[lower] ?? 0)) * weight);
};

function readDraws(): number[][] {
  const path = fileURLToPath(new URL('../../../../db/resultados.json', import.meta.url));
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || !('Todos os Resultados' in parsed)) throw new Error('Formato de histórico inválido.');
  const rows = (parsed as { 'Todos os Resultados': unknown })['Todos os Resultados'];
  if (!Array.isArray(rows)) throw new Error('Histórico sem linhas de resultados.');
  return rows.slice(1).filter((row): row is HistoryRow => Array.isArray(row) && row.length >= 17 && typeof row[0] === 'number')
    .map(row => row.slice(2).filter((value): value is number => typeof value === 'number' && value >= 1 && value <= 25));
}

export class HistoryStatsService {
  private static cache: HistoryStats | null = null;

  static getStats(): HistoryStats {
    if (this.cache) return this.cache;
    const draws = readDraws();
    if (!draws.length) throw new Error('Nenhum concurso encontrado no histórico.');
    const analyzer = new GameAnalyzer();
    const sums = draws.map(draw => draw.reduce((total, value) => total + value, 0)).sort((a, b) => a - b);
    const metrics = draws.map(draw => analyzer.analyze(draw));
    const frequency = Array.from({ length: 25 }, (_, index) => draws.reduce((count, draw) => count + (draw.includes(index + 1) ? 1 : 0), 0));
    const mean = (values: number[]): number => values.reduce((total, value) => total + value, 0) / values.length;
    const repeats = draws.slice(1).map((draw, index) => draw.filter(number => draws[index]?.includes(number)).length);
    this.cache = {
      drawCount: draws.length,
      frequency,
      sumDistribution: {
        min: sums[0] ?? 0,
        max: sums.at(-1) ?? 0,
        mean: Math.round(mean(sums) * 100) / 100,
        percentiles: { p10: percentile(sums, .1), p25: percentile(sums, .25), p50: percentile(sums, .5), p75: percentile(sums, .75), p90: percentile(sums, .9) },
      },
      averages: {
        even: Math.round(mean(metrics.map(metric => metric.evens)) * 100) / 100,
        odd: Math.round(mean(metrics.map(metric => metric.odds)) * 100) / 100,
        primes: Math.round(mean(metrics.map(metric => metric.primes)) * 100) / 100,
        frame: Math.round(mean(metrics.map(metric => metric.frame)) * 100) / 100,
      },
      repetitionAverage: Math.round(mean(repeats) * 100) / 100,
    };
    return this.cache;
  }

  static clearCache(): void { this.cache = null; }
}

export { FRAME, PRIMES };
