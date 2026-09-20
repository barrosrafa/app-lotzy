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
