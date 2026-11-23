import { CODE_MAP } from './data/codes';
import { discipline, playerLabel, teamName, teamStats, timeoutsUsed } from './rules';
import type { Game, PeriodKey, Team } from './types';
import { CREW_NAMES, CREW_POSITIONS, SIDE_NAMES, STATUS_NAMES, quarterLabel } from './types';

export function fmtDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${+m[2]}/${+m[3]}/${m[1]}` : iso;
}

export function reportTitle(game: Game): string {
  return `Foul Report: ${teamName(game, 'V')} at ${teamName(game, 'H')}, ${fmtDate(game.date)}`;
}

export function reportFileName(game: Game): string {
  const safe = (s: string) => s.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `FoulReport_${game.date}_${safe(teamName(game, 'V'))}_at_${safe(teamName(game, 'H'))}.pdf`;
}

export function tossLines(game: Game): string[] {
  const t = game.toss;
  const lines: string[] = [];
  if (t.winner) lines.push(`Toss winner: ${teamName(game, t.winner)}${t.choice ? ` (${t.choice})` : ''}`);
  if (t.defendGoal) lines.push(`Defend: ${t.defendGoal}`);
  if (t.receive2ndHalf) lines.push(`Receive 2nd half: ${teamName(game, t.receive2ndHalf)}`);
  if (t.otWinner) lines.push(`OT toss: ${teamName(game, t.otWinner)}${t.otChoice ? ` (${t.otChoice})` : ''}${t.otEnd ? `, end: ${t.otEnd}` : ''}`);
  return lines;
}

export function timeoutText(game: Game, team: Team): string {
  const parts = ([1, 2, 'OT'] as const).map((h) => {
    const used = timeoutsUsed(game, team, h);
    const label = h === 'OT' ? 'OT' : `Half ${h}`;
    return `${label}: ${used.length ? used.map((t) => `${quarterLabel(t.quarter)} ${t.time || '—'}`).join(', ') : 'none'}`;
  });
  return parts.join(' | ');
}

export function periodTimeText(game: Game): string {
  const keys: PeriodKey[] = ['1', '2', '3', '4', 'OT'];
  return keys
    .filter((k) => game.periodTimes[k].start || game.periodTimes[k].end)
    .map((k) => `${k === 'OT' ? 'OT' : `Q${k}`} ${game.periodTimes[k].start || '?'}–${game.periodTimes[k].end || '?'}`)
    .join(' | ');
}

const ORDINAL = ['1st', '2nd', '3rd', '4th'];
const RULE = '------------------------------';

/**
 * Plain-text report for the email body and clipboard. Follows the paper foul report:
 * game header, then each penalty broken out line by line in the sheet's column order
 * (Q, Time, Team, Foul, O/D/K/R, #, A/D/O, Position), then timeouts, crew, toss and times.
 * Each field is on its own labelled line so it reads well in any mail app and font.
 */
export function buildTextReport(game: Game, link?: string): string {
  const L: string[] = [];
  const team = (t: Team | '') => (t ? `${t} – ${teamName(game, t)}` : '—');

  L.push('FOUL REPORT – VARSITY');
  L.push(`Date: ${fmtDate(game.date)}`);
  L.push(`Home: ${teamName(game, 'H')}   Score: ${game.homeScore || '—'}`);
  L.push(`Away: ${teamName(game, 'V')}   Score: ${game.awayScore || '—'}`);
  if (game.homeKicker || game.awayKicker) L.push(`H Kick #: ${game.homeKicker || '—'}   V Kick #: ${game.awayKicker || '—'}`);
  const start = game.periodTimes['1'].start;
  const end = game.periodTimes.OT.end || game.periodTimes['4'].end;
  if (start || end) L.push(`Start: ${start || '—'}   End: ${end || '—'}`);

  L.push('');
  L.push(`PENALTIES (${game.fouls.length})`);
  L.push(RULE);
  if (!game.fouls.length) L.push('No fouls recorded.');
  game.fouls.forEach((f, i) => {
    const name = CODE_MAP.get(f.code)?.name;
    const official = f.official ? `${f.official}${game.crew[f.official] ? ` – ${game.crew[f.official]}` : ''}` : '—';
    const player = playerLabel(f.player);
    L.push(`PENALTY ${i + 1}`);
    L.push(`  Quarter:   ${f.quarter === 5 ? 'OT' : f.quarter}`);
    L.push(`  Time:      ${f.time || '—'}`);
    L.push(`  Team:      ${team(f.team)}`);
    L.push(`  Foul:      ${f.code}${name ? ` – ${name}` : ''}`);
    L.push(`  O/D/K/R:   ${f.side ? `${f.side} – ${SIDE_NAMES[f.side]}` : '—'}`);
    L.push(`  Player #:  ${player.startsWith('#') ? player.slice(1) : player}`);
    L.push(`  A/D/O:     ${f.status} – ${STATUS_NAMES[f.status]}`);
    L.push(`  Position:  ${official}`);
    if (f.note) L.push(`  Note:      ${f.note}`);
    L.push(RULE);
  });

  L.push('');
  L.push('TOTALS');
  for (const t of ['H', 'V'] as Team[]) {
    const s = teamStats(game, t);
    L.push(`${team(t)}`);
    L.push(`  Fouls: ${s.total} (${s.accepted} accepted, ${s.declined} declined, ${s.offsetting} offsetting)`);
    L.push(`  Yards accepted (nominal): ${s.yards}`);
    L.push(`  Unsportsmanlike: ${s.uns}   Personal: ${s.pf}   DQ: ${s.dq}`);
  }
  const disc = discipline(game);
  if (disc.length) {
    L.push('');
    L.push('UNSPORTSMANLIKE / DISQUALIFICATIONS');
    for (const d of disc) {
      L.push(`  ${team(d.team)} ${playerLabel(d.player)}: ${d.uns.length} UNS${d.dq.length ? ` – DISQUALIFIED (${d.dq.map((f) => f.code).join(', ')})` : ''}`);
    }
  }

  for (const half of [1, 2, 'OT'] as const) {
    const lines = (['H', 'V'] as Team[]).map((t) => {
      const used = timeoutsUsed(game, t, half);
      return { t, text: used.length ? used.map((x) => `${quarterLabel(x.quarter)} ${x.time || '—'}`).join(', ') : '—', n: used.length };
    });
    if (half === 'OT' && lines.every((x) => !x.n)) continue;
    L.push('');
    L.push(`TIMEOUTS – ${half === 'OT' ? 'OT' : half === 1 ? '1ST HALF' : '2ND HALF'}`);
    for (const x of lines) L.push(`  ${team(x.t)}: ${x.text}`);
  }

  const crew = CREW_POSITIONS.filter((p) => game.crew[p]);
  if (crew.length) {
    L.push('');
    L.push('CREW');
    for (const p of crew) L.push(`  ${p} – ${CREW_NAMES[p]}: ${game.crew[p]}`);
  }

  const t = game.toss;
  if (t.winner || t.choice || t.defendGoal || t.receive2ndHalf) {
    L.push('');
    L.push('COIN TOSS');
    L.push(`  Toss winner: ${team(t.winner)}`);
    if (t.choice) L.push(`  Choice: ${t.choice}`);
    if (t.defendGoal) L.push(`  Defend: ${t.defendGoal}`);
    if (t.receive2ndHalf) L.push(`  Receive 2nd half: ${team(t.receive2ndHalf)}`);
  }
  if (t.otWinner || t.otChoice || t.otEnd) {
    L.push('');
    L.push('OT TOSS');
    L.push(`  Winner: ${team(t.otWinner)}`);
    if (t.otChoice) L.push(`  Choice: ${t.otChoice}`);
    if (t.otEnd) L.push(`  End: ${t.otEnd}`);
  }

  const periods = (['1', '2', '3', '4', 'OT'] as PeriodKey[]).filter((k) => game.periodTimes[k].start || game.periodTimes[k].end);
  if (periods.length) {
    L.push('');
    L.push('QUARTER TIMES');
    for (const k of periods) {
      const label = k === 'OT' ? 'OT' : ORDINAL[+k - 1];
      L.push(`  ${label}: ${game.periodTimes[k].start || '—'} – ${game.periodTimes[k].end || '—'}`);
    }
  }

  if (game.notes.trim()) {
    L.push('');
    L.push('NOTES');
    L.push(`  ${game.notes.trim()}`);
  }
  // The link is long, so it goes last where it doesn't push the report down.
  if (link) {
    L.push('');
    L.push('View this report online (sortable, with a PDF download):');
    L.push(link);
  }
  return L.join('\n');
}

/**
 * Fingerprint of the report's content (not its wording), used to tell whether a game
 * changed after it was sent. Layout changes to the report don't affect it.
 */
export function hashReport(game: Game): string {
  const content = JSON.stringify([
    game.date, game.home, game.away, game.homeScore, game.awayScore, game.homeKicker, game.awayKicker,
    game.fouls.map((f) => [f.quarter, f.time, f.team, f.code, f.side, f.player, f.status, f.official, f.note]),
    game.timeouts.map((x) => [x.team, x.quarter, x.time]),
    game.crew, game.toss, game.periodTimes, game.notes,
  ]);
  let h = 5381;
  for (let i = 0; i < content.length; i++) h = ((h << 5) + h + content.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export type SendState = 'never' | 'sent' | 'changed';

export function sendState(game: Game): SendState {
  const last = game.sentLog[game.sentLog.length - 1];
  if (!last) return 'never';
  return last.hash === hashReport(game) ? 'sent' : 'changed';
}

export const SEND_METHOD_NAMES = { 'share-pdf': 'Share PDF', 'email-text': 'Email as text', manual: 'Marked sent' } as const;

export function fmtWhen(ms: number): string {
  return new Date(ms).toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
