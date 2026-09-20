export type ValidatedGamesPayload = {
  analysis?: {
    data?: Array<{ game?: unknown }>;
  };
};

function isGame(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((number) => typeof number === 'number' && Number.isInteger(number));
}

function gamesFromPayload(value: unknown): number[][] {
  if (!value || typeof value !== 'object') return [];
  const data = (value as ValidatedGamesPayload).analysis?.data;
  if (!Array.isArray(data)) return [];
  return data.map((entry) => entry.game).filter(isGame);
}

export function getValidatedGamesFromSession(): number[][] {
  if (typeof window === 'undefined') return [];
  const raw = window.sessionStorage.getItem('lotzy:validated-games');
  if (!raw) return [];
  try {
    return gamesFromPayload(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function getSavedGamesFromLocalStorage(): number[][] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem('lotzy:meus-jogos');
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isGame) : [];
  } catch {
    return [];
  }
}

export function saveValidatedGamesToLocalStorage(): number {
  if (typeof window === 'undefined') throw new Error('O armazenamento local só está disponível no navegador.');
  const games = getValidatedGamesFromSession();
  if (!games.length) throw new Error('Nenhum jogo validado está disponível para salvar.');
  const savedGames = getSavedGamesFromLocalStorage();
  window.localStorage.setItem('lotzy:meus-jogos', JSON.stringify([...savedGames, ...games]));
  return games.length;
}
