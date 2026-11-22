import { teamName } from './rules';
import { officialNames, schoolNames } from './stats';
import { useMemo } from 'react';
import type { Game, PeriodKey, Team, Toss } from './types';
import { CREW_NAMES, CREW_POSITIONS } from './types';
import { Chips, Field, Group, WallTimeInput } from './ui';

export function InfoTab(props: { game: Game; allGames: Game[]; update: (p: Partial<Game>) => void }) {
  const { game, update } = props;
  const schools = useMemo(() => schoolNames(props.allGames.filter((g) => g.id !== game.id)), [props.allGames, game.id]);
  const officials = useMemo(() => officialNames(props.allGames.filter((g) => g.id !== game.id)), [props.allGames, game.id]);
  const setToss = (p: Partial<Toss>) => update({ toss: { ...game.toss, ...p } });
  const setPeriod = (k: PeriodKey, which: 'start' | 'end', v: string) =>
    update({ periodTimes: { ...game.periodTimes, [k]: { ...game.periodTimes[k], [which]: v } } });
  const teamLabel = (t: Team) => `${t} · ${teamName(game, t)}`;

  return (
    <div className="form">
      <datalist id="school-names">
        {schools.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <datalist id="official-names">
        {officials.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <section className="card">
        <h3>Game</h3>
        <div className="row2">
          <Field label="Date">
            <input type="date" value={game.date} onChange={(e) => update({ date: e.target.value })} />
          </Field>
          <Field label="Level">
            <input value="Varsity" disabled />
          </Field>
        </div>
        <div className="row2">
          <Field label="Home school (H)">
            <input list="school-names" autoComplete="off" value={game.home} onChange={(e) => update({ home: e.target.value })} placeholder="Home high school" />
          </Field>
          <Field label="Visiting school (V)">
            <input list="school-names" autoComplete="off" value={game.away} onChange={(e) => update({ away: e.target.value })} placeholder="Visiting high school" />
          </Field>
        </div>
        <div className="row4">
          <Field label="H score">
            <input inputMode="numeric" value={game.homeScore} onChange={(e) => update({ homeScore: e.target.value.replace(/\D/g, '') })} />
          </Field>
          <Field label="V score">
            <input inputMode="numeric" value={game.awayScore} onChange={(e) => update({ awayScore: e.target.value.replace(/\D/g, '') })} />
          </Field>
          <Field label="H kicker #">
            <input inputMode="numeric" value={game.homeKicker} onChange={(e) => update({ homeKicker: e.target.value })} />
          </Field>
          <Field label="V kicker #">
            <input inputMode="numeric" value={game.awayKicker} onChange={(e) => update({ awayKicker: e.target.value })} />
          </Field>
        </div>
        <Field label="Referee's email" hint="Paste it from your assigning app. The report goes here.">
          <input
            type="email"
            inputMode="email"
            autoCapitalize="off"
            autoCorrect="off"
            value={game.refereeEmail}
            onChange={(e) => update({ refereeEmail: e.target.value.trim() })}
            placeholder="referee@example.com"
          />
        </Field>
      </section>

      <section className="card">
        <h3>Coin toss</h3>
        <Group label="Toss winner">
          <Chips<Team> options={['H', 'V']} value={game.toss.winner} allowClear onChange={(v) => setToss({ winner: v as Team | '' })} render={teamLabel} />
        </Group>
        <Group label="Winner's choice">
          <Chips options={['Defer', 'Receive', 'Kick', 'Defend'] as const} value={game.toss.choice} allowClear onChange={(v) => setToss({ choice: v as Toss['choice'] })} />
        </Group>
        <div className="row2">
          <Field label="Defend (goal)">
            <input value={game.toss.defendGoal} onChange={(e) => setToss({ defendGoal: e.target.value })} placeholder="e.g. North" />
          </Field>
          <div className="field">
            <span className="field-label">Receive in the 2nd half</span>
            <Chips<Team> options={['H', 'V']} value={game.toss.receive2ndHalf} allowClear onChange={(v) => setToss({ receive2ndHalf: v as Team | '' })} />
          </div>
        </div>
        <Group label="OT toss winner">
          <Chips<Team> options={['H', 'V']} value={game.toss.otWinner} allowClear onChange={(v) => setToss({ otWinner: v as Team | '' })} render={teamLabel} />
        </Group>
        <div className="row2">
          <div className="field">
            <span className="field-label">OT choice</span>
            <Chips options={['Offense', 'Defense'] as const} value={game.toss.otChoice} allowClear onChange={(v) => setToss({ otChoice: v as Toss['otChoice'] })} />
          </div>
          <Field label="OT end">
            <input value={game.toss.otEnd} onChange={(e) => setToss({ otEnd: e.target.value })} placeholder="e.g. South" />
          </Field>
        </div>
      </section>

      <section className="card">
        <h3>Period start / end (clock on the wall)</h3>
        <div className="period-grid">
          {(['1', '2', '3', '4', 'OT'] as PeriodKey[]).map((k) => (
            <div key={k} className="period-row">
              <span className="period-label">{k === 'OT' ? 'OT' : `Q${k}`}</span>
              <WallTimeInput label={`${k} start`} value={game.periodTimes[k].start} onChange={(v) => setPeriod(k, 'start', v)} />
              <WallTimeInput label={`${k} end`} value={game.periodTimes[k].end} onChange={(v) => setPeriod(k, 'end', v)} />
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>Crew</h3>
        <div className="crew-grid">
          {CREW_POSITIONS.map((p) => (
            <Field key={p} label={`${p} · ${CREW_NAMES[p]}`}>
              <input list="official-names" autoComplete="off" value={game.crew[p]} onChange={(e) => update({ crew: { ...game.crew, [p]: e.target.value } })} placeholder={p === 'D' ? 'If used' : ''} />
            </Field>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>Notes</h3>
        <textarea rows={3} value={game.notes} onChange={(e) => update({ notes: e.target.value })} placeholder="Anything else for the referee" />
      </section>
    </div>
  );
}
