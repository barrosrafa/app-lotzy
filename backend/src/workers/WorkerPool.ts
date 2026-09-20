import { Worker } from "node:worker_threads";
import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { AppError } from "../shared/errors/AppError.js";

interface PendingTask<T> {
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
  timer: NodeJS.Timeout;
}

const RUNNER_CODE = `
import { parentPort, workerData } from 'node:worker_threads';
import fs from 'node:fs';

const target = workerData.target;
if (target.endsWith('.js') && fs.existsSync(target)) {
  await import(target);
} else {
  const { tsImport } = await import('tsx/esm/api');
  await tsImport(target, import.meta.url);
}
`;

export class WorkerPool<TPayload extends { id: string }, TResult extends { id: string; success: boolean; error?: string }> {
  private workerScript: string;
  private poolSize: number;
  private timeoutMs: number;
  private workers: Worker[] = [];
  private pendingTasks = new Map<string, PendingTask<TResult>>();
  private roundRobinIndex = 0;
  private isTerminated = false;

  public constructor(workerScriptRelPath: string, poolSize = 2, timeoutMs = 15000) {
    this.workerScript = this.resolveWorkerPath(workerScriptRelPath);
    this.poolSize = Math.max(1, poolSize);
    this.timeoutMs = timeoutMs;
    this.init();
  }

  private resolveWorkerPath(relPath: string): string {
    const isCompiled = import.meta.url.includes("/dist/");
    if (isCompiled) {
      const jsRel = relPath.replace(/\.ts$/, ".js");
      const distCandidate = path.resolve(process.cwd(), "dist", "workers", path.basename(jsRel));
      if (fs.existsSync(distCandidate)) {
        return distCandidate;
      }
    }
    const directCandidate = path.resolve(process.cwd(), "src", "workers", path.basename(relPath));
    if (fs.existsSync(directCandidate)) {
      return directCandidate;
    }
    const jsCandidate = directCandidate.replace(/\.ts$/, ".js");
    if (fs.existsSync(jsCandidate)) {
      return jsCandidate;
    }
    return directCandidate;
  }

  private createWorker(index: number): Worker {
    const worker = new Worker(RUNNER_CODE, {
      eval: true,
      workerData: { target: this.workerScript },
    });

    worker.on("message", (result: TResult) => {
      const task = this.pendingTasks.get(result.id);
      if (!task) return;
      this.pendingTasks.delete(result.id);
      clearTimeout(task.timer);

      if (result.success) {
        task.resolve(result);
      } else {
        task.reject(new AppError("WORKER_ERROR", result.error ?? "Erro no processamento", 500));
      }
    });

    worker.on("error", (err) => {
      // Reject any tasks that might have been processed by this worker
      for (const [id, task] of this.pendingTasks.entries()) {
        clearTimeout(task.timer);
        task.reject(new AppError("WORKER_CRASHED", err.message, 500));
        this.pendingTasks.delete(id);
      }
      if (!this.isTerminated) {
        // Replace failed worker
        this.replaceWorker(index);
      }
    });

    return worker;
  }

  private replaceWorker(index: number): void {
    try {
      this.workers[index]?.terminate().catch(() => {});
    } catch {}
    if (!this.isTerminated) {
      this.workers[index] = this.createWorker(index);
    }
  }

  private init(): void {
    for (let i = 0; i < this.poolSize; i++) {
      this.workers.push(this.createWorker(i));
    }
  }

  public async execute(payload: Omit<TPayload, "id">, customTimeoutMs?: number): Promise<TResult> {
    if (this.isTerminated) {
      throw new AppError("WORKER_POOL_TERMINATED", "O pool de workers foi encerrado", 500);
    }

    const id = randomUUID();
    const fullPayload = { ...payload, id } as TPayload;
    const timeoutDuration = customTimeoutMs ?? this.timeoutMs;

    const workerIndex = this.roundRobinIndex % this.workers.length;
    this.roundRobinIndex++;
    const worker = this.workers[workerIndex];

    return new Promise<TResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingTasks.delete(id);
        // Worker exceeded timeout: replace it to avoid runaway loop
        this.replaceWorker(workerIndex);
        reject(
          new AppError(
            "TASK_TIMEOUT",
            `A tarefa excedeu o tempo limite de ${timeoutDuration}ms`,
            504,
          ),
        );
      }, timeoutDuration);

      this.pendingTasks.set(id, { resolve, reject, timer });
      worker.postMessage(fullPayload);
    });
  }

  public shutdown(): void {
    this.isTerminated = true;
    for (const [id, task] of this.pendingTasks.entries()) {
      clearTimeout(task.timer);
      task.reject(new AppError("WORKER_POOL_TERMINATED", "Worker pool encerrado", 500));
      this.pendingTasks.delete(id);
    }
    for (const worker of this.workers) {
      worker.terminate().catch(() => {});
    }
    this.workers = [];
  }
}
