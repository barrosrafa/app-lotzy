import { Router } from "express";
import { z } from "zod";
import { loadResults } from "../../data/results.js";
import { CryptoRandomSource } from "../../random/CryptoRandomSource.js";
import { COLUMNS, ROWS, UNIVERSE } from "../../../domain/games/constants.js";
import { GameAnalyzer } from "../../../domain/games/services/GameAnalyzer.js";

export const statsRoutes = Router();
const source = new CryptoRandomSource();
function draw(size: number, pool: number[]): number[] {
  const values = [...pool];
  const out: number[] = [];
  for (let index = 0; index < size; index++) {
    const selected = source.nextInt(0, values.length);
    out.push(values.splice(selected, 1)[0]);
  }
  return out;
}
const disclaimer =
  "Estatísticas descrevem o histórico e não aumentam a probabilidade de qualquer combinação.";
let delaysCache: { expires: number; value: unknown } | undefined;
let compositionCache: { expires: number; value: unknown } | undefined;
function ordered() {
  return loadResults().sort((a, b) => a.concurso - b.concurso);
}

function increment(distribution: Record<string, number>, value: string | number) {
  const key = String(value);
  distribution[key] = (distribution[key] ?? 0) + 1;
}

function gridPattern(numbers: number[], grid: number[][]): string {
  return grid.map((line) => line.filter((number) => numbers.includes(number)).length).join("-");
}

function compositionStats() {
  const results = ordered();
  const analyzer = new GameAnalyzer();
  const distributions = {
    primos: {} as Record<string, number>,
    moldura: {} as Record<string, number>,
    miolo: {} as Record<string, number>,
    pares: {} as Record<string, number>,
    impares: {} as Record<string, number>,
    linhas: {} as Record<string, number>,
    colunas: {} as Record<string, number>,
    sequencias: { longas: 0, curtas: 0 },
  };
  const totals = { primos: 0, moldura: 0, miolo: 0, pares: 0, impares: 0, maiorSequencia: 0 };

  results.forEach((result) => {
    const metrics = analyzer.analyze(result.dezenas);
    totals.primos += metrics.primes;
    totals.moldura += metrics.frame;
    totals.miolo += metrics.core;
    totals.pares += metrics.evens;
    totals.impares += metrics.odds;
    totals.maiorSequencia += metrics.maxConsecutiveRun;
    increment(distributions.primos, metrics.primes);
    increment(distributions.moldura, metrics.frame);
    increment(distributions.miolo, metrics.core);
    increment(distributions.pares, metrics.evens);
    increment(distributions.impares, metrics.odds);
    increment(distributions.linhas, gridPattern(result.dezenas, ROWS));
    increment(distributions.colunas, gridPattern(result.dezenas, COLUMNS));
    if (metrics.maxConsecutiveRun >= 3) distributions.sequencias.longas += 1;
    else distributions.sequencias.curtas += 1;
  });

  const total = results.length;
  const average = (value: number) => Number((value / Math.max(1, total)).toFixed(2));
  return {
    totalConcursos: total,
    medias: {
      primos: average(totals.primos),
      pares: average(totals.pares),
      impares: average(totals.impares),
      moldura: average(totals.moldura),
      miolo: average(totals.miolo),
      maiorSequencia: average(totals.maiorSequencia),
    },
    distribuicoes: distributions,
  };
}

statsRoutes.get("/composicao", (_req, res, next) => {
  try {
    if (!compositionCache || compositionCache.expires < Date.now()) {
      compositionCache = {
        expires: Date.now() + 3600000,
        value: { status: "success", data: compositionStats(), disclaimer },
      };
    }
    res.set("Cache-Control", "public, max-age=3600").json(compositionCache.value);
  } catch (error) {
    next(error);
  }
});

function delayStats() {
  const results = ordered();
  const latest = results.at(-1)?.concurso ?? 0;
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
            (gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length).toFixed(2),
          )
        : 0,
      maiorAtraso: Math.max(0, ...gaps),
      ultimoConcurso:
        lastPosition < 0 ? null : latest - (results.length - 1 - lastPosition),
    };
  });
}
statsRoutes.get("/atrasos", (_req, res, next) => {
  try {
    if (!delaysCache || delaysCache.expires < Date.now())
      delaysCache = {
        expires: Date.now() + 3600000,
        value: { data: delayStats(), disclaimer },
      };
    res.set("Cache-Control", "public, max-age=3600").json(delaysCache.value);
  } catch (error) {
    next(error);
  }
});
statsRoutes.get("/temperatura", (req, res, next) => {
  try {
    const janela = z.coerce
      .number()
      .int()
      .refine((value) => [10, 20, 50].includes(value))
      .default(10)
      .parse(req.query.janela);
    const results = ordered().slice(-janela);
    const counts = Object.fromEntries(UNIVERSE.map((number) => [number, 0]));
    results.forEach((result) =>
      result.dezenas.forEach((number) => (counts[number] += 1)),
    );
    res.json({
      janela,
      concursos: results.length,
      data: UNIVERSE.map((dezena) => ({
        dezena,
        frequencia: counts[dezena],
        percentual: Number(
          ((counts[dezena] / Math.max(1, results.length)) * 100).toFixed(1),
        ),
      })),
      disclaimer,
    });
  } catch (error) {
    next(error);
  }
});
function cycleData() {
  const results = ordered();
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
statsRoutes.get("/ciclos", (_req, res, next) => {
  try {
    res.json({ ...cycleData(), disclaimer });
  } catch (error) {
    next(error);
  }
});
statsRoutes.post("/generate/ciclo", (req, res, next) => {
  try {
    const body = z
      .object({
        quantity: z.number().int().min(1).max(100).default(1),
        numbersPerGame: z.number().int().min(15).max(20).default(15),
      })
      .parse(req.body);
    const missing = cycleData().dezenasFaltantes;
    if (missing.length > body.numbersPerGame)
      return res.status(422).json({
        error: `O ciclo exige ${missing.length} dezenas; escolha um jogo maior.`,
      });
    const games = Array.from({ length: body.quantity }, () =>
      [
        ...missing,
        ...draw(
          body.numbersPerGame - missing.length,
          UNIVERSE.filter((number) => !missing.includes(number)),
        ),
      ].sort((a, b) => a - b),
    );
    res.json({
      data: games.map((game) => ({ game })),
      ciclo: cycleData(),
      disclaimer,
    });
  } catch (error) {
    next(error);
  }
});
