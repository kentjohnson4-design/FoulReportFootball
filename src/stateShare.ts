import { schoolKey } from './stats';
import { migrate, todayISO } from './store';
import type { Game, Quarter, Status, Team } from './types';

/**
 * The part of a game that is shared with other consenting officials in the same state:
 * schools, date, score and each foul's team, code, jersey number, quarter and result.
 * Crew names, clock times, notes and the referee's email are never shared.
 */
export interface SharedGame {
  owner: string;
  gameId: string;
  season: string;
  date: string;
  home: string;
  away: string;
  homeScore: string;
  awayScore: string;
  fouls: { team: Team; code: string; player: string; status: Status; quarter: Quarter }[];
  updatedAt: number;
}

/** Only finished games with both schools named are shared. */
export const isShareable = (g: Game) => !!g.home.trim() && !!g.away.trim() && (g.status === 'final' || g.date < todayISO());

export function toShared(uid: string, g: Game): SharedGame {
  return {
    owner: uid,
    gameId: g.id,
    season: g.date.slice(0, 4),
    date: g.date,
    home: g.home.trim(),
    away: g.away.trim(),
    homeScore: g.homeScore,
    awayScore: g.awayScore,
    fouls: g.fouls
      .filter((f) => f.team && f.code)
      .map((f) => ({ team: f.team as Team, code: f.code, player: f.player, status: f.status, quarter: f.quarter })),
    updatedAt: g.updatedAt,
  };
}

/**
 * Two officials may both have recorded the same game. Keep one copy per date and pair of
 * schools: the one with the most fouls, then the most recently edited.
 */
export function dedupeShared(list: SharedGame[]): SharedGame[] {
  const best = new Map<string, SharedGame>();
  for (const g of list) {
    const k = `${g.date}|${schoolKey(g.home)}|${schoolKey(g.away)}`;
    const cur = best.get(k);
    if (!cur || g.fouls.length > cur.fouls.length || (g.fouls.length === cur.fouls.length && g.updatedAt > cur.updatedAt)) best.set(k, g);
  }
  return [...best.values()];
}

/** Turns shared records into game objects so the existing team stats can use them. */
export function sharedToGames(list: SharedGame[]): Game[] {
  return list.map((s, i) =>
    migrate({
      id: `shared-${i}`,
      date: s.date,
      home: s.home,
      away: s.away,
      homeScore: s.homeScore,
      awayScore: s.awayScore,
      status: 'final',
      createdAt: s.updatedAt,
      updatedAt: s.updatedAt,
      fouls: s.fouls.map((f, j) => ({ ...f, id: `${i}-${j}`, time: '', side: '', official: '', note: '', createdAt: j })),
    }),
  );
}

