import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { GameView } from './GameView';
import { fmtDate, fmtWhen, sendState } from './report';
import { teamName } from './rules';
import { inSeason, officialNames, schoolNames, seasonsOf } from './stats';
import { OfficialsView, TeamsView } from './StatsViews';
import { blankGame, downloadBlob, importGames, loadGames, requestPersistentStorage, saveGames, todayISO } from './store';
import type { Game } from './types';
import { CREW_NAMES, CREW_POSITIONS } from './types';
import { Field, Modal } from './ui';

const ReportViewer = lazy(() => import('./ReportViewer'));

const sharedToken = () => (location.hash.startsWith('#r=') ? location.hash.slice(3) : null);

export default function App() {
  const [games, setGames] = useState<Game[]>(loadGames);
  const [openId, setOpenId] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [shared, setShared] = useState<string | null>(sharedToken);

  useEffect(requestPersistentStorage, []);
  useEffect(() => setSaveFailed(!saveGames(games)), [games]);
  useEffect(() => {
    const onHash = () => setShared(sharedToken());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (shared) {
    return (
      <Suspense fallback={<p className="muted pad">Opening report…</p>}>
        <ReportViewer
          token={shared}
          onClose={() => {
            history.replaceState(null, '', location.pathname);
            setShared(null);
          }}
          onSave={(g) => setGames((all) => [...all, g])}
        />
      </Suspense>
    );
  }

  const open = games.find((g) => g.id === openId);
  if (open) {
    return (
      <>
        {saveFailed && <div className="banner danger">This device refused to save. Don't close the app; send the report now.</div>}
        <GameView
          game={open}
          allGames={games}
          onBack={() => setOpenId(null)}
          onChange={(g) => setGames((all) => all.map((x) => (x.id === g.id ? g : x)))}
        />
      </>
    );
  }

  return (
    <Home
      games={games}
      setGames={setGames}
      onOpen={setOpenId}
      onCreate={(g) => {
        setGames((all) => [...all, g]);
        setOpenId(g.id);
      }}
    />
  );
}

type HomeTab = 'games' | 'officials' | 'teams';

function Home(props: { games: Game[]; setGames: (f: (g: Game[]) => Game[]) => void; onOpen: (id: string) => void; onCreate: (g: Game) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState<HomeTab>('games');
  const [creating, setCreating] = useState(false);
  const seasons = useMemo(() => seasonsOf(props.games), [props.games]);
  const [season, setSeason] = useState(seasons[0]);
  const games = props.games.filter((g) => inSeason(g, season));
  const sorted = [...games].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const fouls = games.reduce((n, g) => n + g.fouls.length, 0);
  const unsent = props.games.filter((g) => g.status === 'final' && sendState(g) !== 'sent').length;

  return (
    <div className="home">
      <header className="home-head">
        <h1>Foul Report Football</h1>
        <p className="muted">Varsity foul reporting · saves on this device</p>
      </header>
      <button type="button" className="btn primary block" onClick={() => setCreating(true)}>
        + New game
      </button>

      {unsent > 0 && (
        <p className="alert warn top-gap">
          {unsent} finished game{unsent === 1 ? ' has' : 's have'} a report that hasn't been sent, or changed after sending.
        </p>
      )}

      <div className="home-tabs" role="tablist">
        {(
          [
            ['games', 'Games'],
            ['officials', 'Officials'],
            ['teams', 'Teams'],
          ] as [HomeTab, string][]
        ).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
        <select aria-label="Season" value={season} onChange={(e) => setSeason(e.target.value)}>
          {seasons.map((s) => (
            <option key={s} value={s}>
              {s} season
            </option>
          ))}
          <option value="all">All seasons</option>
        </select>
      </div>

      {tab === 'games' && (
        <>
          {props.games.length > 0 && (
            <p className="muted small season">
              {games.length} game{games.length === 1 ? '' : 's'}, {fouls} fouls recorded
            </p>
          )}
          {sorted.length === 0 ? (
            <div className="empty">
              <p>No games {props.games.length ? 'this season' : 'yet'}.</p>
              <p className="muted">
                Tip: on iPhone, open this in Safari and use Share → Add to Home Screen. It then works like an app, opens offline, and your saved games are
                kept safer.
              </p>
            </div>
          ) : (
            <ul className="game-list">
              {sorted.map((g) => {
                const st = sendState(g);
                const last = g.sentLog[g.sentLog.length - 1];
                return (
                  <li key={g.id}>
                    <button type="button" className="game-row" onClick={() => props.onOpen(g.id)}>
                      <span className="date">{fmtDate(g.date)}</span>
                      <span className="teams">
                        {teamName(g, 'V')} {g.awayScore && <b>{g.awayScore}</b>} <span className="at">at</span> {teamName(g, 'H')}{' '}
                        {g.homeScore && <b>{g.homeScore}</b>}
                      </span>
                      <span className="meta">
                        {g.fouls.length} foul{g.fouls.length === 1 ? '' : 's'}
                        {g.status === 'final' ? ' · Final' : g.date === todayISO() ? ' · Today' : ' · In progress'}
                        {st === 'sent' && last && <span className="sent"> · ✓ Sent {fmtWhen(last.at)}</span>}
                        {st === 'changed' && <span className="unsent"> · Changed after sending</span>}
                        {st === 'never' && g.status === 'final' && <span className="unsent"> · Not sent</span>}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="btn ghost danger small"
                      aria-label={`Delete ${teamName(g, 'V')} at ${teamName(g, 'H')}`}
                      onClick={() => {
                        if (confirm(`Delete ${teamName(g, 'V')} at ${teamName(g, 'H')} (${fmtDate(g.date)})? This cannot be undone.`)) {
                          props.setGames((all) => all.filter((x) => x.id !== g.id));
                        }
                      }}
                    >
                      Delete
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <section className="backup">
            <h3>Backup</h3>
            <p className="muted small">Games live only on this device. Save a backup file now and then, or to move games to a new phone.</p>
            <div className="send-buttons">
              <button
                type="button"
                className="btn"
                disabled={!props.games.length}
                onClick={() =>
                  downloadBlob(
                    new Blob([JSON.stringify({ app: 'foul-report-football', version: 1, games: props.games }, null, 2)], { type: 'application/json' }),
                    `foul-report-backup-${todayISO()}.json`,
                  )
                }
              >
                Save backup
              </button>
              <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()}>
                Restore backup
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  try {
                    const text = await file.text();
                    props.setGames((all) => importGames(text, all));
                    setMsg('Backup restored.');
                  } catch {
                    setMsg("That file isn't a Foul Report backup.");
                  }
                }}
              />
            </div>
            {msg && <p className="note">{msg}</p>}
          </section>
        </>
      )}

      {tab === 'officials' && <OfficialsView games={games} onOpen={props.onOpen} />}
      {tab === 'teams' && <TeamsView games={games} onOpen={props.onOpen} />}

      {creating && <NewGameSheet games={props.games} onClose={() => setCreating(false)} onCreate={props.onCreate} />}
    </div>
  );
}

function NewGameSheet(props: { games: Game[]; onClose: () => void; onCreate: (g: Game) => void }) {
  const latest = useMemo(() => [...props.games].sort((a, b) => b.createdAt - a.createdAt)[0], [props.games]);
  const [g, setG] = useState<Game>(() => {
    const base = blankGame();
    return base;
  });
  const [copyCrew, setCopyCrew] = useState(false);
  const schools = useMemo(() => schoolNames(props.games), [props.games]);
  const officials = useMemo(() => officialNames(props.games), [props.games]);
  const set = (p: Partial<Game>) => setG((prev) => ({ ...prev, ...p }));
  const lastCrew = latest ? CREW_POSITIONS.filter((p) => latest.crew[p]) : [];

  return (
    <Modal
      title="New game"
      onClose={props.onClose}
      footer={
        <>
          <span className="spacer" />
          <button type="button" className="btn primary" onClick={() => props.onCreate({ ...g, home: g.home.trim(), away: g.away.trim(), updatedAt: Date.now() })}>
            {g.home.trim() && g.away.trim() ? 'Start game' : 'Start (add schools later)'}
          </button>
        </>
      }
    >
      <datalist id="new-school-names">
        {schools.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <datalist id="new-official-names">
        {officials.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <Field label="Date">
        <input type="date" value={g.date} onChange={(e) => set({ date: e.target.value })} />
      </Field>
      <Field label="Home school (H)">
        <input list="new-school-names" autoComplete="off" value={g.home} onChange={(e) => set({ home: e.target.value })} placeholder="Home high school" />
      </Field>
      <Field label="Visiting school (V)">
        <input list="new-school-names" autoComplete="off" value={g.away} onChange={(e) => set({ away: e.target.value })} placeholder="Visiting high school" />
      </Field>
      <Field label="Referee's email" hint="Paste it from your assigning app. The report goes here.">
        <input
          type="email"
          inputMode="email"
          autoCapitalize="off"
          autoCorrect="off"
          value={g.refereeEmail}
          onChange={(e) => set({ refereeEmail: e.target.value.trim() })}
          placeholder="referee@example.com"
        />
      </Field>
      {lastCrew.length > 0 && (
        <label className="final-toggle">
          <input
            type="checkbox"
            checked={copyCrew}
            onChange={(e) => {
              setCopyCrew(e.target.checked);
              set({ crew: e.target.checked ? { ...latest!.crew } : blankGame().crew });
            }}
          />
          Same crew as last game ({lastCrew.map((p) => `${p} ${latest!.crew[p].split(' ').slice(-1)[0]}`).join(', ')})
        </label>
      )}
      <h3 className="top-gap">Crew</h3>
      <div className="crew-grid">
        {CREW_POSITIONS.map((p) => (
          <Field key={p} label={`${p} · ${CREW_NAMES[p]}`}>
            <input
              list="new-official-names"
              autoComplete="off"
              value={g.crew[p]}
              onChange={(e) => set({ crew: { ...g.crew, [p]: e.target.value } })}
              placeholder={p === 'D' ? 'If used' : ''}
            />
          </Field>
        ))}
      </div>
    </Modal>
  );
}
