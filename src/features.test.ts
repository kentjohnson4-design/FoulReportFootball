import { describe, expect, it } from 'vitest';
import { searchCodes } from './data/codes';
import { buildTextReport, hashReport, sendState } from './report';
import { decodeGame, encodeGame } from './share';
import { codeFrequency, officialStats, schoolNames, teamHistory } from './stats';
import { blankGame } from './store';
import type { Foul, Game } from './types';

let n = 0;
const foul = (p: Partial<Foul>): Foul => ({
  id: `f${++n}`, quarter: 1, time: '10:00', team: 'H', code: 'FST', side: 'O', player: '72',
  status: 'A', official: 'U', note: '', createdAt: n, ...p,
});
const game = (p: Partial<Game> = {}): Game => ({ ...blankGame(), home: 'Central', away: 'North Ridge', ...p });

describe('code search', () => {
  const none = new Map<string, number>();
  const codes = (q: string, f = none) => searchCodes(q, f).map((c) => c.code);
  it('puts an exact code first', () => {
    expect(codes('dpi')[0]).toBe('DPI');
    expect(codes('TGT')[0]).toBe('PF-TGT');
  });
  it('finds by name words and nicknames', () => {
    expect(codes('hold')).toEqual(expect.arrayContaining(['OH', 'DH']));
    expect(codes('hold def')).toEqual(['DH']);
    expect(codes('pi')).toEqual(expect.arrayContaining(['DPI', 'OPI']));
    expect(codes('facemask')).toEqual(expect.arrayContaining(['FM5', 'PF-FMM']));
    expect(codes('horse')).toEqual(['PF-HCT']);
    expect(codes('offside')).toEqual(['ENC']);
  });
  it('breaks ties with the user’s most called codes', () => {
    expect(codes('hold', new Map([['DH', 5], ['OH', 1]]))[0]).toBe('DH');
    expect(codes('hold', new Map([['OH', 5], ['DH', 1]]))[0]).toBe('OH');
  });
});

describe('sent tracking', () => {
  it('knows never / sent / changed', () => {
    const g = game({ fouls: [foul({})] });
    expect(sendState(g)).toBe('never');
    g.sentLog = [{ at: 1, method: 'share-pdf', hash: hashReport(g) }];
    expect(sendState(g)).toBe('sent');
    g.fouls = [...g.fouls, foul({ code: 'OH' })];
    expect(sendState(g)).toBe('changed');
  });
  it('is not affected by marking the game final', () => {
    const g = game({ fouls: [foul({})] });
    g.sentLog = [{ at: 1, method: 'manual', hash: hashReport(g) }];
    expect(sendState({ ...g, status: 'final' })).toBe('sent');
  });
});

describe('report link', () => {
  it('round-trips a game without the referee email', async () => {
    const g = game({
      refereeEmail: 'ref@example.com',
      homeScore: '21', awayScore: '14',
      crew: { ...blankGame().crew, R: 'Pat Lee', B: 'Sam Ortiz' },
      fouls: Array.from({ length: 20 }, (_, i) => foul({ code: i % 2 ? 'DPI' : 'OH', player: String(i), note: i === 3 ? 'late flag' : '' })),
    });
    const token = await encodeGame(g);
    expect(token.length).toBeLessThan(2500);
    const back = await decodeGame(token);
    expect(back.refereeEmail).toBe('');
    expect(back.fouls).toHaveLength(20);
    expect(buildTextReport(back).replace(/Referee/g, '')).toBe(buildTextReport({ ...g, refereeEmail: '' }).replace(/Referee/g, ''));
  });
  it('rejects a damaged link', async () => {
    await expect(decodeGame('xabc')).rejects.toThrow();
  });
});

describe('history and stats', () => {
  const g1 = game({
    id: 'g1', date: '2026-09-04', homeScore: '28', awayScore: '7',
    crew: { ...blankGame().crew, R: 'Pat Lee', U: 'Chris Day' },
    fouls: [foul({ official: 'R', code: 'OH' }), foul({ official: 'U', code: 'FST', team: 'V' }), foul({ official: 'U', code: 'UNS-TAU', team: 'V' })],
  });
  const g2 = game({
    id: 'g2', date: '2026-09-11', home: 'north ridge ', away: 'Eastside', homeScore: '10', awayScore: '17',
    crew: { ...blankGame().crew, R: 'pat  lee', B: 'Chris Day' },
    fouls: [foul({ official: 'R', code: 'OH', team: 'H' }), foul({ official: 'B', code: 'DPI', team: 'V' })],
  });

  it('credits flags to the official at the calling position, merging name spellings', () => {
    const stats = officialStats([g1, g2]);
    const pat = stats.find((s) => s.name.toLowerCase().includes('pat'))!;
    expect(pat.games).toHaveLength(2);
    expect(pat.flags).toHaveLength(2);
    expect(pat.positions.R).toBe(2);
    const chris = stats.find((s) => s.name === 'Chris Day')!;
    expect(chris.flags.map((f) => f.code).sort()).toEqual(['DPI', 'FST', 'UNS-TAU']);
    expect(chris.positions).toEqual({ U: 1, B: 1 });
  });

  it('builds team history with records from that team’s side', () => {
    const teams = teamHistory([g1, g2]);
    const nr = teams.find((t) => t.name.toLowerCase().trim() === 'north ridge')!;
    expect(nr.games).toHaveLength(2);
    expect(nr.record).toEqual({ w: 0, l: 2, t: 0 });
    expect(nr.fouls.map((f) => f.code).sort()).toEqual(['FST', 'OH', 'UNS-TAU']);
  });

  it('suggests each school once and counts code frequency', () => {
    expect(schoolNames([g1, g2]).filter((s) => s.toLowerCase().trim() === 'north ridge')).toHaveLength(1);
    expect(codeFrequency([g1, g2]).get('OH')).toBe(2);
  });
});

describe('team season leaders', () => {
  it('ranks penalties and players for one team', async () => {
    const { topPenalties, topPlayers } = await import('./stats');
    const fs: Foul[] = [
      foul({ code: 'OH', player: '55' }), foul({ code: 'OH', player: '55', status: 'D' }), foul({ code: 'OH', player: '60' }),
      foul({ code: 'FST', player: '72' }), foul({ code: 'UNS-TAU', player: '4' }), foul({ code: 'DQ-UNS', player: '4' }),
      foul({ code: 'DOG', player: 'TEAM' }), foul({ code: 'UNS-SLM', player: 'HC' }),
    ];
    const pens = topPenalties(fs);
    expect(pens[0]).toEqual({ code: 'OH', count: 3, accepted: 2, yards: 20 });
    expect(pens).toHaveLength(5);
    const players = topPlayers(fs);
    expect(players.map((p) => p.player)).toEqual(['4', '55', 'HC', '60', '72']);
    expect(players[0]).toMatchObject({ count: 2, uns: 2, dq: 1 });
    expect(players.find((p) => p.player === 'TEAM')).toBeUndefined();
  });
});

describe('code list upload', () => {
  it('reads a valid CSV with quotes and aliases', async () => {
    const { checkCodeList } = await import('./csv');
    const r = checkCodeList('Code,Name,Yards,Category\nOH,"Holding, Offense",10,other\nUNS-X,Taunting,15,Unsportsmanlike\nDQX,"Second ""UNS""",15+DQ,dq-uns\n');
    expect(r.errors).toEqual([]);
    expect(r.codes).toEqual([
      { code: 'OH', name: 'Holding, Offense', yds: '10', category: 'other' },
      { code: 'UNS-X', name: 'Taunting', yds: '15', category: 'uns' },
      { code: 'DQX', name: 'Second "UNS"', yds: '15+DQ', category: 'dq-uns' },
    ]);
  });
  it('rejects duplicates, bad categories and missing columns', async () => {
    const { checkCodeList } = await import('./csv');
    expect(checkCodeList('code,name\nOH,Holding').errors[0]).toMatch(/header/);
    const r = checkCodeList('code,name,yards,category\nOH,Holding,10,other\nOH,Holding again,10,spicy\n,No code,5,other');
    expect(r.errors.join(' ')).toMatch(/more than once/);
    expect(r.errors.join(' ')).toMatch(/spicy/);
    expect(r.errors.join(' ')).toMatch(/no code/);
  });
  it('round-trips the built-in list through the template', async () => {
    const { checkCodeList, toCSV } = await import('./csv');
    const { FOUL_CODES } = await import('./data/codes');
    const r = checkCodeList(toCSV(FOUL_CODES));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.codes).toEqual(FOUL_CODES.map(({ code, name, yds, category }) => ({ code, name, yds, category })));
  });
});

describe('state code lists drive the rules', () => {
  it('uses categories from a game’s own list', async () => {
    const { draftAlerts, isUNS, isDQ } = await import('./rules');
    const { registerCodes } = await import('./data/codes');
    const codes = [
      { code: 'TAUNT', name: 'Taunting', yds: '15', category: 'uns' as const },
      { code: 'EJECT2', name: 'Second UNS', yds: '15', category: 'dq-uns' as const },
      { code: 'SW1', name: 'Sideline warning', yds: 'Warn', category: 'sl-warn' as const },
      { code: 'SW2', name: 'Sideline 5', yds: '5', category: 'sl-5' as const },
      { code: 'SW3', name: 'Sideline 15', yds: '15', category: 'sl-15' as const },
    ];
    registerCodes(codes);
    const g = game({ codeSet: { id: 'xx-2026', label: 'XX 2026', codes }, fouls: [foul({ code: 'TAUNT', team: 'V', player: '9' }), foul({ code: 'SW1', player: 'TEAM' })] });
    expect(isUNS('TAUNT')).toBe(true);
    expect(isDQ('EJECT2')).toBe(true);
    expect(draftAlerts(g, foul({ code: 'TAUNT', team: 'V', player: '9' })).find((a) => a.suggestCode)?.suggestCode).toBe('EJECT2');
    expect(draftAlerts(g, foul({ code: 'SW1', player: 'TEAM' }))[0].suggestCode).toBe('SW2');
  });
});
