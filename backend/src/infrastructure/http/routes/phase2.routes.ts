import { Router } from "express";
import { z } from "zod";
import { loadResults } from "../../data/results.js";
import { priceTable } from "../../pricing/StaticPriceTable.js";
export const phase2Routes = Router();
const dozen = z.number().int().min(1).max(25);
phase2Routes.get("/seasonal", (req, res, next) => {
  try {
    const month = z.coerce.number().int().min(1).max(12).parse(req.query.month);
    const rows = loadResults().filter(
      (row) => Number(row.data.split("-")[1]) === month,
    );
    const counts = Object.fromEntries(
      Array.from({ length: 25 }, (_, i) => [i + 1, 0]),
    );
    rows.forEach((row) =>
      row.dezenas.forEach((number) => (counts[number] += 1)),
    );
    res.json({
      month,
      totalConcursos: rows.length,
      data: Array.from({ length: 25 }, (_, i) => ({
        dezena: i + 1,
        frequencia: counts[i + 1],
        percentual: Number(
          ((counts[i + 1] / Math.max(1, rows.length)) * 100).toFixed(2),
        ),
      })),
      disclaimer:
        "Sazonalidade é uma descrição histórica; não representa previsão nem altera probabilidades.",
    });
  } catch (error) {
    next(error);
  }
});
phase2Routes.get("/tabela-precos", (_req, res) =>
  res.json({
    version: priceTable.version,
    betPriceCents: priceTable.betPriceCents,
    fixedPrizeCents: priceTable.fixedPrizeCents,
    disclaimer:
      "Valores informativos e sujeitos a alteração pela operadora oficial.",
  }),
);
phase2Routes.get("/comparison", (_req, res) =>
  res.json({
    data: [
      {
        lottery: "Lotofácil",
        numbers: 25,
        drawn: 15,
        gameMin: 15,
        gameMax: 20,
        betPriceCents: priceTable.betPriceCents,
      },
      {
        lottery: "Mega-Sena",
        numbers: 60,
        drawn: 6,
        gameMin: 6,
        gameMax: 20,
        betPriceCents: null,
      },
    ],
    note: "Comparativo informativo; não há geração ou recomendação para outra loteria.",
  }),
);
