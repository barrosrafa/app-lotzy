import { describe, expect, it } from 'vitest'; import request from 'supertest'; import { createApp } from '../src/app.js';
const app=createApp();
describe('API',()=>{it('expõe health e request id',async()=>{const r=await request(app).get('/health').set('X-Request-Id','test-request');expect(r.status).toBe(200);expect(r.body.status).toBe('ok');expect(r.headers['x-request-id']).toBe('test-request');});it('gera jogos aleatórios',async()=>{const r=await request(app).post('/api/v1/games/generate-random').send({quantity:2,numbersPerGame:15});expect(r.status).toBe(200);expect(r.body.data).toHaveLength(2);expect(r.body.disclaimer).toBeTruthy();});it('expõe filtros',async()=>{const r=await request(app).get('/api/v1/games/filters');expect(r.status).toBe(200);expect(r.body.data).toEqual(expect.arrayContaining([expect.objectContaining({key:'sum'})]));});it('retorna 422 em payload inválido',async()=>{const r=await request(app).post('/api/v1/games/generate-random').send({quantity:0});expect(r.status).toBe(422);expect(r.headers['content-type']).toMatch(/problem\+json/);});
  it('gera um request id quando o cliente não envia um', async () => {
    const r = await request(app).get('/health');
    expect(r.status).toBe(200);
    expect(r.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
  it('falha rapidamente com envelope matematicamente inviável', async () => {
    const r = await request(app).post('/api/v1/games/generate-filtered').send({
      quantity: 1, numbersPerGame: 15, filters: { sum: { min: 300 } },
    });
    expect(r.status).toBe(422);
    expect(r.body.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ constraint: 'sum', achievable: { min: 120, max: 270 } }),
    ]));
  });
  it('retorna conteúdo parcial e taxa de aceitação quando o orçamento termina', async () => {
    const r = await request(app).post('/api/v1/games/generate-filtered').send({
      quantity: 3, numbersPerGame: 15, budget: { maxAttemptsPerGame: 100, maxTotalMs: 50 },
      filters: { sum: { min: 195, max: 195 } },
    });
    expect([200, 206]).toContain(r.status);
    expect(r.body.meta.acceptanceRate).toBeGreaterThanOrEqual(0);
    if (r.status === 206) expect(r.body.meta.partial).toBe(true);
  });
  it('rejeita sorteio oficial com dezenas duplicadas', async () => {
    const r = await request(app).post('/api/v1/games/check').send({
      drawnNumbers: Array.from({ length: 15 }, () => 1), games: [Array.from({ length: 15 }, (_, i) => i + 1)],
    });
    expect(r.status).toBe(422);
  });
});

describe('GET /api/history', () => {
  it('normaliza o arquivo legado e pagina resultados', async () => {
    const r = await request(app).get('/api/history?limit=2');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ total: 3782, page: 1, limit: 2, totalPages: 1891 });
    expect(r.body.data[0]).toMatchObject({ concurso: 3782, data: '2026-09-17' });
    expect(r.body.data[0].dezenas).toHaveLength(15);
  });

  it('aplica intervalo de data, concurso e ordenação', async () => {
    const r = await request(app).get('/api/history?dataInicio=2026-09-15&dataFim=2026-09-17&order=asc');
    expect(r.status).toBe(200);
    expect(r.body.data.map((item: { concurso: number }) => item.concurso)).toEqual([3780, 3781, 3782]);
    const exact = await request(app).get('/api/history?concurso=3781');
    expect(exact.body.data).toHaveLength(1);
    expect(exact.body.data[0].data).toBe('2026-09-16');
  });

  it('rejeita intervalo de datas inválido', async () => {
    const r = await request(app).get('/api/history?dataInicio=2026-09-18&dataFim=2026-09-01');
    expect(r.status).toBe(400);
    expect(r.body.error).toContain('dataInicio');
  });
});
