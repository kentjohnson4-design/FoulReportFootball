import { CODE_MAP } from './data/codes';
import type { Foul, Game, Official, Quarter, Team } from './types';
import { OFFICIALS, quarterLabel } from './types';

export const SIDELINE_CODES = ['SLW', 'SL5', 'UNS-SLM'];
export const TIMEOUTS_PER_HALF = 3;

export const isUNS = (code: string) => code.startsWith('UNS-') || code === 'DQ-UNS';
export const isDQ = (code: string) => code.startsWith('DQ-');
export const isPF = (code: string) => code.startsWith('PF-');

export function teamName(game: Game, t: Team | ''): string {
  if (t === 'H') return game.home.trim() || 'Home';
  if (t === 'V') return game.away.trim() || 'Visitor';
  return '—';
}

export function normPlayer(p: string): string {
  return p.trim().toUpperCase().replace(/^#/, '');
}

export function playerLabel(p: string): string {
  const n = normPlayer(p);
  if (!n) return '—';
  if (/^\d+$/.test(n)) return `#${n}`;
  if (n === 'HC') return 'Head coach';
  if (n === 'TEAM') return 'Team';
  if (n === 'BENCH') return 'Bench';
  return n;
}

export function nominalYards(code: string): number {
  const m = (CODE_MAP.get(code)?.yds ?? '').match(/^\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

/** Formats raw keypad input into mm:ss as the user types. */
export function fmtClock(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, -2)}:${d.slice(-2)}`;
}

/** Returns an error message for an invalid varsity game-clock value, or '' if fine. */
export function clockError(v: string): string {
  if (!v) return '';
  const m = v.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return 'Enter the clock as mm:ss';
  const min = +m[1];
  const sec = +m[2];
  if (sec > 59) return 'Seconds must be 00–59';
  if (min > 12 || (min === 12 && sec > 0)) return 'Varsity quarters are 12:00';
  return '';
}

export const halfOf = (q: Quarter): 1 | 2 | 'OT' => (q <= 2 ? 1 : q <= 4 ? 2 : 'OT');

export function timeoutsUsed(game: Game, team: Team, half: 1 | 2 | 'OT') {
  return game.timeouts.filter((t) => t.team === team && halfOf(t.quarter) === half);
}

export function timeoutsLeft(game: Game, team: Team, q: Quarter): number | null {
  const half = halfOf(q);
  if (half === 'OT') return null;
  return TIMEOUTS_PER_HALF - timeoutsUsed(game, team, half).length;
}

const ordinal = (n: number) => `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? 'th'}`;

export interface Alert {
  level: 'warn' | 'danger';
  text: string;
  suggestCode?: string;
}

/** Rule checks for a foul being entered or edited, against the rest of the game. */
export function draftAlerts(game: Game, draft: Foul): Alert[] {
  const alerts: Alert[] = [];
  if (!draft.team || !draft.code) return alerts;
  const others = game.fouls.filter((f) => f.id !== draft.id);
  const sameTeam = others.filter((f) => f.team === draft.team);
  const p = normPlayer(draft.player);
  const who = `${teamName(game, draft.team)} ${p ? playerLabel(p) : ''}`.trim();

  if (SIDELINE_CODES.includes(draft.code)) {
    const n = sameTeam.filter((f) => SIDELINE_CODES.includes(f.code)).length;
    const expected = n === 0 ? 'SLW' : n === 1 ? 'SL5' : 'UNS-SLM';
    if (expected !== draft.code) {
      alerts.push({
        level: 'warn',
        text: `This is ${teamName(game, draft.team)}'s ${ordinal(n + 1)} sideline infraction. The progression calls for ${expected}.`,
        suggestCode: expected,
      });
    }
    if (n >= 2) {
      alerts.push({ level: 'warn', text: 'A 3rd or later sideline infraction is an unsportsmanlike foul charged to the head coach.' });
    }
  }

  if (p && isUNS(draft.code)) {
    const prior = sameTeam.filter((f) => normPlayer(f.player) === p && isUNS(f.code));
    if (prior.length >= 1 && draft.code !== 'DQ-UNS') {
      alerts.push({
        level: 'danger',
        text: `${who} already has an unsportsmanlike foul (${prior.map((f) => f.code).join(', ')}). A second one is a disqualification.`,
        suggestCode: 'DQ-UNS',
      });
    } else if (prior.length >= 1) {
      alerts.push({ level: 'danger', text: `${who} is disqualified: second unsportsmanlike foul.` });
    } else if (draft.code === 'DQ-UNS') {
      alerts.push({ level: 'warn', text: `No earlier unsportsmanlike foul is recorded for ${who}.` });
    }
  }

  if (p && isDQ(draft.code) && draft.code !== 'DQ-UNS') {
    alerts.push({ level: 'danger', text: `${who} is disqualified.` });
  }

  if (p && !['TEAM', 'BENCH'].includes(p)) {
    const dq = sameTeam.find((f) => normPlayer(f.player) === p && isDQ(f.code));
    if (dq) {
      alerts.push({
        level: 'warn',
        text: `${who} was already disqualified (foul #${game.fouls.indexOf(dq) + 1}, ${dq.code}).`,
      });
    }
  }
  return alerts;
}

export interface DisciplineEntry {
  team: Team;
  player: string;
  uns: Foul[];
  dq: Foul[];
}

/** Everyone with at least one unsportsmanlike foul or disqualification. */
export function discipline(game: Game): DisciplineEntry[] {
  const map = new Map<string, DisciplineEntry>();
  for (const f of game.fouls) {
    if (!f.team || !(isUNS(f.code) || isDQ(f.code))) continue;
    const player = normPlayer(f.player) || '?';
    const key = `${f.team}|${player}`;
    const e = map.get(key) ?? { team: f.team, player, uns: [], dq: [] };
    if (isUNS(f.code)) e.uns.push(f);
    if (isDQ(f.code)) e.dq.push(f);
    map.set(key, e);
  }
  return [...map.values()].sort((a, b) => a.team.localeCompare(b.team) || a.player.localeCompare(b.player, undefined, { numeric: true }));
}

export function sidelineCount(game: Game, team: Team) {
  return game.fouls.filter((f) => f.team === team && SIDELINE_CODES.includes(f.code)).length;
}

export interface TeamStats {
  total: number;
  accepted: number;
  declined: number;
  offsetting: number;
  yards: number;
  uns: number;
  pf: number;
  dq: number;
  byQuarter: number[];
}

export function teamStats(game: Game, team: Team): TeamStats {
  const fs = game.fouls.filter((f) => f.team === team);
  return {
    total: fs.length,
    accepted: fs.filter((f) => f.status === 'A').length,
    declined: fs.filter((f) => f.status === 'D').length,
    offsetting: fs.filter((f) => f.status === 'O').length,
    yards: fs.filter((f) => f.status === 'A').reduce((s, f) => s + nominalYards(f.code), 0),
    uns: fs.filter((f) => isUNS(f.code)).length,
    pf: fs.filter((f) => isPF(f.code)).length,
    dq: fs.filter((f) => isDQ(f.code)).length,
    byQuarter: ([1, 2, 3, 4, 5] as Quarter[]).map((q) => fs.filter((f) => f.quarter === q).length),
  };
}

export function officialCounts(game: Game): Record<Official, number> {
  const out = Object.fromEntries(OFFICIALS.map((o) => [o, 0])) as Record<Official, number>;
  for (const f of game.fouls) if (f.official) out[f.official]++;
  return out;
}

/** Things the referee will expect on the report that are still blank. */
export function reportIssues(game: Game): string[] {
  const issues: string[] = [];
  if (!game.home.trim() || !game.away.trim()) issues.push('Home and visitor team names');
  if (!game.refereeEmail.trim()) issues.push("Referee's email address");
  if (!game.homeScore.trim() || !game.awayScore.trim()) issues.push('Final score');
  game.fouls.forEach((f, i) => {
    const missing: string[] = [];
    if (!f.team) missing.push('team');
    if (!f.code) missing.push('foul code');
    if (!f.time && f.quarter !== 5) missing.push('time');
    if (!f.side) missing.push('O/D/K/R');
    if (!f.official) missing.push('calling official');
    if (!normPlayer(f.player) && (isUNS(f.code) || isDQ(f.code) || isPF(f.code))) missing.push('player number');
    if (missing.length) issues.push(`Foul ${i + 1} (${quarterLabel(f.quarter)} ${f.code || ''}): ${missing.join(', ')}`);
  });
  return issues;
}
