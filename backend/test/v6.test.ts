import { describe, expect, it, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { desdobrarPool, simularPool } from "../src/infrastructure/http/routes/jogos.routes.js";
import { estatisticaCache } from "../src/infrastructure/cache/EstatisticaCache.js";
import { WorkerPool } from "../src/workers/WorkerPool.js";

const app = createApp();

afterAll(() => {
  desdobrarPool.shutdown();
  simularPool.shutdown();
});

describe("Feature v6 - EstatisticaCache", () => {
  it("carrega e calcula estatísticas do último concurso em cache", () => {
    const latest = estatisticaCache.getLatest();
    expect(latest).toBeDefined();
    expect(latest.concurso.concurso).toBeGreaterThan(0);
    expect(latest.concurso.dezenas).toHaveLength(15);
    expect(latest.estatisticas.analiseUltimoSorteio).toBeDefined();
    expect(latest.estatisticas.atrasos).toHaveLength(25);
    expect(latest.estatisticas.frequencias).toHaveLength(25);
    expect(latest.estatisticas.ciclo.cicloAtual).toBeGreaterThan(0);
    expect(latest.disclaimer).toBeTruthy();
  });
});

describe("GET /api/concursos/latest", () => {
  it("retorna o último concurso e estatísticas pré-calculadas", async () => {
    const res = await request(app).get("/api/concursos/latest");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body.status).toBe("success");
    expect(res.body.concurso.concurso).toBeGreaterThan(3000);
    expect(res.body.concurso.dezenas).toHaveLength(15);
    expect(res.body.estatisticas.atrasos).toHaveLength(25);
    expect(res.body.estatisticas.ciclo).toHaveProperty("cicloAtual");
    expect(res.body.estatisticas.analiseUltimoSorteio).toHaveProperty("sum");
    expect(res.headers["cache-control"]).toContain("public");
  });

  it("funciona também sob alias /api/v1/concursos/latest", async () => {
    const res = await request(app).get("/api/v1/concursos/latest");
    expect(res.status).toBe(200);
    expect(res.body.concurso).toBeDefined();
  });
});

describe("GET /api/v1/stats/composicao", () => {
  it("retorna médias e distribuições de composição do histórico", async () => {
    const res = await request(app).get("/api/v1/stats/composicao");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.data.totalConcursos).toBeGreaterThan(0);
    expect(res.body.data.medias).toMatchObject({
      primos: expect.any(Number),
      pares: expect.any(Number),
      impares: expect.any(Number),
    });
    expect(res.body.data.distribuicoes.sequencias).toEqual({
      longas: expect.any(Number),
      curtas: expect.any(Number),
    });
    expect(res.body.disclaimer).toBeTruthy();
  });
});

describe("POST /api/jogos/desdobrar", () => {
  it("desdobra 16 dezenas em 16 combinações de 15 dezenas via worker", async () => {
    const dezenas = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
    const res = await request(app)
      .post("/api/jogos/desdobrar")
      .send({ dezenas, format: "json" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.total).toBe(16);
    expect(res.body.cartoes).toHaveLength(16);
    expect(res.body.cartoes[0]).toHaveLength(15);
  });

  it("aceita chave 'numbers' e regras com targetSize", async () => {
    const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
    const res = await request(app)
      .post("/api/jogos/desdobrar")
      .send({ numbers, regras: { targetSize: 15 } });

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(136); // C(17, 15) = 136
    expect(res.body.cartoes).toHaveLength(136);
  });

  it("retorna ndjson quando solicitado", async () => {
    const dezenas = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
    const res = await request(app)
      .post("/api/jogos/desdobrar")
      .send({ dezenas, format: "ndjson" });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/x-ndjson/);
    expect(res.text).toContain('"total":16');
  });

  it("rejeita dezenas insuficientes para o targetSize", async () => {
    const res = await request(app)
      .post("/api/jogos/desdobrar")
      .send({ dezenas: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], regras: { targetSize: 16 } });

    expect(res.status).toBe(422);
  });
});

describe("POST /api/jogos/simular", () => {
  it("cruza cartões com histórico e calcula ROI via worker", async () => {
    const cartoes = [
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
    ];

    const res = await request(app)
      .post("/api/jogos/simular")
      .send({
        cartoes,
        concursoInicio: 3770,
        concursoFim: 3782,
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.data.totalConcursos).toBe(13);
    expect(res.body.data.totalApostasSimples).toBe(26);
    expect(res.body.data.custoTotalCents).toBe(26 * 350);
    expect(res.body.data).toHaveProperty("roi");
    expect(res.body.data).toHaveProperty("roiPercentual");
    expect(res.body.data).toHaveProperty("saldoLiquidoCents");
    expect(res.body.data).toHaveProperty("acertosPorFaixa");
    expect(res.body.disclaimer).toBeTruthy();
  });

  it("aceita 'historicDraws' customizados", async () => {
    const cartoes = [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]];
    const historicDraws = [
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], // 15 acertos
    ];

    const res = await request(app)
      .post("/api/jogos/simular")
      .send({ cartoes, historicDraws });

    expect(res.status).toBe(200);
    expect(res.body.data.maiorAcerto).toBe(15);
    expect(res.body.data.acertosPorFaixa["15"]).toBe(1);
    expect(res.body.data.roi).toBeGreaterThan(0);
  });
});

describe("WorkerPool timeouts", () => {
  it("aborta e rejeita com AppError TASK_TIMEOUT quando timeout é excedido", async () => {
    const testPool = new WorkerPool<any, any>("desdobrar.worker.ts", 1, 50);
    try {
      // 20 dezenas gerando C(20,15)=15504 combinações com timeout de 1ms
      await testPool.execute({
        dezenas: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
        targetSize: 15,
      }, 1);
      expect.fail("Deveria ter lançado timeout");
    } catch (err: any) {
      expect(err.code).toBe("TASK_TIMEOUT");
      expect(err.statusCode).toBe(504);
    } finally {
      testPool.shutdown();
    }
  });
});
