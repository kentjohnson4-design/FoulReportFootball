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

/** Plain-text version of the report, used for the email body and clipboard. */
export function buildTextReport(game: Game): string {
  const L: string[] = [];
  L.push(`FOUL REPORT (VARSITY)`);
  L.push(`Date: ${fmtDate(game.date)}`);
  L.push(`Home: ${teamName(game, 'H')} ${game.homeScore || '—'}   Visitor: ${teamName(game, 'V')} ${game.awayScore || '—'}`);
  if (game.homeKicker || game.awayKicker) L.push(`Kicker #: Home ${game.homeKicker || '—'}, Visitor ${game.awayKicker || '—'}`);
  L.push('');
  L.push(`PENALTIES (${game.fouls.length})`);
  if (!game.fouls.length) L.push('No fouls recorded.');
  game.fouls.forEach((f, i) => {
    const c = CODE_MAP.get(f.code);
    L.push(
      `${i + 1}. ${quarterLabel(f.quarter)} ${f.time || '—'} | ${f.team || '?'} ${teamName(game, f.team)} | ${f.code} ${c?.name ?? ''} | ${
        f.side ? SIDE_NAMES[f.side] : '—'
      } | ${playerLabel(f.player)} | ${STATUS_NAMES[f.status]} | Called by ${f.official || '—'}${f.note ? ` | Note: ${f.note}` : ''}`,
    );
  });
  L.push('');
  L.push('TOTALS');
  for (const t of ['H', 'V'] as Team[]) {
    const s = teamStats(game, t);
    L.push(
      `${teamName(game, t)}: ${s.total} fouls (${s.accepted} accepted, ${s.declined} declined, ${s.offsetting} offsetting), ${s.yards} yds accepted (nominal), ${s.uns} unsportsmanlike, ${s.pf} personal, ${s.dq} DQ`,
    );
  }
  const disc = discipline(game);
  if (disc.length) {
    L.push('');
    L.push('UNSPORTSMANLIKE / DISQUALIFICATIONS');
    for (const d of disc) {
      L.push(
        `${teamName(game, d.team)} ${playerLabel(d.player)}: ${d.uns.length} UNS${d.dq.length ? `, DISQUALIFIED (${d.dq.map((f) => f.code).join(', ')})` : ''}`,
      );
    }
  }
  L.push('');
  L.push('TIMEOUTS');
  for (const t of ['H', 'V'] as Team[]) L.push(`${teamName(game, t)}: ${timeoutText(game, t)}`);
  const toss = tossLines(game);
  if (toss.length) {
    L.push('');
    L.push('COIN TOSS');
    L.push(...toss);
  }
  const times = periodTimeText(game);
  if (times) {
    L.push('');
    L.push(`PERIOD TIMES: ${times}`);
  }
  const crew = CREW_POSITIONS.filter((p) => game.crew[p]).map((p) => `${p} (${CREW_NAMES[p]}): ${game.crew[p]}`);
  if (crew.length) {
    L.push('');
    L.push('CREW');
    L.push(...crew);
  }
  if (game.notes.trim()) {
    L.push('');
    L.push(`NOTES: ${game.notes.trim()}`);
  }
  return L.join('\n');
}
