import { z } from 'zod';
import { appendResult } from '../infrastructure/data/results.js';

const sources = [
  { name: 'Caixa', url: 'https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil', parse: (body: unknown) => body },
  { name: 'Guidi', url: 'https://api.guidi.dev.br/loteria/lotofacil/ultimo', parse: (body: unknown) => body },
  { name: 'Free API Loterias', url: 'https://raw.githubusercontent.com/maickon/free-apiloterias/master/lotofacil/_ultimo.json', parse: (body: unknown) => body },
] as const;
const resultSchema = z.object({ numero: z.coerce.number().int().positive(), dataApuracao: z.string().optional(), data: z.string().optional(), listaDezenas: z.array(z.union([z.string(), z.number()])).optional(), dezenas: z.array(z.union([z.string(), z.number()])).optional() }).passthrough();
function date(value: string): string { if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value; const parsed = new Date(value); if (Number.isNaN(parsed.getTime())) throw new Error(`Data inválida: ${value}`); return `${String(parsed.getUTCDate()).padStart(2, '0')}/${String(parsed.getUTCMonth() + 1).padStart(2, '0')}/${parsed.getUTCFullYear()}`; }
async function fetchLatest() { const errors: string[] = []; for (const source of sources) { try { const response = await fetch(source.url, { headers: { 'User-Agent': 'Lotzy/3.0 (+https://github.com/barrosrafa/app-lotzy)', Accept: 'application/json' }, signal: AbortSignal.timeout(10000) }); if (!response.ok) throw new Error(`HTTP ${response.status}`); const parsed = resultSchema.parse(await response.json()); const values = parsed.listaDezenas ?? parsed.dezenas; if (!values || values.length !== 15) throw new Error('15 dezenas não encontradas'); return { concurso: parsed.numero, data: date(parsed.dataApuracao ?? parsed.data ?? ''), dezenas: values.map(Number) }; } catch (error) { errors.push(`${source.name}: ${error instanceof Error ? error.message : String(error)}`); } } throw new Error(`Nenhuma fonte de resultados respondeu. ${errors.join(' | ')}`); }
const result = await fetchLatest(); if (new Set(result.dezenas).size !== 15 || result.dezenas.some((number) => !Number.isInteger(number) || number < 1 || number > 25)) throw new Error('Dezenas inválidas'); const appended = appendResult(result); console.log(JSON.stringify({ ...result, appended }));
