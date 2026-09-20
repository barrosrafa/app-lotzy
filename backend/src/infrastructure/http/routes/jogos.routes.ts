import { Router } from "express";
import { z } from "zod";
import { WorkerPool } from "../../../workers/WorkerPool.js";
import {
  type DesdobrarWorkerPayload,
  type DesdobrarWorkerResult,
} from "../../../workers/desdobrar.worker.js";
import {
  type SimularWorkerPayload,
  type SimularWorkerResult,
} from "../../../workers/simular.worker.js";
import { estatisticaCache } from "../../cache/EstatisticaCache.js";
import { priceTable } from "../../pricing/StaticPriceTable.js";
import { AppError } from "../../../shared/errors/AppError.js";

export const jogosRoutes = Router();

// Worker Pools for CPU heavy operations
const desdobrarPool = new WorkerPool<DesdobrarWorkerPayload, DesdobrarWorkerResult>(
  "desdobrar.worker.ts",
  2,
  15000,
);

const simularPool = new WorkerPool<SimularWorkerPayload, SimularWorkerResult>(
  "simular.worker.ts",
  2,
  20000,
);

export { desdobrarPool, simularPool };

const dozen = z.number().int().min(1).max(25);
const uniqueNumbers = (message = "Dezenas duplicadas.") =>
  z.array(dozen).refine((a) => new Set(a).size === a.length, message);
const game = uniqueNumbers("Jogo contém dezenas duplicadas.").min(15).max(20);

const desdobrarSchema = z
  .object({
    dezenas: uniqueNumbers().min(15).max(20).optional(),
    numbers: uniqueNumbers().min(15).max(20).optional(),
    regras: z
      .object({
        targetSize: z.number().int().min(15).max(20).default(15).optional(),
        filters: z.record(z.string(), z.unknown()).optional(),
        limit: z.number().int().positive().optional(),
      })
      .optional(),
    format: z.enum(["json", "ndjson"]).default("json"),
  })
  .refine((data) => data.dezenas || data.numbers, {
    message: "É obrigatório informar 'dezenas' ou 'numbers'.",
  });

const simularSchema = z
  .object({
    cartoes: z.array(game).min(1).optional(),
    jogos: z.array(game).min(1).optional(),
    games: z.array(game).min(1).optional(),
    dezenas: game.optional(),
    concursoInicio: z.number().int().positive().optional(),
    concursoFim: z.number().int().positive().optional(),
    historicDraws: z.array(z.array(dozen).length(15)).min(1).optional(),
  })
  .refine(
    (data) => data.cartoes || data.jogos || data.games || data.dezenas,
    {
      message: "É obrigatório informar ao menos um cartão em 'cartoes', 'jogos', 'games' ou 'dezenas'.",
    },
  );

jogosRoutes.post("/desdobrar", async (req, res, next) => {
  try {
    const body = desdobrarSchema.parse(req.body);
    const rawDezenas = body.dezenas ?? body.numbers!;
    const targetSize = body.regras?.targetSize ?? 15;
    const filters = body.regras?.filters;
    const limit = body.regras?.limit;

    if (rawDezenas.length < targetSize) {
      throw new AppError(
        "INVALID_SUBSET_SIZE",
        `A quantidade de dezenas (${rawDezenas.length}) deve ser maior ou igual ao tamanho do cartão (${targetSize}).`,
        422,
      );
    }

    const result = await desdobrarPool.execute({
      dezenas: rawDezenas,
      targetSize,
      filters,
      limit,
    });

    if (body.format === "ndjson") {
      res.type("application/x-ndjson");
      res.write(JSON.stringify({ meta: { total: result.total, format: "ndjson" } }) + "\n");
      const cartoes = result.cartoes ?? [];
      for (const cartao of cartoes) {
        res.write(JSON.stringify({ game: cartao }) + "\n");
      }
      res.end();
      return;
    }

    res.json({
      status: "success",
      total: result.total,
      cartoes: result.cartoes ?? [],
      data: result.cartoes ?? [],
    });
  } catch (error) {
    next(error);
  }
});

jogosRoutes.post("/simular", async (req, res, next) => {
  try {
    const body = simularSchema.parse(req.body);

    let rawCartoes: number[][];
    if (body.cartoes) rawCartoes = body.cartoes;
    else if (body.jogos) rawCartoes = body.jogos;
    else if (body.games) rawCartoes = body.games;
    else rawCartoes = [body.dezenas!];

    let draws: Array<{ concurso: number; dezenas: number[] }>;
    if (body.historicDraws) {
      draws = body.historicDraws.map((dezenas, idx) => ({
        concurso: idx + 1,
        dezenas,
      }));
    } else {
      const results = estatisticaCache.getResults();
      draws = results
        .filter(
          (row) =>
            (body.concursoInicio === undefined || row.concurso >= body.concursoInicio) &&
            (body.concursoFim === undefined || row.concurso <= body.concursoFim),
        )
        .map((r) => ({ concurso: r.concurso, dezenas: r.dezenas }));
    }

    if (draws.length === 0) {
      throw new AppError(
        "NO_CONCURSOS_FOUND",
        "Nenhum concurso encontrado no intervalo informado.",
        404,
      );
    }

    const result = await simularPool.execute({
      cartoes: rawCartoes,
      draws,
      betPriceCents: priceTable.betPriceCents,
      fixedPrizes: priceTable.fixedPrizeCents,
    });

    res.json({
      status: "success",
      meta: {
        totalCartoes: result.totalCartoes,
        totalConcursos: result.totalConcursos,
        totalApostasSimples: result.totalApostasSimples,
      },
      data: {
        totalConcursos: result.totalConcursos,
        totalApostasSimples: result.totalApostasSimples,
        custoTotalCents: result.custoTotalCents,
        premioTotalCents: result.premioTotalCents,
        saldoLiquidoCents: result.saldoLiquidoCents,
        roi: result.roi,
        roiPercentual: result.roiPercentual,
        acertosPorFaixa: result.acertosPorFaixa,
        maiorAcerto: result.maiorAcerto,
        mediaAcertos: result.mediaAcertos,
      },
      disclaimer:
        "Simulação baseada em dados históricos passados. Resultados passados não garantem retornos futuros e não aumentam a probabilidade de premiação.",
    });
  } catch (error) {
    next(error);
  }
});
