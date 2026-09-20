import { parentPort } from "node:worker_threads";
import { expand } from "../domain/games/services/CombinationExpander.js";
import { FilterEngine } from "../domain/games/services/FilterEngine.js";

export interface DesdobrarWorkerPayload {
  id: string;
  dezenas: number[];
  targetSize?: number;
  filters?: Record<string, unknown>;
  limit?: number;
}

export interface DesdobrarWorkerResult {
  id: string;
  success: boolean;
  total: number;
  cartoes?: number[][];
  error?: string;
}

const filterEngine = new FilterEngine();

if (parentPort) {
  parentPort.on("message", (msg: DesdobrarWorkerPayload) => {
    try {
      const { id, dezenas, targetSize = 15, filters, limit } = msg;
      const sorted = [...dezenas].sort((a, b) => a - b);
      const generator = expand(sorted, targetSize);

      const cartoes: number[][] = [];
      let total = 0;

      for (const combo of generator) {
        total++;
        if (filters && !filterEngine.check(combo, filters)) {
          continue;
        }
        if (!limit || cartoes.length < limit) {
          cartoes.push(combo);
        }
      }

      parentPort?.postMessage({
        id,
        success: true,
        total,
        cartoes,
      } satisfies DesdobrarWorkerResult);
    } catch (err: unknown) {
      parentPort?.postMessage({
        id: msg?.id ?? "unknown",
        success: false,
        total: 0,
        error: err instanceof Error ? err.message : String(err),
      } satisfies DesdobrarWorkerResult);
    }
  });
}
