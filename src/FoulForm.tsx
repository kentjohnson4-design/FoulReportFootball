import { useMemo, useState } from 'react';
import { CODE_MAP, DEFAULT_PLAYER, DEFAULT_SIDE, FOUL_CODES, codeGroup } from './data/codes';
import { clockError, draftAlerts, teamName } from './rules';
import { getRecentCodes, pushRecentCode, uid } from './store';
import type { Foul, Game, Official, Quarter, Side, Status, Team } from './types';
import { OFFICIALS, QUARTERS, SIDE_NAMES, STATUS_NAMES, quarterLabel } from './types';
import { Chips, ClockInput, Field, Group, Modal } from './ui';

export function blankFoul(game: Game): Foul {
  return {
    id: uid(),
    quarter: game.currentQuarter,
    time: '',
    team: '',
    code: '',
    side: '',
    player: '',
    status: 'A',
    official: '',
    note: '',
    createdAt: Date.now(),
  };
}

const GROUP_ORDER = ['Other fouls', 'Personal fouls', 'Unsportsmanlike', 'Disqualifications'];

export function FoulForm(props: {
  game: Game;
  initial?: Foul;
  index?: number;
  onSave: (f: Foul) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const { game } = props;
  const [d, setD] = useState<Foul>(() => props.initial ?? blankFoul(game));
  const [query, setQuery] = useState('');
  const [browsing, setBrowsing] = useState(!props.initial);
  const recents = useMemo(getRecentCodes, []);
  const set = (patch: Partial<Foul>) => setD((prev) => ({ ...prev, ...patch }));

  const pickCode = (code: string) => {
    setD((prev) => ({
      ...prev,
      code,
      side: prev.side || DEFAULT_SIDE[code] || '',
      player: prev.player || DEFAULT_PLAYER[code] || '',
    }));
    setQuery('');
    setBrowsing(false);
  };

  const matches = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return FOUL_CODES;
    const starts = FOUL_CODES.filter((c) => c.code.startsWith(q) || c.code.replace(/^(PF|UNS|DQ)-/, '').startsWith(q));
    const rest = FOUL_CODES.filter((c) => !starts.includes(c) && (c.code.includes(q) || c.name.toUpperCase().includes(q)));
    return [...starts, ...rest];
  }, [query]);

  const alerts = draftAlerts(game, d);
  const clockErr = clockError(d.time);
  const canSave = !!d.team && !!d.code;
  const selected = CODE_MAP.get(d.code);

  const save = () => {
    if (!canSave) return;
    pushRecentCode(d.code);
    props.onSave({ ...d, player: d.player.trim().toUpperCase().replace(/^#/, '') });
  };

  return (
    <Modal
      title={props.initial ? `Edit foul ${props.index ?? ''}` : 'New foul'}
      onClose={props.onClose}
      footer={
        <>
          {props.onDelete && (
            <button
              type="button"
              className="btn danger ghost"
              onClick={() => {
                if (confirm('Delete this foul?')) props.onDelete!();
              }}
            >
              Delete
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn primary" disabled={!canSave} onClick={save}>
            {canSave ? 'Save foul' : !d.team ? 'Pick a team' : 'Pick a foul'}
          </button>
        </>
      }
    >
      <Group label="Team">
        <Chips<Team>
          big
          label="Team"
          options={['H', 'V']}
          value={d.team}
          onChange={(v) => set({ team: v as Team | '' })}
          render={(t) => (
            <span className="team-chip">
              <b>{t}</b>
              <span>{teamName(game, t)}</span>
            </span>
          )}
        />
      </Group>

      <Group
        label="Foul"
        aside={
          !browsing && d.code ? (
            <button type="button" className="btn small ghost" onClick={() => setBrowsing(true)}>
              Change
            </button>
          ) : null
        }
      >
        {d.code && !browsing ? (
          <button type="button" className="selected-code" onClick={() => setBrowsing(true)}>
            <b>{d.code}</b>
            <span>{selected?.name}</span>
            <em>{selected?.yds}</em>
          </button>
        ) : (
          <div className="code-picker">
            <input
              type="search"
              className="code-search"
              placeholder="Type code or name: DPI, hold, horse…"
              value={query}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && matches[0]) {
                  e.preventDefault();
                  pickCode(matches[0].code);
                }
              }}
            />
            {!query && recents.length > 0 && (
              <div className="recents">
                <span className="muted">Recent</span>
                {recents.map((c) => (
                  <button type="button" key={c} className="chip" onClick={() => pickCode(c)}>
                    {c}
                  </button>
                ))}
              </div>
            )}
            <div className="code-list" role="listbox" aria-label="Foul codes">
              {(query ? [''] : GROUP_ORDER).map((g) => {
                const items = query ? matches : matches.filter((c) => codeGroup(c.code) === g);
                return (
                  <div key={g || 'results'}>
                    {g && <div className="code-group">{g}</div>}
                    {items.map((c) => (
                      <button
                        type="button"
                        role="option"
                        aria-selected={c.code === d.code}
                        key={c.code}
                        className={`code-row${c.code === d.code ? ' on' : ''}`}
                        onClick={() => pickCode(c.code)}
                      >
                        <b>{c.code}</b>
                        <span>{c.name}</span>
                        <em>{c.yds}</em>
                      </button>
                    ))}
                  </div>
                );
              })}
              {query && matches.length === 0 && <p className="muted pad">No code matches “{query}”.</p>}
            </div>
          </div>
        )}
      </Group>

      {alerts.length > 0 && (
        <div className="alerts">
          {alerts.map((a, i) => (
            <div key={i} className={`alert ${a.level}`}>
              <span>{a.text}</span>
              {a.suggestCode && a.suggestCode !== d.code && (
                <button type="button" className="btn small" onClick={() => pickCode(a.suggestCode!)}>
                  Use {a.suggestCode}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="row2">
        <Field label="Player #" hint="Jersey number, or a button below">
          <input
            inputMode="numeric"
            className="player"
            placeholder="#"
            value={d.player}
            onChange={(e) => set({ player: e.target.value.toUpperCase() })}
          />
        </Field>
        <Field label="Game clock" error={clockErr} hint="When the flag was thrown">
          <ClockInput value={d.time} onChange={(time) => set({ time })} />
        </Field>
      </div>
      <Chips<string>
        label="Non-player"
        options={['HC', 'TEAM', 'BENCH']}
        value={d.player}
        allowClear
        onChange={(v) => set({ player: v })}
        render={(v) => (v === 'HC' ? 'Head coach' : v === 'TEAM' ? 'Team' : 'Bench')}
      />

      <Group label="Quarter">
        <Chips<Quarter> label="Quarter" options={QUARTERS} value={d.quarter} onChange={(v) => v && set({ quarter: v as Quarter })} render={quarterLabel} />
      </Group>

      <Group label="Fouling team was on">
        <Chips<Side>
          label="O/D/K/R"
          options={['O', 'D', 'K', 'R']}
          value={d.side}
          allowClear
          onChange={(v) => set({ side: v as Side | '' })}
          render={(s) => (
            <span className="stack">
              <b>{s}</b>
              <small>{SIDE_NAMES[s]}</small>
            </span>
          )}
        />
      </Group>

      <Group label="Result">
        <Chips<Status>
          label="A/D/O"
          options={['A', 'D', 'O']}
          value={d.status}
          onChange={(v) => v && set({ status: v as Status })}
          render={(s) => (
            <span className="stack">
              <b>{s}</b>
              <small>{STATUS_NAMES[s]}</small>
            </span>
          )}
        />
      </Group>

      <Group label="Called by">
        <Chips<Official>
          label="Calling official"
          options={OFFICIALS}
          value={d.official}
          allowClear
          onChange={(v) => set({ official: v as Official | '' })}
          render={(o) => (
            <span className="stack">
              <b>{o}</b>
              {game.crew[o] ? <small>{game.crew[o].split(' ').slice(-1)[0]}</small> : null}
            </span>
          )}
        />
      </Group>

      <Field label="Note (optional)">
        <input value={d.note} onChange={(e) => set({ note: e.target.value })} placeholder="Anything the referee should know" />
      </Field>
    </Modal>
  );
}
