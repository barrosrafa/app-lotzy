import { parentPort } from "node:worker_threads";
import { simpleBetCount } from "../domain/games/constants.js";

export interface SimularWorkerPayload {
  id: string;
  cartoes: number[][];
  draws: Array<{ concurso: number; dezenas: number[] }>;
  betPriceCents?: number;
  fixedPrizes?: Record<number, number>;
  estimated14PrizeCents?: number;
  estimated15PrizeCents?: number;
}

export interface SimularWorkerResult {
  id: string;
  success: boolean;
  totalConcursos: number;
  totalCartoes: number;
  totalApostasSimples: number;
  custoTotalCents: number;
  premioTotalCents: number;
  saldoLiquidoCents: number;
  roi: number;
  roiPercentual: string;
  acertosPorFaixa: Record<string, number>;
  maiorAcerto: number;
  mediaAcertos: number;
  error?: string;
}

if (parentPort) {
  parentPort.on("message", (msg: SimularWorkerPayload) => {
    try {
      const {
        id,
        cartoes,
        draws,
        betPriceCents = 350,
        fixedPrizes = { 11: 700, 12: 1400, 13: 3500 },
        estimated14PrizeCents = 150000,
        estimated15PrizeCents = 180000000,
      } = msg;

      const acertosPorFaixa: Record<string, number> = {
        "11": 0,
        "12": 0,
        "13": 0,
        "14": 0,
        "15": 0,
      };

      let maiorAcerto = 0;
      let totalHitsAll = 0;

      let costPerDrawCents = 0;
      let simpleBetsPerDraw = 0;
      for (const cartao of cartoes) {
        const bets = simpleBetCount(cartao.length, 15);
        simpleBetsPerDraw += bets;
        costPerDrawCents += bets * betPriceCents;
      }

      for (const draw of draws) {
        const drawSet = new Set(draw.dezenas);
        for (const cartao of cartoes) {
          let hits = 0;
          for (const num of cartao) {
            if (drawSet.has(num)) hits++;
          }
          if (hits > maiorAcerto) maiorAcerto = hits;
          totalHitsAll += hits;

          if (hits >= 11 && hits <= 15) {
            acertosPorFaixa[String(hits)]++;
          }
        }
      }

      const totalConcursos = draws.length;
      const totalApostasSimples = simpleBetsPerDraw * totalConcursos;
      const custoTotalCents = costPerDrawCents * totalConcursos;

      const premioTotalCents =
        (acertosPorFaixa["11"] ?? 0) * (fixedPrizes[11] ?? 700) +
        (acertosPorFaixa["12"] ?? 0) * (fixedPrizes[12] ?? 1400) +
        (acertosPorFaixa["13"] ?? 0) * (fixedPrizes[13] ?? 3500) +
        (acertosPorFaixa["14"] ?? 0) * estimated14PrizeCents +
        (acertosPorFaixa["15"] ?? 0) * estimated15PrizeCents;

      const saldoLiquidoCents = premioTotalCents - custoTotalCents;
      const roi =
        custoTotalCents > 0
          ? Number(((premioTotalCents - custoTotalCents) / custoTotalCents).toFixed(4))
          : 0;
      const roiPercentual = `${(roi * 100).toFixed(2)}%`;
      const totalCartaoChecks = cartoes.length * totalConcursos;
      const mediaAcertos =
        totalCartaoChecks > 0
          ? Number((totalHitsAll / totalCartaoChecks).toFixed(2))
          : 0;

      parentPort?.postMessage({
        id,
        success: true,
        totalConcursos,
        totalCartoes: cartoes.length,
        totalApostasSimples,
        custoTotalCents,
        premioTotalCents,
        saldoLiquidoCents,
        roi,
        roiPercentual,
        acertosPorFaixa,
        maiorAcerto,
        mediaAcertos,
      } satisfies SimularWorkerResult);
    } catch (err: unknown) {
      parentPort?.postMessage({
        id: msg?.id ?? "unknown",
        success: false,
        totalConcursos: 0,
        totalCartoes: 0,
        totalApostasSimples: 0,
        custoTotalCents: 0,
        premioTotalCents: 0,
        saldoLiquidoCents: 0,
        roi: 0,
        roiPercentual: "0.00%",
        acertosPorFaixa: {},
        maiorAcerto: 0,
        mediaAcertos: 0,
        error: err instanceof Error ? err.message : String(err),
      } satisfies SimularWorkerResult);
    }
  });
}
