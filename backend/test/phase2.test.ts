import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
const app = createApp();
describe('fase 2', () => {
  it('expõe sazonalidade e tabela de preços', async () => { const seasonal = await request(app).get('/api/v1/stats/seasonal?month=9'); expect(seasonal.status).toBe(200); expect(seasonal.body.data).toHaveLength(25); const prices = await request(app).get('/api/v1/tabela-precos'); expect(prices.status).toBe(200); expect(prices.body.betPriceCents).toBe(350); });
  it('gera variações e calcula orçamento', async () => { const variations = await request(app).post('/api/v1/games/generate/variations').send({ game: Array.from({ length: 15 }, (_, index) => index + 1), count: 2 }); expect(variations.status).toBe(200); expect(variations.body.data).toHaveLength(2); const budget = await request(app).post('/api/v1/tools/bankroll-check').send({ orcamento: 3500, horizonMonths: 1 }); expect(budget.status).toBe(200); expect(budget.body.monthlyBets).toBe(10); });
  it('amplia os fechamentos W17 e W18', async () => { const wheel = await request(app).post('/api/v1/games/wheel').send({ numbers: Array.from({ length: 17 }, (_, index) => index + 1), guarantee: { ifDrawn: 15, atLeast: 15 } }); expect(wheel.status).toBe(200); expect(wheel.body.meta.system).toBe('W(17,15,15)'); expect(wheel.body.data).toHaveLength(136); });
});
