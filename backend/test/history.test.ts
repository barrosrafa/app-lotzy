import { describe, expect, it } from 'vitest';
import { HistoryStatsService } from '../src/domain/history/HistoryStats.js';

describe('HistoryStatsService', () => {
  it('carrega o histórico, ignora o cabeçalho e calcula estatísticas válidas', () => {
    HistoryStatsService.clearCache();
    const stats = HistoryStatsService.getStats();
    expect(stats.drawCount).toBeGreaterThan(100);
    expect(stats.frequency).toHaveLength(25);
    expect(stats.frequency.every(value => value >= 0)).toBe(true);
    expect(stats.sumDistribution.min).toBeLessThanOrEqual(stats.sumDistribution.mean);
    expect(stats.sumDistribution.mean).toBeLessThanOrEqual(stats.sumDistribution.max);
    expect(stats.sumDistribution.percentiles.p10).toBeLessThanOrEqual(stats.sumDistribution.percentiles.p90);
    expect(stats.averages.even + stats.averages.odd).toBeCloseTo(15, 5);
    expect(stats.repetitionAverage).toBeGreaterThanOrEqual(0);
  });

  it('devolve a mesma instância enquanto o cache está ativo', () => {
    const first = HistoryStatsService.getStats();
    const second = HistoryStatsService.getStats();
    expect(second).toBe(first);
  });
});
