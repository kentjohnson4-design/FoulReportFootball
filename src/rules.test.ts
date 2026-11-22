import { describe, expect, it } from 'vitest';
import { FOUL_CODES } from './data/codes';
import { buildTextReport } from './report';
import { clockError, discipline, draftAlerts, fmtClock, nominalYards, reportIssues, teamStats, timeoutsLeft } from './rules';
import { blankGame } from './store';
import type { Foul, Game } from './types';

let n = 0;
const foul = (p: Partial<Foul>): Foul => ({
  id: `f${++n}`,
  quarter: 1,
  time: '10:00',
  team: 'H',
  code: 'FST',
  side: 'O',
  player: '72',
  status: 'A',
  official: 'U',
  note: '',
  createdAt: n,
  ...p,
});
const game = (fouls: Foul[] = []): Game => ({ ...blankGame(), home: 'Central', away: 'North', fouls });

describe('code list', () => {
  it('has all 81 codes from the 2026 sheet, with no duplicates', () => {
    expect(FOUL_CODES).toHaveLength(81);
    expect(new Set(FOUL_CODES.map((c) => c.code)).size).toBe(81);
  });
  it('parses nominal yardage', () => {
    expect(nominalYards('DPI')).toBe(15);
    expect(nominalYards('DQ-FLG')).toBe(15);
    expect(nominalYards('ING')).toBe(5);
    expect(nominalYards('IFP')).toBe(5);
    expect(nominalYards('SLW')).toBe(0);
  });
});

describe('clock', () => {
  it('formats keypad input', () => {
    expect(fmtClock('7')).toBe('7');
    expect(fmtClock('714')).toBe('7:14');
    expect(fmtClock('1200')).toBe('12:00');
    expect(fmtClock('12:345')).toBe('12:34');
  });
  it('validates varsity clock', () => {
    expect(clockError('7:14')).toBe('');
    expect(clockError('12:00')).toBe('');
    expect(clockError('12:01')).not.toBe('');
    expect(clockError('7:60')).not.toBe('');
  });
});

describe('unsportsmanlike tracking', () => {
  it('suggests DQ-UNS on a second UNS by the same player', () => {
    const g = game([foul({ code: 'UNS-TAU', team: 'V', player: '22' })]);
    const a = draftAlerts(g, foul({ code: 'UNS-LNG', team: 'V', player: '22' }));
    expect(a.some((x) => x.level === 'danger' && x.suggestCode === 'DQ-UNS')).toBe(true);
  });
  it('does not mix up teams or players', () => {
    const g = game([foul({ code: 'UNS-TAU', team: 'V', player: '22' })]);
    expect(draftAlerts(g, foul({ code: 'UNS-TAU', team: 'H', player: '22' }))).toHaveLength(0);
    expect(draftAlerts(g, foul({ code: 'UNS-TAU', team: 'V', player: '23' }))).toHaveLength(0);
  });
  it('matches "#22" and "22" as the same player', () => {
    const g = game([foul({ code: 'UNS-TAU', team: 'V', player: '#22' })]);
    expect(draftAlerts(g, foul({ code: 'UNS-ROH', team: 'V', player: '22' })).some((x) => x.suggestCode === 'DQ-UNS')).toBe(true);
  });
  it('lists players on watch and disqualified', () => {
    const g = game([
      foul({ code: 'UNS-TAU', team: 'V', player: '22' }),
      foul({ code: 'DQ-UNS', team: 'V', player: '22' }),
      foul({ code: 'UNS-ROH', team: 'H', player: '5' }),
    ]);
    const d = discipline(g);
    expect(d.find((x) => x.player === '22')?.dq).toHaveLength(1);
    expect(d.find((x) => x.player === '5')?.uns).toHaveLength(1);
  });
});

describe('sideline progression', () => {
  it('expects SLW, then SL5, then UNS-SLM', () => {
    let g = game();
    expect(draftAlerts(g, foul({ code: 'SL5', player: 'TEAM' }))[0].suggestCode).toBe('SLW');
    g = game([foul({ code: 'SLW', player: 'TEAM' })]);
    expect(draftAlerts(g, foul({ code: 'SLW', player: 'TEAM' }))[0].suggestCode).toBe('SL5');
    g = game([foul({ code: 'SLW', player: 'TEAM' }), foul({ code: 'SL5', player: 'TEAM' })]);
    expect(draftAlerts(g, foul({ code: 'SL5', player: 'TEAM' }))[0].suggestCode).toBe('UNS-SLM');
  });
  it('treats a second head-coach UNS as a disqualification', () => {
    const g = game([foul({ code: 'SLW', player: 'TEAM' }), foul({ code: 'SL5', player: 'TEAM' }), foul({ code: 'UNS-SLM', player: 'HC' })]);
    expect(draftAlerts(g, foul({ code: 'UNS-SLM', player: 'HC' })).some((x) => x.suggestCode === 'DQ-UNS')).toBe(true);
  });
});

describe('stats and timeouts', () => {
  it('counts yards only for accepted fouls', () => {
    const g = game([foul({ code: 'DPI', team: 'V', side: 'D' }), foul({ code: 'OH', team: 'V', status: 'D' }), foul({ code: 'FST', team: 'V' })]);
    const s = teamStats(g, 'V');
    expect(s.total).toBe(3);
    expect(s.yards).toBe(20);
    expect(s.declined).toBe(1);
  });
  it('tracks timeouts per half', () => {
    const g = game();
    g.timeouts = [
      { id: 't1', team: 'H', quarter: 1, time: '3:00', createdAt: 1 },
      { id: 't2', team: 'H', quarter: 2, time: '0:40', createdAt: 2 },
    ];
    expect(timeoutsLeft(g, 'H', 2)).toBe(1);
    expect(timeoutsLeft(g, 'H', 3)).toBe(3);
    expect(timeoutsLeft(g, 'V', 1)).toBe(3);
  });
});

describe('report', () => {
  it('includes every penalty with all its details', () => {
    const g = game([foul({ code: 'DPI', team: 'V', side: 'D', player: '4', official: 'B', time: '7:14', quarter: 2 })]);
    g.refereeEmail = 'ref@example.com';
    const text = buildTextReport(g);
    expect(text).toContain('1. Q2 7:14 | V North | DPI Pass Interference - Defense | Defense | #4 | Accepted | Called by B');
  });
  it('flags incomplete fouls', () => {
    const g = game([foul({ official: '', time: '' })]);
    expect(reportIssues(g).some((s) => s.includes('time, calling official'))).toBe(true);
  });
});
