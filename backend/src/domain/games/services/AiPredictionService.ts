import * as tf from "@tensorflow/tfjs-node";
import { loadResults, type HistoryResult } from "../../../infrastructure/data/results.js";
import { UNIVERSE } from "../constants.js";

export type AiPredictionRequest = {
  quantity: number;
  numbersPerGame: number;
  includeCaixa: boolean;
};

type CaixaResult = {
  concurso: number;
  data: string;
  dezenas: number[];
};

const disclaimer =
  "Palpites inteligentes são uma camada de marketing baseada em padrões históricos. Sorteios são aleatórios: nenhuma combinação tem probabilidade superior e não há garantia de acerto.";

async function fetchLatestCaixa(): Promise<CaixaResult | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(
      "https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil",
      { headers: { Accept: "application/json" }, signal: controller.signal },
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      numero?: number;
      dataApuracao?: string;
      listaDezenas?: string[];
    };
    if (
      !Number.isInteger(payload.numero) ||
      !payload.dataApuracao ||
      !Array.isArray(payload.listaDezenas) ||
      payload.listaDezenas.length !== 15
    )
      return null;
    const dezenas = payload.listaDezenas.map(Number).sort((a, b) => a - b);
    if (dezenas.some((n) => !Number.isInteger(n) || n < 1 || n > 25))
      return null;
    const concurso = payload.numero;
    const data = payload.dataApuracao;
    if (concurso === undefined || data === undefined) return null;
    return { concurso, data, dezenas };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function vector(numbers: number[]): number[] {
  const selected = new Set(numbers);
  return UNIVERSE.map((number) => (selected.has(number) ? 1 : 0));
}

function sampleCombination(probabilities: number[], size: number, seed: number): number[] {
  const ranked = UNIVERSE.map((number, index) => ({
    number,
    score: Math.log(Math.max(probabilities[index] ?? 0, 0.0001)) + ((seed * (index + 7) * 17) % 101) / 10000,
  })).sort((a, b) => b.score - a.score);
  const maxOffset = Math.max(0, ranked.length - size);
  const offset = Math.min(seed - 1, maxOffset);
  return ranked.slice(offset, offset + size).map(({ number }) => number).sort((a, b) => a - b);
}

export class AiPredictionService {
  async predict(request: AiPredictionRequest) {
    const localResults = loadResults().sort((a, b) => a.concurso - b.concurso);
    let history: HistoryResult[] = localResults;
    let source: "local" | "local+caixa" = "local";
    let caixaLatest: CaixaResult | null = null;
    if (request.includeCaixa) {
      const localLatest = localResults.at(-1)?.concurso ?? 0;
      caixaLatest = await fetchLatestCaixa();
      if (caixaLatest && caixaLatest.concurso > localLatest) {
        history = [
          ...localResults,
          { ...caixaLatest, acumulado: false },
        ];
        source = "local+caixa";
      }
    }

    if (history.length < 3) throw new Error("Histórico insuficiente para treinar o modelo");
    const xs = tf.tensor2d(history.slice(0, -1).map((row) => vector(row.dezenas)));
    const ys = tf.tensor2d(history.slice(1).map((row) => vector(row.dezenas)));
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [25], units: 48, activation: "relu" }),
        tf.layers.dropout({ rate: 0.12 }),
        tf.layers.dense({ units: 32, activation: "relu" }),
        tf.layers.dense({ units: 25, activation: "sigmoid" }),
      ],
    });
    model.compile({ optimizer: tf.train.adam(0.01), loss: "binaryCrossentropy" });
    await model.fit(xs, ys, { epochs: 4, batchSize: Math.min(32, history.length - 1), verbose: 0 });
    const input = tf.tensor2d([vector(history.at(-1)!.dezenas)]);
    const output = model.predict(input) as tf.Tensor;
    const probabilities = Array.from(await output.data());
    input.dispose();
    output.dispose();
    xs.dispose();
    ys.dispose();
    model.dispose();

    const games = Array.from({ length: request.quantity }, (_, index) => ({
      game: sampleCombination(probabilities, request.numbersPerGame, index + 1),
      score: Number((probabilities.reduce((sum, value) => sum + value, 0) / 25).toFixed(4)),
    }));
    return {
      status: "success",
      data: games,
      meta: {
        model: "TensorFlow.js dense",
        modelVersion: "ai-v8.1",
        trainingDraws: history.length,
        lastTrainingContest: history.at(-1)?.concurso,
        source,
        caixaComplemented: Boolean(caixaLatest && source === "local+caixa"),
      },
      disclaimer,
    };
  }
}

export { disclaimer as aiDisclaimer };
export { fetchLatestCaixa };
