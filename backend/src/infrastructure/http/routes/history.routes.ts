import { Router, type Request, type Response } from 'express';
import { loadResults } from '../../data/results.js';

const router = Router();
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
function invalid(res: Response, parameter: string): Response { return res.status(400).json({ error: `Parâmetro '${parameter}' inválido` }); }
function stringQuery(value: unknown): string | undefined { return typeof value === 'string' && value.length > 0 ? value : undefined; }
function parseInteger(value: string | undefined, parameter: string, res: Response): number | undefined | null { if (value === undefined) return undefined; if (!/^\d+$/.test(value)) { invalid(res, parameter); return null; } const parsed = Number(value); if (!Number.isSafeInteger(parsed)) { invalid(res, parameter); return null; } return parsed; }
function isIsoDate(value: string): boolean { if (!datePattern.test(value)) return false; const [year, month, day] = value.split('-').map(Number); const parsed = new Date(Date.UTC(year, month - 1, day)); return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day; }
function csv(rows: Array<{ concurso: number; data: string; dezenas: number[] }>): string { return ['concurso,data,dezenas', ...rows.map((row) => `${row.concurso},${row.data},"${row.dezenas.join(' ')}"`)].join('\n') + '\n'; }
function sql(rows: Array<{ concurso: number; data: string; dezenas: number[] }>): string { return rows.map((row) => `INSERT INTO resultados (concurso, data, dezenas) VALUES (${row.concurso}, '${row.data}', ARRAY[${row.dezenas.join(',')}]);`).join('\n') + '\n'; }

router.get('/history', (req: Request, res: Response) => {
  const dataInicio = stringQuery(req.query.dataInicio); const dataFim = stringQuery(req.query.dataFim); const order = stringQuery(req.query.order) ?? 'desc'; const format = stringQuery(req.query.format);
  if ((dataInicio && !isIsoDate(dataInicio)) || (dataFim && !isIsoDate(dataFim))) return invalid(res, dataInicio && !isIsoDate(dataInicio) ? 'dataInicio' : 'dataFim');
  if (dataInicio && dataFim && dataInicio > dataFim) return invalid(res, 'dataInicio');
  if (order !== 'asc' && order !== 'desc') return invalid(res, 'order'); if (format && !['csv', 'txt', 'json', 'sql'].includes(format)) return invalid(res, 'format');
  const concurso = parseInteger(stringQuery(req.query.concurso), 'concurso', res); const concursoMin = parseInteger(stringQuery(req.query.concursoMin), 'concursoMin', res); const concursoMax = parseInteger(stringQuery(req.query.concursoMax), 'concursoMax', res); const page = parseInteger(stringQuery(req.query.page) ?? '1', 'page', res); const requestedLimit = parseInteger(stringQuery(req.query.limit) ?? '50', 'limit', res);
  if ([concurso, concursoMin, concursoMax, page, requestedLimit].some((value) => value === null)) return res; if (concursoMin === null || concursoMax === null || page === null || requestedLimit === null) return res; if (!page || page < 1) return invalid(res, 'page'); if (!requestedLimit || requestedLimit < 1) return invalid(res, 'limit');
  try {
    const results = loadResults().filter((result) => (!dataInicio || result.data >= dataInicio) && (!dataFim || result.data <= dataFim) && (concurso === undefined || result.concurso === concurso) && (concursoMin === undefined || result.concurso >= concursoMin) && (concursoMax === undefined || result.concurso <= concursoMax)).sort((a, b) => order === 'asc' ? a.concurso - b.concurso : b.concurso - a.concurso);
    if (format) { const body = format === 'csv' ? csv(results) : format === 'txt' ? results.map((row) => `${row.concurso}: ${row.dezenas.join(' ')}`).join('\n') + '\n' : format === 'sql' ? sql(results) : JSON.stringify(results, null, 2); return res.type(format === 'json' ? 'application/json' : 'text/plain').set('Content-Disposition', `attachment; filename="lotzy-historico-${Date.now()}.${format}"`).send(body); }
    const limit = Math.min(500, requestedLimit); const total = results.length; const offset = (page - 1) * limit; return res.json({ total, page, limit, totalPages: Math.ceil(total / limit), data: results.slice(offset, offset + limit) });
  } catch (error) { if (error instanceof Error && error.name === 'HistoryNotFoundError') return res.status(404).json({ error: 'Base de resultados não encontrada' }); return res.status(500).json({ error: 'Falha ao processar resultados' }); }
});
export { router as historyRoutes };
