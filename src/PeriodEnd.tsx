import { useState } from 'react';
import { reportIssues, teamName, timeoutsUsed, TIMEOUTS_PER_HALF } from './rules';
import { nowHHMM } from './store';
import type { Game, PeriodKey, Quarter, Team } from './types';
import { Chips, Field, Modal, WallTimeInput } from './ui';

const keyOf = (q: Quarter): PeriodKey => (q === 5 ? 'OT' : (String(q) as PeriodKey));

/**
 * Guided end of a quarter, halftime, or end of game. Records the wall-clock times and
 * checks what the report still needs while the crew is still together.
 */
export function PeriodEndModal(props: {
  game: Game;
  period: Quarter;
  onClose: () => void;
  onDone: (patch: Partial<Game>, goToReport: boolean) => void;
}) {
  const { game, period } = props;
  const key = keyOf(period);
  const isHalftime = period === 2;
  const isEnd = period >= 4;
  const next = (period + 1) as Quarter;
  const nextKey = period < 5 ? keyOf(next) : null;

  const [end, setEnd] = useState(game.periodTimes[key].end || nowHHMM());
  const [nextStart, setNextStart] = useState(nextKey ? game.periodTimes[nextKey].start || (isHalftime ? '' : nowHHMM()) : '');
  const [homeScore, setHomeScore] = useState(game.homeScore);
  const [awayScore, setAwayScore] = useState(game.awayScore);
  const [receive, setReceive] = useState<Team | ''>(game.toss.receive2ndHalf);

  const times = (withNext: boolean) => {
    const pt = { ...game.periodTimes, [key]: { ...game.periodTimes[key], end } };
    if (withNext && nextKey) pt[nextKey] = { ...pt[nextKey], start: nextStart };
    return pt;
  };

  const halfIssues = reportIssues(game).filter((s) => s.startsWith('Foul') && (!isHalftime || /\((Q1|Q2) /.test(s)));
  const title = period === 5 ? 'End of overtime' : isEnd ? 'End of the 4th quarter' : isHalftime ? 'Halftime' : `End of Q${period}`;

  const footer = isEnd ? (
    <>
      {period === 4 && (
        <button
          type="button"
          className="btn"
          onClick={() =>
            props.onDone(
              {
                periodTimes: { ...times(false), OT: { ...game.periodTimes.OT, start: game.periodTimes.OT.start || nowHHMM() } },
                homeScore,
                awayScore,
                currentQuarter: 5,
              },
              false,
            )
          }
        >
          Tied: overtime
        </button>
      )}
      <span className="spacer" />
      <button
        type="button"
        className="btn primary"
        onClick={() => props.onDone({ periodTimes: times(false), homeScore, awayScore, status: 'final' }, true)}
      >
        Final: review report
      </button>
    </>
  ) : (
    <>
      <span className="spacer" />
      <button
        type="button"
        className="btn primary"
        onClick={() =>
          props.onDone(
            {
              periodTimes: times(true),
              currentQuarter: next,
              ...(isHalftime ? { toss: { ...game.toss, receive2ndHalf: receive } } : {}),
            },
            false,
          )
        }
      >
        Start Q{next}
      </button>
    </>
  );

  return (
    <Modal title={title} onClose={props.onClose} footer={footer}>
      <div className="row2">
        <Field label={`${period === 5 ? 'OT' : `Q${period}`} ended at`}>
          <WallTimeInput label="End time" value={end} onChange={setEnd} />
        </Field>
        {!isEnd && (
          <Field label={`Q${next} starts at`} hint={isHalftime ? 'Tap Now at the 3rd-quarter kickoff, or fill in later' : undefined}>
            <WallTimeInput label="Next start" value={nextStart} onChange={setNextStart} />
          </Field>
        )}
      </div>

      {isHalftime && (
        <section className="card">
          <h3>First-half timeouts</h3>
          {(['H', 'V'] as Team[]).map((t) => (
            <p key={t} className="kv">
              <span>{teamName(game, t)}</span>
              <b>
                {timeoutsUsed(game, t, 1).length} of {TIMEOUTS_PER_HALF} used
              </b>
            </p>
          ))}
          <p className="muted small">Both teams have {TIMEOUTS_PER_HALF} timeouts again for the second half.</p>
          <div className="field">
            <span className="field-label">Receiving the 2nd-half kickoff</span>
            <Chips<Team> options={['H', 'V']} value={receive} allowClear onChange={(v) => setReceive(v as Team | '')} render={(t) => `${t} · ${teamName(game, t)}`} />
          </div>
        </section>
      )}

      {isEnd && (
        <section className="card">
          <h3>Final score</h3>
          <div className="row2">
            <Field label={`${teamName(game, 'H')} (H)`}>
              <input inputMode="numeric" className="player" value={homeScore} onChange={(e) => setHomeScore(e.target.value.replace(/\D/g, ''))} />
            </Field>
            <Field label={`${teamName(game, 'V')} (V)`}>
              <input inputMode="numeric" className="player" value={awayScore} onChange={(e) => setAwayScore(e.target.value.replace(/\D/g, ''))} />
            </Field>
          </div>
        </section>
      )}

      <section className="card">
        <h3>{isEnd ? 'Before you leave' : 'Check before play resumes'}</h3>
        {(isEnd ? reportIssues({ ...game, homeScore, awayScore }) : halfIssues).length === 0 ? (
          <p className="ok">Everything the report needs is filled in.</p>
        ) : (
          <ul className="issues">
            {(isEnd ? reportIssues({ ...game, homeScore, awayScore }) : halfIssues).map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        )}
        {isEnd && !game.toss.winner && <p className="muted small">The coin toss isn't recorded (Game & toss tab).</p>}
      </section>
    </Modal>
  );
}
