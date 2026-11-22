import { useEffect, useState } from 'react';
import { CODE_MAP } from './data/codes';
import { buildPdf } from './pdf';
import { fmtDate, periodTimeText, reportFileName, timeoutText, tossLines } from './report';
import { discipline, playerLabel, teamName, teamStats } from './rules';
import { decodeGame } from './share';
import { downloadBlob } from './store';
import type { Game, Team } from './types';
import { CREW_NAMES, CREW_POSITIONS, SIDE_NAMES, STATUS_NAMES, quarterLabel } from './types';

type Filter = 'all' | Team;

/** Read-only view of a report opened from a shared link. */
export default function ReportViewer(props: { token: string; onClose: () => void; onSave: (g: Game) => void }) {
  const [game, setGame] = useState<Game | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    decodeGame(props.token)
      .then(setGame)
      .catch((e) => setError(e instanceof Error && e.message.startsWith('This') ? e.message : 'This report link is damaged or incomplete.'));
  }, [props.token]);

  if (error)
    return (
      <div className="viewer">
        <h1>Foul report</h1>
        <p className="alert danger">{error}</p>
        <button type="button" className="btn" onClick={props.onClose}>
          Open Foul Report Football
        </button>
      </div>
    );
  if (!game) return <p className="muted pad">Opening report…</p>;

  const fouls = game.fouls.map((f, i) => ({ f, n: i + 1 })).filter(({ f }) => filter === 'all' || f.team === filter);
  const disc = discipline(game);
  const crew = CREW_POSITIONS.filter((p) => game.crew[p]);

  return (
    <div className="viewer">
      <header className="viewer-head">
        <p className="muted small">Foul report · Varsity · {fmtDate(game.date)}</p>
        <h1>
          {teamName(game, 'V')} {game.awayScore} <span className="at">at</span> {teamName(game, 'H')} {game.homeScore}
        </h1>
        <div className="send-buttons">
          <button type="button" className="btn primary" onClick={() => downloadBlob(buildPdf(game), reportFileName(game))}>
            Download PDF
          </button>
          <button
            type="button"
            className="btn"
            disabled={saved}
            onClick={() => {
              props.onSave(game);
              setSaved(true);
            }}
          >
            {saved ? 'Saved to your games' : 'Save to my games'}
          </button>
          <button type="button" className="btn ghost" onClick={props.onClose}>
            Open the app
          </button>
        </div>
      </header>

      <section className="card">
        <div className="card-head">
          <h3>Penalties ({game.fouls.length})</h3>
          <div className="chips" role="group" aria-label="Filter by team">
            {(['all', 'H', 'V'] as Filter[]).map((f) => (
              <button key={f} type="button" className={`chip small-chip${filter === f ? ' on' : ''}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {f === 'all' ? 'Both' : teamName(game, f)}
              </button>
            ))}
          </div>
        </div>
        {fouls.length === 0 ? (
          <p className="muted">No fouls recorded.</p>
        ) : (
          <>
          <ol className="penalty-cards">
            {fouls.map(({ f, n }) => (
              <li key={f.id} className={f.status !== 'A' ? 'dim' : ''}>
                <div className="pc-top">
                  <span className="muted">{n}.</span>
                  <b>{quarterLabel(f.quarter)} {f.time || '—'}</b>
                  <span className={`team-badge small ${f.team}`}>{f.team}</span>
                  <span>{teamName(game, f.team)}</span>
                </div>
                <div>
                  <b>{f.code}</b> {CODE_MAP.get(f.code)?.name}
                </div>
                <div className="pc-meta">
                  <span>{f.side ? SIDE_NAMES[f.side] : '—'}</span>
                  <span>{playerLabel(f.player)}</span>
                  <span>{STATUS_NAMES[f.status]}</span>
                  <span>Called by {f.official ? `${f.official}${game.crew[f.official] ? ` (${game.crew[f.official]})` : ''}` : '—'}</span>
                </div>
                {f.note && <div className="muted small">Note: {f.note}</div>}
              </li>
            ))}
          </ol>
          <div className="table-wrap penalty-table">
            <table className="stats penalties">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Q</th>
                  <th>Time</th>
                  <th>Team</th>
                  <th>Foul</th>
                  <th>O/D/K/R</th>
                  <th>Player</th>
                  <th>A/D/O</th>
                  <th>Called by</th>
                </tr>
              </thead>
              <tbody>
                {fouls.map(({ f, n }) => (
                  <tr key={f.id} className={f.status !== 'A' ? 'dim' : ''}>
                    <td>{n}</td>
                    <td>{quarterLabel(f.quarter)}</td>
                    <td>{f.time || '—'}</td>
                    <td>
                      <span className={`team-badge small ${f.team}`}>{f.team}</span>
                    </td>
                    <td className="left">
                      <b>{f.code}</b> {CODE_MAP.get(f.code)?.name}
                      {f.note && <div className="muted small">Note: {f.note}</div>}
                    </td>
                    <td title={f.side ? SIDE_NAMES[f.side] : ''}>{f.side || '—'}</td>
                    <td>{playerLabel(f.player)}</td>
                    <td>{STATUS_NAMES[f.status]}</td>
                    <td title={f.official ? game.crew[f.official] : ''}>{f.official || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>

      <section className="card">
        <h3>Totals</h3>
        <div className="table-wrap">
          <table className="stats">
            <thead>
              <tr>
                <th />
                <th>Fouls</th>
                <th>Acc</th>
                <th>Dec</th>
                <th>Off</th>
                <th>Yds*</th>
                <th>UNS</th>
                <th>PF</th>
                <th>DQ</th>
              </tr>
            </thead>
            <tbody>
              {(['H', 'V'] as Team[]).map((t) => {
                const s = teamStats(game, t);
                return (
                  <tr key={t}>
                    <th>{teamName(game, t)}</th>
                    <td>{s.total}</td>
                    <td>{s.accepted}</td>
                    <td>{s.declined}</td>
                    <td>{s.offsetting}</td>
                    <td>{s.yards}</td>
                    <td>{s.uns}</td>
                    <td>{s.pf}</td>
                    <td>{s.dq}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="muted small">*Nominal penalty yards for accepted fouls, from the code sheet.</p>
      </section>

      {disc.length > 0 && (
        <section className="card">
          <h3>Unsportsmanlike & disqualifications</h3>
          <ul className="disc">
            {disc.map((d) => (
              <li key={`${d.team}${d.player}`} className={d.dq.length ? 'dq' : ''}>
                <b>{teamName(game, d.team)}</b> {playerLabel(d.player)}: {d.uns.length} UNS
                {d.dq.length > 0 && <strong> · DISQUALIFIED ({d.dq.map((f) => f.code).join(', ')})</strong>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h3>Timeouts, toss and times</h3>
        {(['H', 'V'] as Team[]).map((t) => (
          <p key={t} className="kv">
            <span>{teamName(game, t)}</span>
            <span>{timeoutText(game, t)}</span>
          </p>
        ))}
        {tossLines(game).map((l) => (
          <p key={l} className="kv">
            <span>{l.split(': ')[0]}</span>
            <span>{l.split(': ').slice(1).join(': ')}</span>
          </p>
        ))}
        {periodTimeText(game) && (
          <p className="kv">
            <span>Period times</span>
            <span>{periodTimeText(game)}</span>
          </p>
        )}
        {(game.homeKicker || game.awayKicker) && (
          <p className="kv">
            <span>Kicker #</span>
            <span>
              H {game.homeKicker || '—'} · V {game.awayKicker || '—'}
            </span>
          </p>
        )}
      </section>

      {crew.length > 0 && (
        <section className="card">
          <h3>Crew</h3>
          {crew.map((p) => (
            <p key={p} className="kv">
              <span>
                {p} · {CREW_NAMES[p]}
              </span>
              <span>{game.crew[p]}</span>
            </p>
          ))}
        </section>
      )}

      {game.notes.trim() && (
        <section className="card">
          <h3>Notes</h3>
          <p>{game.notes}</p>
        </section>
      )}
    </div>
  );
}
