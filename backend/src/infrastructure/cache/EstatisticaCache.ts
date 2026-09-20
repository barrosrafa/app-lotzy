import { loadResults, type HistoryResult } from "../data/results.js";
import { UNIVERSE } from "../../domain/games/constants.js";
import { GameAnalyzer } from "../../domain/games/services/GameAnalyzer.js";

export interface DelayStat {
  dezena: number;
  frequenciaTotal: number;
  atrasoAtual: number;
  atrasoMedio: number;
  maiorAtraso: number;
  ultimoConcurso: number | null;
}

export interface CycleStat {
  cicloAtual: number;
  dezenasFaltantes: number[];
  concursosNoCiclo: number;
  historicoCiclos: Array<{ concurso: number; dezenas: number[] }>;
}

export interface FrequencyStat {
  dezena: number;
  frequencia: number;
  percentual: number;
}

export interface PrecalculatedStats {
  analiseUltimoSorteio: ReturnType<GameAnalyzer["analyze"]>;
  atrasos: DelayStat[];
  ciclo: CycleStat;
  frequencias: FrequencyStat[];
  totalConcursos: number;
  calculadoEm: string;
}

export interface LatestConcursoResponse {
  concurso: HistoryResult;
  estatisticas: PrecalculatedStats;
  disclaimer: string;
}

export class EstatisticaCache {
  private static instance: EstatisticaCache | null = null;
  private analyzer = new GameAnalyzer();
  private resultsCache: HistoryResult[] | null = null;
  private statsCache: PrecalculatedStats | null = null;
  private latestCache: HistoryResult | null = null;
  private cacheExpiresAt = 0;
  private readonly ttlMs: number;

  public constructor(ttlMs = 3600000) {
    this.ttlMs = ttlMs;
  }

  public static getInstance(): EstatisticaCache {
    if (!EstatisticaCache.instance) {
      EstatisticaCache.instance = new EstatisticaCache();
    }
    return EstatisticaCache.instance;
  }

  public invalidate(): void {
    this.resultsCache = null;
    this.statsCache = null;
    this.latestCache = null;
    this.cacheExpiresAt = 0;
  }

  public getResults(): HistoryResult[] {
    const now = Date.now();
    if (!this.resultsCache || now >= this.cacheExpiresAt) {
      this.refresh();
    }
    return this.resultsCache!;
  }

  public getLatest(): LatestConcursoResponse {
    const results = this.getResults();
    if (results.length === 0) {
      throw new Error("Nenhum concurso encontrado na base de dados.");
    }

    const latest = this.latestCache!;
    const stats = this.statsCache!;

    return {
      concurso: latest,
      estatisticas: stats,
      disclaimer:
        "Estatísticas descrevem o histórico e não aumentam a probabilidade de qualquer combinação.",
    };
  }

  private refresh(): void {
    const results = loadResults().sort((a, b) => a.concurso - b.concurso);
    if (results.length === 0) {
      throw new Error("Base de resultados vazia");
    }

    const latest = results[results.length - 1];
    const analise = this.analyzer.analyze(latest.dezenas);
    const delays = this.computeDelays(results, latest.concurso);
    const cycle = this.computeCycle(results);
    const frequencies = this.computeFrequencies(results);

    this.resultsCache = results;
    this.latestCache = latest;
    this.statsCache = {
      analiseUltimoSorteio: analise,
      atrasos: delays,
      ciclo: cycle,
      frequencias: frequencies,
      totalConcursos: results.length,
      calculadoEm: new Date().toISOString(),
    };
    this.cacheExpiresAt = Date.now() + this.ttlMs;
  }

  private computeDelays(
    results: HistoryResult[],
    latestConcurso: number,
  ): DelayStat[] {
    return UNIVERSE.map((dezena) => {
      const positions = results
        .map((result, index) => (result.dezenas.includes(dezena) ? index : -1))
        .filter((index) => index >= 0);
      const gaps = positions
        .slice(1)
        .map((position, index) => position - positions[index] - 1);
      const lastPosition = positions.at(-1) ?? -1;
      return {
        dezena,
        frequenciaTotal: positions.length,
        atrasoAtual:
          lastPosition < 0 ? results.length : results.length - 1 - lastPosition,
        atrasoMedio: gaps.length
          ? Number(
              (gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length).toFixed(
                2,
              ),
            )
          : 0,
        maiorAtraso: Math.max(0, ...gaps),
        ultimoConcurso:
          lastPosition < 0
            ? null
            : latestConcurso - (results.length - 1 - lastPosition),
      };
    });
  }

  private computeCycle(results: HistoryResult[]): CycleStat {
    let covered = new Set<number>();
    let lastComplete = -1;
    const history: Array<{ concurso: number; dezenas: number[] }> = [];

    results.forEach((result) => {
      result.dezenas.forEach((number) => covered.add(number));
      if (covered.size === 25) {
        lastComplete = result.concurso;
        history.push({
          concurso: result.concurso,
          dezenas: [...covered].sort((a, b) => a - b),
        });
        covered = new Set();
      }
    });

    const current = results.filter((result) => result.concurso > lastComplete);
    const missing = UNIVERSE.filter(
      (number) => !current.some((result) => result.dezenas.includes(number)),
    );

    return {
      cicloAtual: history.length + 1,
      dezenasFaltantes: missing,
      concursosNoCiclo: current.length,
      historicoCiclos: history.slice(-20),
    };
  }

  private computeFrequencies(results: HistoryResult[]): FrequencyStat[] {
    const counts = Object.fromEntries(UNIVERSE.map((num) => [num, 0]));
    results.forEach((result) => {
      result.dezenas.forEach((num) => {
        counts[num] = (counts[num] ?? 0) + 1;
      });
    });

    const total = Math.max(1, results.length);
    return UNIVERSE.map((dezena) => ({
      dezena,
      frequencia: counts[dezena],
      percentual: Number(((counts[dezena] / total) * 100).toFixed(2)),
    }));
  }
}

export const estatisticaCache = EstatisticaCache.getInstance();
