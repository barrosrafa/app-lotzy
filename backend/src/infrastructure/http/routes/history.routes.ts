import { Router, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';

export type HistoryResult = {
  concurso: number;
  data: string;
  dezenas: number[];
  premiacoes?: Record<string, number>;
  acumulado: boolean;
  valorEstimadoProximoConcurso?: number;
};

type LegacyRow = [number | string, string, ...number[]];
const router = Router();
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function invalid(res: Response, parameter: string): Response {
  return res.status(400).json({ error: `Parâmetro '${parameter}' inválido` });
}

function stringQuery(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function parseInteger(value: string | undefined, parameter: string, res: Response): number | undefined | null {
  if (value === undefined) return undefined;
  if (!/^\d+$/.test(value)) {
    invalid(res, parameter);
    return null;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    invalid(res, parameter);
    return null;
  }
  return parsed;
}

function isIsoDate(value: string): boolean {
  if (!datePattern.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function normalizeDate(value: string): string {
  const [day, month, year] = value.split('/');
  return `${year}-${month}-${day}`;
}

function resultsPath(): string {
  const candidates = [
    path.join(process.cwd(), 'db', 'resultados.json'),
    path.join(process.cwd(), '..', 'db', 'resultados.json'),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    const error = new Error('Base de resultados não encontrada');
    error.name = 'HistoryNotFoundError';
    throw error;
  }
  return found;
}

function loadResults(): HistoryResult[] {
  const parsed: unknown = JSON.parse(fs.readFileSync(resultsPath(), 'utf8'));
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { ['Todos os Resultados']?: unknown })['Todos os Resultados'])) {
    throw new Error('Formato de resultados inválido');
  }

  const rows = (parsed as { ['Todos os Resultados']: unknown[] })['Todos os Resultados'];
  return rows.slice(1).flatMap((row): HistoryResult[] => {
    if (!Array.isArray(row) || row.length < 17 || typeof row[0] !== 'number' || typeof row[1] !== 'string') return [];
    const legacy = row as LegacyRow;
    const dezenas = legacy.slice(2).filter((value): value is number => typeof value === 'number');
    return [{ concurso: legacy[0] as number, data: normalizeDate(legacy[1] as string), dezenas, acumulado: false }];
  });
}

router.get('/history', (req: Request, res: Response) => {
  const dataInicio = stringQuery(req.query.dataInicio);
  const dataFim = stringQuery(req.query.dataFim);
  const order = stringQuery(req.query.order) ?? 'desc';
  if (dataInicio !== undefined && !isIsoDate(dataInicio)) return invalid(res, 'dataInicio');
  if (dataFim !== undefined && !isIsoDate(dataFim)) return invalid(res, 'dataFim');
  if (dataInicio && dataFim && dataInicio > dataFim) return invalid(res, 'dataInicio');
  if (order !== 'asc' && order !== 'desc') return invalid(res, 'order');

  const concurso = parseInteger(stringQuery(req.query.concurso), 'concurso', res);
  const concursoMin = parseInteger(stringQuery(req.query.concursoMin), 'concursoMin', res);
  const concursoMax = parseInteger(stringQuery(req.query.concursoMax), 'concursoMax', res);
  const page = parseInteger(stringQuery(req.query.page) ?? '1', 'page', res);
  const requestedLimit = parseInteger(stringQuery(req.query.limit) ?? '50', 'limit', res);
  if (concurso === null || concursoMin === null || concursoMax === null || page === null || requestedLimit === null) return res;
  if (page === undefined || page < 1) return invalid(res, 'page');
  if (requestedLimit === undefined || requestedLimit < 1) return invalid(res, 'limit');
  const limit = Math.min(500, requestedLimit);

  try {
    let results = loadResults().filter((result) => {
      if (dataInicio && result.data < dataInicio) return false;
      if (dataFim && result.data > dataFim) return false;
      if (concurso !== undefined && result.concurso !== concurso) return false;
      if (concursoMin !== undefined && result.concurso < concursoMin) return false;
      if (concursoMax !== undefined && result.concurso > concursoMax) return false;
      return true;
    });
    results.sort((a, b) => order === 'asc' ? a.concurso - b.concurso : b.concurso - a.concurso);
    const total = results.length;
    const offset = (page - 1) * limit;
    return res.status(200).json({ total, page, limit, totalPages: Math.ceil(total / limit), data: results.slice(offset, offset + limit) });
  } catch (error) {
    if (error instanceof Error && error.name === 'HistoryNotFoundError') return res.status(404).json({ error: 'Base de resultados não encontrada' });
    return res.status(500).json({ error: 'Falha ao processar resultados' });
  }
});

export { router as historyRoutes };
