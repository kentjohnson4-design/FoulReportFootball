import { lazy, Suspense, useEffect, useState } from 'react';
import { CODE_MAP } from './data/codes';
import { FoulForm } from './FoulForm';
import { InfoTab } from './InfoTab';
import { PeriodEndModal } from './PeriodEnd';
import { clockError, discipline, halfOf, playerLabel, sidelineCount, teamName, timeoutsLeft, timeoutsUsed, TIMEOUTS_PER_HALF } from './rules';
import { uid } from './store';
import type { Foul, Game, Quarter, Team, Timeout } from './types';
import { QUARTERS, STATUS_NAMES, quarterLabel } from './types';
import { Chips, ClockInput, Field, Group, Modal } from './ui';

const ReportTab = lazy(() => import('./ReportTab'));

type Tab = 'fouls' | 'timeouts' | 'info' | 'report';

interface UndoState {
  text: string;
  prevFouls: Foul[];
  key: number;
}

export function GameView(props: { game: Game; allGames: Game[]; onChange: (g: Game) => void; onBack: () => void }) {
  const { game } = props;
  const [tab, setTab] = useState<Tab>(game.home || game.fouls.length ? 'fouls' : 'info');
  const [editing, setEditing] = useState<Foul | 'new' | null>(null);
  const [ending, setEnding] = useState<Quarter | null>(null);
  const [undo, setUndo] = useState<UndoState | null>(null);
  const update = (patch: Partial<Game>) => props.onChange({ ...game, ...patch, updatedAt: Date.now() });

  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 8000);
    return () => clearTimeout(t);
  }, [undo]);

  const changeFouls = (fouls: Foul[], text: string, extra: Partial<Game> = {}) => {
    setUndo({ text, prevFouls: game.fouls, key: Date.now() });
    update({ fouls, ...extra });
  };

  const saveFoul = (f: Foul) => {
    const idx = game.fouls.findIndex((x) => x.id === f.id);
    if (idx >= 0) {
      changeFouls(
        game.fouls.map((x) => (x.id === f.id ? f : x)),
        `Foul ${idx + 1} updated`,
      );
    } else {
      changeFouls([...game.fouls, f], `Foul ${game.fouls.length + 1} saved: ${f.team} ${f.code}`, {
        // A new foul in a later quarter means the game has moved on; follow it.
        currentQuarter: f.quarter > game.currentQuarter ? f.quarter : game.currentQuarter,
      });
    }
    setEditing(null);
  };

  const pickQuarter = (q: Quarter) => {
    const from = game.currentQuarter;
    update({ currentQuarter: q });
    // Moving into the second half without having done halftime: offer the halftime check.
    if (from <= 2 && q >= 3 && !game.periodTimes['2'].end) setEnding(2);
  };

  const q = game.currentQuarter;
  const endLabel = q === 5 ? 'End OT' : q === 4 ? 'End game' : q === 2 ? 'Halftime' : `End Q${q}`;

  return (
    <div className="game">
      <header className="topbar">
        <button type="button" className="btn ghost back" onClick={props.onBack} aria-label="All games">
          ‹ Games
        </button>
        <div className="matchup">
          <span>
            {teamName(game, 'V')} <b>{game.awayScore || ''}</b>
          </span>
          <span className="at">at</span>
          <span>
            {teamName(game, 'H')} <b>{game.homeScore || ''}</b>
          </span>
        </div>
        {game.status === 'final' && <span className="badge">Final</span>}
      </header>

      <div className="quarterbar">
        <Chips<Quarter> label="Current quarter" options={QUARTERS} value={q} onChange={(v) => v && pickQuarter(v as Quarter)} render={quarterLabel} />
        <div className="quarter-side">
          <div className="to-left" aria-label="Timeouts left this half">
            {halfOf(q) === 'OT' ? (
              <span>OT: 1 TO per team per period</span>
            ) : (
              <>
                <span>
                  TO left H <b>{timeoutsLeft(game, 'H', q)}</b>
                </span>
                <span>
                  V <b>{timeoutsLeft(game, 'V', q)}</b>
                </span>
              </>
            )}
          </div>
          <button type="button" className="btn small" onClick={() => setEnding(q)}>
            {endLabel}
          </button>
        </div>
      </div>

      <main className="content">
        {tab === 'fouls' && <FoulsTab game={game} onEdit={(f) => setEditing(f)} />}
        {tab === 'timeouts' && <TimeoutsTab game={game} update={update} />}
        {tab === 'info' && <InfoTab game={game} allGames={props.allGames} update={update} />}
        {tab === 'report' && (
          <Suspense fallback={<p className="muted pad">Loading…</p>}>
            <ReportTab game={game} update={update} />
          </Suspense>
        )}
      </main>

      {undo && (
        <div className="toast" role="status" key={undo.key}>
          <span>{undo.text}</span>
          <button
            type="button"
            className="btn small"
            onClick={() => {
              update({ fouls: undo.prevFouls });
              setUndo(null);
            }}
          >
            Undo
          </button>
        </div>
      )}

      {tab === 'fouls' && (
        <button type="button" className="fab" onClick={() => setEditing('new')}>
          <span aria-hidden>⚑</span> Flag
        </button>
      )}

      <nav className="tabbar">
        {(
          [
            ['fouls', `Fouls (${game.fouls.length})`],
            ['timeouts', 'Timeouts'],
            ['info', 'Game & toss'],
            ['report', 'Report'],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button type="button" key={k} className={tab === k ? 'on' : ''} aria-current={tab === k} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </nav>

      {editing && (
        <FoulForm
          game={game}
          allGames={props.allGames}
          initial={editing === 'new' ? undefined : editing}
          index={editing === 'new' ? undefined : game.fouls.indexOf(editing) + 1}
          onClose={() => setEditing(null)}
          onSave={saveFoul}
          onDelete={
            editing === 'new'
              ? undefined
              : () => {
                  const n = game.fouls.indexOf(editing) + 1;
                  changeFouls(
                    game.fouls.filter((x) => x.id !== editing.id),
                    `Foul ${n} deleted`,
                  );
                  setEditing(null);
                }
          }
        />
      )}

      {ending && (
        <PeriodEndModal
          game={game}
          period={ending}
          onClose={() => setEnding(null)}
          onDone={(patch, goToReport) => {
            update(patch);
            setEnding(null);
            if (goToReport) setTab('report');
          }}
        />
      )}
    </div>
  );
}

function FoulsTab(props: { game: Game; onEdit: (f: Foul) => void }) {
  const { game } = props;
  const disc = discipline(game);
  return (
    <>
      {disc.length > 0 && (
        <section className="watch">
          <h3>Unsportsmanlike watch</h3>
          {disc.map((d) => (
            <div key={`${d.team}${d.player}`} className={`watch-row ${d.dq.length ? 'dq' : ''}`}>
              <span>
                <b>{d.team}</b> {teamName(game, d.team)} {playerLabel(d.player)}
              </span>
              <span>{d.dq.length ? `DISQUALIFIED (${d.dq.map((f) => f.code).join(', ')})` : `${d.uns.length} UNS: next one is a DQ`}</span>
            </div>
          ))}
        </section>
      )}
      {(['H', 'V'] as Team[]).some((t) => sidelineCount(game, t) > 0) && (
        <p className="muted small pad-x">
          Sideline infractions: H {sidelineCount(game, 'H')} · V {sidelineCount(game, 'V')}
        </p>
      )}
      {game.fouls.length === 0 ? (
        <div className="empty">
          <p>No fouls yet.</p>
          <p className="muted">Tap “Flag” to record one. Everything saves on this device as you go, so no signal is needed.</p>
        </div>
      ) : (
        <>
          <p className="muted small hint">Tap a foul to edit or delete it.</p>
          <ol className="foul-list">
            {game.fouls.map((f, i) => {
              const c = CODE_MAP.get(f.code);
              return (
                <li key={f.id}>
                  <button type="button" className={`foul-row status-${f.status}`} onClick={() => props.onEdit(f)} aria-label={`Edit foul ${i + 1}`}>
                    <span className="n">{i + 1}</span>
                    <span className="when">
                      {quarterLabel(f.quarter)}
                      <small>{f.time || '—'}</small>
                    </span>
                    <span className={`team-badge ${f.team}`}>{f.team}</span>
                    <span className="what">
                      <b>{f.code}</b> {c?.name}
                      <small>
                        {[f.side && `${f.side}`, playerLabel(f.player), STATUS_NAMES[f.status], f.official && `by ${f.official}`].filter(Boolean).join(' · ')}
                        {(clockError(f.time) || !f.official || !f.side) && <span className="todo"> · incomplete</span>}
                      </small>
                    </span>
                    <span className="edit-mark" aria-hidden>
                      ›
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </>
  );
}

function TimeoutsTab(props: { game: Game; update: (p: Partial<Game>) => void }) {
  const { game, update } = props;
  const [edit, setEdit] = useState<Timeout | null>(null);
  const isNew = edit && !game.timeouts.some((t) => t.id === edit.id);

  const add = (team: Team) => setEdit({ id: uid(), team, quarter: game.currentQuarter, time: '', createdAt: Date.now() });
  const save = () => {
    if (!edit) return;
    update({ timeouts: isNew ? [...game.timeouts, edit] : game.timeouts.map((t) => (t.id === edit.id ? edit : t)) });
    setEdit(null);
  };

  return (
    <div className="timeouts">
      {(['H', 'V'] as Team[]).map((team) => {
        const curHalf = halfOf(game.currentQuarter);
        const left = timeoutsLeft(game, team, game.currentQuarter);
        return (
          <section key={team} className="card">
            <div className="card-head">
              <h3>
                <span className={`team-badge ${team}`}>{team}</span> {teamName(game, team)}
              </h3>
              <button type="button" className="btn primary small" disabled={left === 0} onClick={() => add(team)}>
                + Timeout
              </button>
            </div>
            {([1, 2, 'OT'] as const).map((h) => {
              const used = timeoutsUsed(game, team, h);
              const slots = h === 'OT' ? Math.max(used.length, 1) : TIMEOUTS_PER_HALF;
              return (
                <div key={h} className={`to-half ${curHalf === h ? 'current' : ''}`}>
                  <span className="to-label">{h === 'OT' ? 'OT' : `Half ${h}`}</span>
                  <div className="to-slots">
                    {Array.from({ length: slots }, (_, i) => used[i]).map((t, i) =>
                      t ? (
                        <button type="button" key={t.id} className="to-slot used" onClick={() => setEdit(t)}>
                          {quarterLabel(t.quarter)} {t.time || '—'}
                        </button>
                      ) : (
                        <span key={i} className="to-slot">
                          —
                        </span>
                      ),
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}
      <p className="muted small pad-x">3 timeouts per team per half; 1 per team in each overtime period. Tap a recorded timeout to change or remove it.</p>

      {edit && (
        <Modal
          title={`${isNew ? 'Timeout' : 'Edit timeout'}: ${teamName(game, edit.team)}`}
          onClose={() => setEdit(null)}
          footer={
            <>
              {!isNew && (
                <button
                  type="button"
                  className="btn danger ghost"
                  onClick={() => {
                    update({ timeouts: game.timeouts.filter((t) => t.id !== edit.id) });
                    setEdit(null);
                  }}
                >
                  Remove
                </button>
              )}
              <span className="spacer" />
              <button type="button" className="btn primary" onClick={save}>
                Save timeout
              </button>
            </>
          }
        >
          <Group label="Quarter">
            <Chips<Quarter> label="Quarter" options={QUARTERS} value={edit.quarter} onChange={(v) => v && setEdit({ ...edit, quarter: v as Quarter })} render={quarterLabel} />
          </Group>
          <Field label="Game clock" error={clockError(edit.time)}>
            <ClockInput value={edit.time} onChange={(time) => setEdit({ ...edit, time })} />
          </Field>
        </Modal>
      )}
    </div>
  );
}
