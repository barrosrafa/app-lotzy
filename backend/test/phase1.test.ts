import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
const app = createApp();
describe('fase 1', () => {
  it('expõe estatísticas históricas e ciclo', async () => { const response = await request(app).get('/api/v1/stats/temperatura?janela=10'); expect(response.status).toBe(200); expect(response.body.data).toHaveLength(25); expect(response.body.janela).toBe(10); const cycle = await request(app).get('/api/v1/stats/ciclos'); expect(cycle.status).toBe(200); expect(cycle.body).toHaveProperty('dezenasFaltantes'); });
  it('simula histórico e exporta jogos', async () => { const simulation = await request(app).post('/api/v1/tools/simulate-historical').send({ dezenas: Array.from({ length: 15 }, (_, index) => index + 1) }); expect(simulation.status).toBe(200); expect(simulation.body.totalConcursos).toBeGreaterThan(0); const exportResponse = await request(app).post('/api/v1/games/generate-random?format=csv').send({ quantity: 1, numbersPerGame: 15 }); expect(exportResponse.status).toBe(200); expect(exportResponse.headers['content-disposition']).toContain('.csv'); expect(exportResponse.text).toContain('jogo,dezenas'); });
  it('confere lote textual com linha identificável', async () => { const response = await request(app).post('/api/v1/games/check/lote?drawnNumbers=1,2,3,4,5,6,7,8,9,10,11,12,13,14,15').set('Content-Type', 'text/plain').send('1 2 3 4 5 6 7 8 9 10 11 12 13 14 15\n'); expect(response.status).toBe(200); expect(response.body.data[0].hits).toBe(15); });
});
