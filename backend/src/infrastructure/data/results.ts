import fs from "node:fs";
import path from "node:path";

export type LegacyRow = [number | string, string, ...number[]];
export type HistoryResult = {
  concurso: number;
  data: string;
  dezenas: number[];
  premiacoes?: Record<string, number>;
  acumulado: boolean;
  valorEstimadoProximoConcurso?: number;
};

type ResultsFile = { ["Todos os Resultados"]: unknown[] };

export function resultsPath(): string {
  const candidates = [
    path.join(process.cwd(), "db", "resultados.json"),
    path.join(process.cwd(), "..", "db", "resultados.json"),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    const error = new Error("Base de resultados não encontrada");
    error.name = "HistoryNotFoundError";
    throw error;
  }
  return found;
}

export function normalizeDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const [day, month, year] = value.split("/");
  return `${year}-${month}-${day}`;
}

export function loadResults(): HistoryResult[] {
  const parsed: unknown = JSON.parse(fs.readFileSync(resultsPath(), "utf8"));
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !Array.isArray((parsed as ResultsFile)["Todos os Resultados"])
  )
    throw new Error("Formato de resultados inválido");
  return (parsed as ResultsFile)["Todos os Resultados"]
    .slice(1)
    .flatMap((row): HistoryResult[] => {
      if (
        !Array.isArray(row) ||
        row.length < 17 ||
        (typeof row[0] !== "number" && typeof row[0] !== "string") ||
        typeof row[1] !== "string"
      )
        return [];
      const concurso = Number(row[0]);
      const dezenas = row
        .slice(2)
        .filter((value): value is number => typeof value === "number")
        .sort((a, b) => a - b);
      if (!Number.isSafeInteger(concurso) || dezenas.length !== 15) return [];
      return [
        { concurso, data: normalizeDate(row[1]), dezenas, acumulado: false },
      ];
    });
}

export function appendResult(result: {
  concurso: number;
  data: string;
  dezenas: number[];
}): boolean {
  const file = resultsPath();
  const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as ResultsFile;
  const rows = parsed["Todos os Resultados"];
  const exists = rows
    .slice(1)
    .some((row) => Array.isArray(row) && Number(row[0]) === result.concurso);
  if (exists) return false;
  const [year, month, day] = normalizeDate(result.data).split("-");
  rows.push([
    result.concurso,
    `${day}/${month}/${year}`,
    ...[...result.dezenas].sort((a, b) => a - b),
  ]);
  const header = rows[0];
  const dataRows = rows.slice(1) as LegacyRow[];
  dataRows.sort((a, b) => Number(a[0]) - Number(b[0]));
  rows.splice(0, rows.length, header, ...dataRows);
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(parsed, null, 2)}\n`);
  fs.renameSync(temporary, file);
  return true;
}

export function clearResultsCache(): void {
  /* loadResults intentionally reads the file on every call; this hook documents invalidation. */
}
