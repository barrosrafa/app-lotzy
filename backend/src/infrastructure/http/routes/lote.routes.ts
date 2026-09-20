import { Router } from "express";
import { z } from "zod";
import { priceTable } from "../../pricing/StaticPriceTable.js";

export const loteRoutes = Router();
const lineSchema = z
  .array(z.number().int().min(1).max(25))
  .min(15)
  .max(20)
  .refine(
    (values) => new Set(values).size === values.length,
    "Dezenas duplicadas",
  );
function parseLines(input: string): Array<{ line: number; game: number[] }> {
  const text = input.includes("\r\n\r\n")
    ? input
        .split(/\r?\n\r?\n/)
        .slice(1)
        .join("\n")
        .replace(/--[^\n]+--/g, "")
    : input;
  return text
    .split(/\r?\n/)
    .map((line, index) => ({ line: index + 1, raw: line.trim() }))
    .filter(
      (row) =>
        row.raw && !row.raw.startsWith("--") && !/^content-/i.test(row.raw),
    )
    .map((row) => {
      let values: unknown;
      try {
        const parsed = JSON.parse(row.raw) as {
          game?: unknown;
          dezenas?: unknown;
        };
        values = Array.isArray(parsed)
          ? parsed
          : (parsed.game ?? parsed.dezenas);
      } catch {
        values = row.raw
          .replace(/^[^\d]*/, "")
          .split(/[\s,;]+/)
          .filter(Boolean)
          .map(Number);
      }
      return { line: row.line, game: lineSchema.parse(values) };
    });
}
loteRoutes.post("/", (req, res, next) => {
  try {
    const input = typeof req.body === "string" ? req.body : "";
    if (!input)
      return res
        .status(400)
        .json({ error: "Envie um arquivo TXT, CSV ou NDJSON." });
    const parsed: Array<{ line: number; game: number[] }> = [];
    const errors: Array<{ line: number; detail: string }> = [];
    input.split(/\r?\n/).forEach((_, index) => {
      try {
        const one = parseLines(input).find((entry) => entry.line === index + 1);
        if (one) parsed.push(one);
      } catch (error) {
        if (String(input.split(/\r?\n/)[index]).trim())
          errors.push({
            line: index + 1,
            detail: error instanceof Error ? error.message : "Linha inválida",
          });
      }
    });
    if (!parsed.length)
      return res.status(422).json({
        errors: errors.length
          ? errors
          : [{ line: 1, detail: "Nenhum jogo válido encontrado" }],
      });
    const drawn =
      typeof req.query.drawnNumbers === "string"
        ? req.query.drawnNumbers.split(/[\s,;]+/).map(Number)
        : [];
    const drawnSet = new Set(drawn);
    const data = parsed.map(({ line, game }) => {
      const hits = game.filter((number) => drawnSet.has(number)).length;
      return {
        line,
        game,
        hits,
        tier:
          hits >= 15
            ? "FIFTEEN"
            : hits === 14
              ? "FOURTEEN"
              : hits === 13
                ? "THIRTEEN"
                : hits === 12
                  ? "TWELVE"
                  : hits === 11
                    ? "ELEVEN"
                    : "NONE",
        fixedPrizeCents:
          hits >= 11 && hits <= 13
            ? priceTable.fixedPrizeCents[hits as 11 | 12 | 13]
            : null,
      };
    });
    res.json({
      data,
      errors,
      summary: {
        totalGames: data.length,
        invalidLines: errors.length,
        fixedPrizeTotalCents: data.reduce(
          (sum, row) => sum + (row.fixedPrizeCents ?? 0),
          0,
        ),
      },
    });
  } catch (error) {
    next(error);
  }
});
