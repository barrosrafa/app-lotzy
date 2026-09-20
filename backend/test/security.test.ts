import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

const app = createApp();
const game = Array.from({ length: 15 }, (_, index) => index + 1);

describe("limites de segurança dos workers", () => {
  it("rejeita lote de simulação acima de 500 cartões", async () => {
    const res = await request(app)
      .post("/api/jogos/simular")
      .send({ cartoes: Array.from({ length: 501 }, () => game) });

    expect(res.status).toBe(422);
    expect(res.body.invalidParams[0].reason).toContain("500");
  });

  it("rejeita concursos históricos com dezenas duplicadas", async () => {
    const duplicatedDraw = [...game.slice(0, 14), 14];
    const res = await request(app)
      .post("/api/jogos/simular")
      .send({ cartoes: [game], historicDraws: [duplicatedDraw] });

    expect(res.status).toBe(422);
    expect(res.body.invalidParams[0].name).toBe("historicDraws.0");
  });
});
