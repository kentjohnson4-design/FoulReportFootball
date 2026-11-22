import { useMemo, useState } from 'react';
import { CODE_MAP } from './data/codes';
import { fmtDate } from './report';
import { teamName } from './rules';
import { officialStats, perGame, summarize, teamHistory, topCodes } from './stats';
import type { CrewPos, Foul, Game } from './types';
import { CREW_POSITIONS } from './types';

function CodeList(props: { fouls: Foul[] }) {
  const top = topCodes(props.fouls, 3);
  if (!top.length) return null;
  return (
    <p className="small">
      <span className="muted">Most called: </span>
      {top.map(([c, n], i) => (
        <span key={c} title={CODE_MAP.get(c)?.name}>
          {i > 0 && ', '}
          <b>{c}</b> ×{n}
        </span>
      ))}
    </p>
  );
}

function Metric(props: { label: string; value: string | number }) {
  return (
    <div className="metric">
      <b>{props.value}</b>
      <span>{props.label}</span>
    </div>
  );
}

export function OfficialsView(props: { games: Game[]; onOpen: (id: string) => void }) {
  const stats = useMemo(() => officialStats(props.games), [props.games]);
  const [open, setOpen] = useState<string | null>(null);
  if (!stats.length)
    return (
      <div className="empty">
        <p>No officials yet.</p>
        <p className="muted">Enter crew names on a game's “Game & toss” tab. Each flag is credited to the official at the position that called it.</p>
      </div>
    );
  return (
    <div className="stat-list">
      {stats.map((o) => {
        const s = summarize(o.flags);
        const positions = CREW_POSITIONS.filter((p) => o.positions[p])
          .map((p) => `${p}×${o.positions[p as CrewPos]}`)
          .join(' ');
        const isOpen = open === o.name;
        return (
          <section key={o.name} className="card">
            <button type="button" className="stat-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : o.name)}>
              <span>
                <b>{o.name}</b>
                <small>
                  {o.games.length} game{o.games.length === 1 ? '' : 's'} · {positions}
                </small>
              </span>
              <span className="chev">{isOpen ? '▾' : '▸'}</span>
            </button>
            <div className="metrics">
              <Metric label="flags" value={s.total} />
              <Metric label="per game" value={perGame(s.total, o.games.length)} />
              <Metric label="accepted" value={s.total ? `${Math.round((100 * s.accepted) / s.total)}%` : '—'} />
              <Metric label="UNS" value={s.uns} />
              <Metric label="personal" value={s.pf} />
              <Metric label="DQ" value={s.dq} />
            </div>
            <CodeList fouls={o.flags} />
            {isOpen && (
              <ul className="history">
                {o.games.map(({ game, positions: pos, flags }) => (
                  <li key={game.id}>
                    <button type="button" onClick={() => props.onOpen(game.id)}>
                      <span>
                        {fmtDate(game.date)} · {teamName(game, 'V')} at {teamName(game, 'H')}
                      </span>
                      <span className="muted">
                        {pos.join('/')} · {flags.length} flag{flags.length === 1 ? '' : 's'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      <p className="muted small pad-x">
        Names are matched ignoring capitals and extra spaces, so pick a name from the suggestions when entering a crew to keep one official from being
        split into two.
      </p>
    </div>
  );
}

export function TeamsView(props: { games: Game[]; onOpen: (id: string) => void }) {
  const teams = useMemo(() => teamHistory(props.games), [props.games]);
  const [open, setOpen] = useState<string | null>(null);
  if (!teams.length)
    return (
      <div className="empty">
        <p>No teams yet.</p>
        <p className="muted">Teams appear here once you've entered school names on a game.</p>
      </div>
    );
  return (
    <div className="stat-list">
      {teams.map((t) => {
        const s = summarize(t.fouls);
        const n = t.games.length;
        const yards = t.games.reduce((a, g) => a + g.yards, 0);
        const { w, l, t: ties } = t.record;
        const isOpen = open === t.name;
        return (
          <section key={t.name} className="card">
            <button type="button" className="stat-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : t.name)}>
              <span>
                <b>{t.name}</b>
                <small>
                  {n} game{n === 1 ? '' : 's'} worked{w + l + ties ? ` · ${w}-${l}${ties ? `-${ties}` : ''} in those games` : ''}
                </small>
              </span>
              <span className="chev">{isOpen ? '▾' : '▸'}</span>
            </button>
            <div className="metrics">
              <Metric label="fouls/game" value={perGame(s.total, n)} />
              <Metric label="yds/game*" value={perGame(yards, n)} />
              <Metric label="UNS" value={s.uns} />
              <Metric label="personal" value={s.pf} />
              <Metric label="DQ" value={s.dq} />
            </div>
            <CodeList fouls={t.fouls} />
            {isOpen && (
              <ul className="history">
                {t.games.map((g) => (
                  <li key={g.game.id}>
                    <button type="button" onClick={() => props.onOpen(g.game.id)}>
                      <span>
                        {fmtDate(g.game.date)} · {g.side === 'H' ? 'vs' : 'at'} {g.opponent}
                        {g.result && (
                          <b className={`result ${g.result}`}>
                            {' '}
                            {g.result} {g.side === 'H' ? `${g.game.homeScore}-${g.game.awayScore}` : `${g.game.awayScore}-${g.game.homeScore}`}
                          </b>
                        )}
                      </span>
                      <span className="muted">
                        {g.fouls.length} foul{g.fouls.length === 1 ? '' : 's'}, {g.yards} yds
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      <p className="muted small pad-x">Only games entered on this device count. *Nominal yards for accepted fouls.</p>
    </div>
  );
}
