import type { Response } from "express";

export type ExportFormat = "csv" | "txt" | "json" | "ndjson" | "sql";
export function exportGames(
  games: number[][],
  format: ExportFormat,
): { contentType: string; extension: string; body: string } {
  if (format === "csv")
    return {
      contentType: "text/csv",
      extension: "csv",
      body:
        [
          "jogo,dezenas",
          ...games.map((game, index) => `${index + 1},"${game.join(" ")}"`),
        ].join("\n") + "\n",
    };
  if (format === "txt")
    return {
      contentType: "text/plain",
      extension: "txt",
      body: games.map((game) => game.join(" ")).join("\n") + "\n",
    };
  if (format === "sql")
    return {
      contentType: "text/plain",
      extension: "sql",
      body:
        games
          .map(
            (game, index) =>
              `INSERT INTO jogos (numero, dezenas) VALUES (${index + 1}, ARRAY[${game.join(",")}]);`,
          )
          .join("\n") + "\n",
    };
  if (format === "ndjson")
    return {
      contentType: "application/x-ndjson",
      extension: "ndjson",
      body:
        games
          .map((game, index) =>
            JSON.stringify({ jogo: index + 1, dezenas: game }),
          )
          .join("\n") + "\n",
    };
  return {
    contentType: "application/json",
    extension: "json",
    body: JSON.stringify(
      games.map((game) => ({ game })),
      null,
      2,
    ),
  };
}
export function sendGamesExport(
  res: Response,
  games: number[][],
  format: ExportFormat,
) {
  const output = exportGames(games, format);
  return res
    .type(output.contentType)
    .set(
      "Content-Disposition",
      `attachment; filename="lotzy-jogos-${Date.now()}.${output.extension}"`,
    )
    .send(output.body);
}
