import { useEffect, useRef, useState } from 'react';
import { GameView } from './GameView';
import { fmtDate } from './report';
import { teamName } from './rules';
import { blankGame, downloadBlob, importGames, loadGames, requestPersistentStorage, saveGames, todayISO } from './store';
import type { Game } from './types';

export default function App() {
  const [games, setGames] = useState<Game[]>(loadGames);
  const [openId, setOpenId] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(requestPersistentStorage, []);
  useEffect(() => setSaveFailed(!saveGames(games)), [games]);

  const open = games.find((g) => g.id === openId);
  if (open) {
    return (
      <>
        {saveFailed && <div className="banner danger">This device refused to save. Don't close the app; send the report now.</div>}
        <GameView game={open} onBack={() => setOpenId(null)} onChange={(g) => setGames((all) => all.map((x) => (x.id === g.id ? g : x)))} />
      </>
    );
  }

  const create = () => {
    const latest = [...games].sort((a, b) => b.createdAt - a.createdAt)[0];
    const g = blankGame(latest);
    setGames((all) => [...all, g]);
    setOpenId(g.id);
  };

  return <Home games={games} setGames={setGames} onOpen={setOpenId} onCreate={create} />;
}

function Home(props: { games: Game[]; setGames: (f: (g: Game[]) => Game[]) => void; onOpen: (id: string) => void; onCreate: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const sorted = [...props.games].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const season = new Date().getFullYear();
  const seasonGames = props.games.filter((g) => g.date.startsWith(String(season)));
  const seasonFouls = seasonGames.reduce((n, g) => n + g.fouls.length, 0);

  return (
    <div className="home">
      <header className="home-head">
        <h1>Foul Report Football</h1>
        <p className="muted">Varsity foul reporting · saves on this device</p>
      </header>
      <button type="button" className="btn primary block" onClick={props.onCreate}>
        + New game
      </button>

      {props.games.length > 0 && (
        <p className="muted small season">
          {season}: {seasonGames.length} game{seasonGames.length === 1 ? '' : 's'}, {seasonFouls} fouls recorded
        </p>
      )}

      {sorted.length === 0 ? (
        <div className="empty">
          <p>No games yet.</p>
          <p className="muted">
            Tip: on iPhone, open this in Safari and use Share → Add to Home Screen. It then works like an app, opens offline, and your saved games are kept
            safer.
          </p>
        </div>
      ) : (
        <ul className="game-list">
          {sorted.map((g) => (
            <li key={g.id}>
              <button type="button" className="game-row" onClick={() => props.onOpen(g.id)}>
                <span className="date">{fmtDate(g.date)}</span>
                <span className="teams">
                  {teamName(g, 'V')} {g.awayScore && <b>{g.awayScore}</b>} <span className="at">at</span> {teamName(g, 'H')} {g.homeScore && <b>{g.homeScore}</b>}
                </span>
                <span className="meta">
                  {g.fouls.length} foul{g.fouls.length === 1 ? '' : 's'}
                  {g.status === 'final' ? ' · Final' : g.date === todayISO() ? ' · Today' : ' · In progress'}
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
          ))}
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
    </div>
  );
}
