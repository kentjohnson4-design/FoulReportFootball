import type { Game } from './types';

const GAMES_KEY = 'frf.games.v1';
const RECENT_KEY = 'frf.recentCodes.v1';

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function nowHHMM(): string {
  const d = new Date();
  const h = d.getHours() % 12 || 12;
  return `${h}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

export function loadGames(): Game[] {
  try {
    const raw = localStorage.getItem(GAMES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(migrate) : [];
  } catch {
    return [];
  }
}

export function saveGames(games: Game[]): boolean {
  try {
    localStorage.setItem(GAMES_KEY, JSON.stringify(games));
    return true;
  } catch {
    return false;
  }
}

/** Ask the browser not to evict our data (matters most on iPhone). */
export function requestPersistentStorage() {
  try {
    navigator.storage?.persist?.();
  } catch {
    /* not supported */
  }
}

export function blankGame(prev?: Game): Game {
  const now = Date.now();
  return {
    id: uid(),
    createdAt: now,
    updatedAt: now,
    date: todayISO(),
    home: '',
    away: '',
    homeScore: '',
    awayScore: '',
    homeKicker: '',
    awayKicker: '',
    refereeEmail: '',
    crew: prev ? { ...prev.crew } : { R: '', U: '', L: '', H: '', B: '', D: '', FR: '' },
    toss: { winner: '', choice: '', defendGoal: '', receive2ndHalf: '', otWinner: '', otChoice: '', otEnd: '' },
    periodTimes: {
      '1': { start: '', end: '' },
      '2': { start: '', end: '' },
      '3': { start: '', end: '' },
      '4': { start: '', end: '' },
      OT: { start: '', end: '' },
    },
    fouls: [],
    timeouts: [],
    currentQuarter: 1,
    status: 'in-progress',
    notes: '',
  };
}

/** Fill in any fields added after a game was saved, so old games keep loading. */
function migrate(g: Partial<Game>): Game {
  const base = blankGame();
  return {
    ...base,
    ...g,
    crew: { ...base.crew, ...(g.crew ?? {}) },
    toss: { ...base.toss, ...(g.toss ?? {}) },
    periodTimes: { ...base.periodTimes, ...(g.periodTimes ?? {}) },
    fouls: g.fouls ?? [],
    timeouts: g.timeouts ?? [],
  } as Game;
}

export function importGames(json: string, existing: Game[]): Game[] {
  const data = JSON.parse(json);
  const incoming: Game[] = (Array.isArray(data) ? data : data.games ?? []).map(migrate);
  const byId = new Map(existing.map((g) => [g.id, g]));
  for (const g of incoming) {
    const cur = byId.get(g.id);
    if (!cur || g.updatedAt > cur.updatedAt) byId.set(g.id, g);
  }
  return [...byId.values()];
}

export function getRecentCodes(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function pushRecentCode(code: string) {
  try {
    const list = [code, ...getRecentCodes().filter((c) => c !== code)].slice(0, 10);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
