import { isDQ, isPF, isUNS, nominalYards, teamStats } from './rules';
import type { CrewPos, Foul, Game, Team } from './types';
import { CREW_POSITIONS } from './types';

/** Case- and spacing-insensitive key, so "John  Smith" and "john smith" are one person. */
export const nameKey = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

export function seasonsOf(games: Game[]): string[] {
  const years = new Set(games.map((g) => g.date.slice(0, 4)).filter((y) => /^\d{4}$/.test(y)));
  years.add(String(new Date().getFullYear()));
  return [...years].sort().reverse();
}

export const inSeason = (g: Game, season: string) => season === 'all' || g.date.startsWith(season);

/** Distinct names in the order most recently used, for autocomplete. */
function distinctNames(values: { name: string; at: number }[]): string[] {
  const best = new Map<string, { name: string; at: number }>();
  for (const v of values) {
    const k = nameKey(v.name);
    if (!k) continue;
    const cur = best.get(k);
    if (!cur || v.at > cur.at) best.set(k, { name: v.name.trim(), at: v.at });
  }
  return [...best.values()].sort((a, b) => b.at - a.at).map((v) => v.name);
}

export const schoolNames = (games: Game[]) =>
  distinctNames(games.flatMap((g) => [{ name: g.home, at: g.updatedAt }, { name: g.away, at: g.updatedAt }]));

export const officialNames = (games: Game[]) =>
  distinctNames(games.flatMap((g) => CREW_POSITIONS.map((p) => ({ name: g.crew[p], at: g.updatedAt }))));

export function codeFrequency(games: Game[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const g of games) for (const f of g.fouls) if (f.code) m.set(f.code, (m.get(f.code) ?? 0) + 1);
  return m;
}

export function topCodes(fouls: Foul[], n = 3): [string, number][] {
  return [...codeFrequency([{ fouls } as Game]).entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n);
}

export interface FoulSummary {
  total: number;
  accepted: number;
  uns: number;
  pf: number;
  dq: number;
}

export function summarize(fouls: Foul[]): FoulSummary {
  return {
    total: fouls.length,
    accepted: fouls.filter((f) => f.status === 'A').length,
    uns: fouls.filter((f) => isUNS(f.code)).length,
    pf: fouls.filter((f) => isPF(f.code)).length,
    dq: fouls.filter((f) => isDQ(f.code)).length,
  };
}

export interface OfficialGame {
  game: Game;
  positions: CrewPos[];
  flags: Foul[];
}

export interface OfficialStats {
  name: string;
  games: OfficialGame[];
  positions: Partial<Record<CrewPos, number>>;
  flags: Foul[];
}

/** Per-official totals. Fouls are credited to whoever was entered at the calling position. */
export function officialStats(games: Game[]): OfficialStats[] {
  const map = new Map<string, OfficialStats>();
  for (const g of [...games].sort((a, b) => b.date.localeCompare(a.date))) {
    const perGame = new Map<string, OfficialGame>();
    for (const pos of CREW_POSITIONS) {
      const name = g.crew[pos]?.trim();
      if (!name) continue;
      const k = nameKey(name);
      const e = map.get(k) ?? { name, games: [], positions: {}, flags: [] };
      map.set(k, e);
      e.positions[pos] = (e.positions[pos] ?? 0) + 1;
      let og = perGame.get(k);
      if (!og) {
        og = { game: g, positions: [], flags: [] };
        perGame.set(k, og);
        e.games.push(og);
      }
      og.positions.push(pos);
    }
    for (const f of g.fouls) {
      const name = f.official ? g.crew[f.official]?.trim() : '';
      if (!name) continue;
      const k = nameKey(name);
      map.get(k)!.flags.push(f);
      perGame.get(k)!.flags.push(f);
    }
  }
  return [...map.values()].sort((a, b) => b.games.length - a.games.length || a.name.localeCompare(b.name));
}

export interface TeamGame {
  game: Game;
  side: Team;
  opponent: string;
  result: 'W' | 'L' | 'T' | '';
  fouls: Foul[];
  yards: number;
}

export interface TeamHistory {
  name: string;
  games: TeamGame[];
  fouls: Foul[];
  record: { w: number; l: number; t: number };
}

export function teamHistory(games: Game[]): TeamHistory[] {
  const map = new Map<string, TeamHistory>();
  for (const g of [...games].sort((a, b) => b.date.localeCompare(a.date))) {
    for (const side of ['H', 'V'] as Team[]) {
      const name = (side === 'H' ? g.home : g.away).trim();
      if (!name) continue;
      const k = nameKey(name);
      const e = map.get(k) ?? { name, games: [], fouls: [], record: { w: 0, l: 0, t: 0 } };
      map.set(k, e);
      const mine = side === 'H' ? g.homeScore : g.awayScore;
      const theirs = side === 'H' ? g.awayScore : g.homeScore;
      let result: TeamGame['result'] = '';
      if (mine !== '' && theirs !== '') {
        result = +mine > +theirs ? 'W' : +mine < +theirs ? 'L' : 'T';
        e.record[result === 'W' ? 'w' : result === 'L' ? 'l' : 't']++;
      }
      const fouls = g.fouls.filter((f) => f.team === side);
      e.fouls.push(...fouls);
      e.games.push({ game: g, side, opponent: (side === 'H' ? g.away : g.home).trim() || (side === 'H' ? 'Visitor' : 'Home'), result, fouls, yards: teamStats(g, side).yards });
    }
  }
  return [...map.values()].sort((a, b) => b.games.length - a.games.length || a.name.localeCompare(b.name));
}

export const perGame = (n: number, games: number) => (games ? (n / games).toFixed(1) : '0');

export interface PlayerTally {
  player: string;
  count: number;
  accepted: number;
  uns: number;
  dq: number;
  codes: [string, number][];
}

/**
 * The players a team was flagged for most often. Players are identified by jersey number
 * within that team; team, bench and unnumbered fouls are left out, the head coach is kept.
 */
export function topPlayers(fouls: Foul[], n = 5): PlayerTally[] {
  const map = new Map<string, Foul[]>();
  for (const f of fouls) {
    const p = f.player.trim().toUpperCase().replace(/^#/, '');
    if (!p || p === 'TEAM' || p === 'BENCH') continue;
    map.set(p, [...(map.get(p) ?? []), f]);
  }
  return [...map.entries()]
    .map(([player, fs]) => ({
      player,
      count: fs.length,
      accepted: fs.filter((f) => f.status === 'A').length,
      uns: fs.filter((f) => isUNS(f.code)).length,
      dq: fs.filter((f) => isDQ(f.code)).length,
      codes: topCodes(fs, 3),
    }))
    .sort((a, b) => b.count - a.count || b.uns + b.dq - (a.uns + a.dq) || a.player.localeCompare(b.player, undefined, { numeric: true }))
    .slice(0, n);
}

export interface CodeTally {
  code: string;
  count: number;
  accepted: number;
  yards: number;
}

/** A team's most-called penalties, with how many were accepted and the nominal yards. */
export function topPenalties(fouls: Foul[], n = 5): CodeTally[] {
  return topCodes(fouls, n).map(([code, count]) => {
    const fs = fouls.filter((f) => f.code === code && f.status === 'A');
    return { code, count, accepted: fs.length, yards: fs.reduce((s, f) => s + nominalYards(f.code), 0) };
  });
}
