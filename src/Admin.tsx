import { useEffect, useMemo, useState } from 'react';
import { US_STATES } from './Account';
import { listCodeSets, removeCodeSet, saveCodeSet, type CodeSetDoc } from './cloud';
import { checkCodeList, toCSV, type CodeListCheck } from './csv';
import { CATEGORIES, FOUL_CODES } from './data/codes';
import { downloadBlob } from './store';
import { Field } from './ui';

const catLabel = (id?: string) => CATEGORIES.find((c) => c.id === id)?.label ?? id;

/** Admin-only page for uploading, publishing and removing state code lists. */
export function AdminScreen(props: { onBack: () => void }) {
  const [sets, setSets] = useState<CodeSetDoc[] | null>(null);
  const [msg, setMsg] = useState('');
  const [editing, setEditing] = useState<CodeSetDoc | 'new' | null>(null);

  const load = () =>
    listCodeSets(true)
      .then(setSets)
      .catch((e) => setMsg(`Couldn't load code lists: ${(e as Error).message}. Is your account ID in the admins collection?`));
  useEffect(() => {
    load();
  }, []);

  const publish = async (s: CodeSetDoc, published: boolean) => {
    await saveCodeSet({ ...s, published, updatedAt: Date.now() });
    setMsg(`${s.label} ${published ? 'published' : 'unpublished'}.`);
    load();
  };

  return (
    <div className="home account">
      <header className="home-head">
        <button type="button" className="btn ghost back-link" onClick={props.onBack}>
          ‹ Account
        </button>
        <h1>State code lists</h1>
        <p className="muted">Published lists appear in everyone’s code-list choices. Drafts are visible only to admins.</p>
      </header>

      <div className="send-buttons">
        <button type="button" className="btn primary" onClick={() => setEditing('new')}>
          + Upload a code list
        </button>
        <button type="button" className="btn ghost" onClick={() => downloadBlob(new Blob([toCSV(FOUL_CODES)], { type: 'text/csv' }), 'foul-codes-template.csv')}>
          Download template (built-in list)
        </button>
      </div>
      {msg && <p className="note">{msg}</p>}

      {editing && (
        <Uploader
          existing={editing === 'new' ? null : editing}
          taken={(sets ?? []).map((s) => s.id)}
          onClose={() => setEditing(null)}
          onSaved={(text) => {
            setEditing(null);
            setMsg(text);
            load();
          }}
        />
      )}

      {!sets ? (
        <p className="muted">Loading…</p>
      ) : sets.length === 0 ? (
        <p className="muted">No state lists yet. Everyone is using the built-in list.</p>
      ) : (
        <ul className="game-list">
          {sets.map((s) => (
            <li key={s.id} className="admin-row">
              <div className="game-row static">
                <span className="teams">{s.label}</span>
                <span className="meta">
                  {s.state} · {s.season} · {s.codes.length} codes · {s.published ? <b className="sent">Published</b> : <b className="unsent">Draft</b>}
                </span>
              </div>
              <div className="admin-actions">
                <button type="button" className="btn small" onClick={() => setEditing(s)}>
                  Replace
                </button>
                <button type="button" className="btn small" onClick={() => publish(s, !s.published)}>
                  {s.published ? 'Unpublish' : 'Publish'}
                </button>
                <button
                  type="button"
                  className="btn small ghost"
                  onClick={() => downloadBlob(new Blob([toCSV(s.codes)], { type: 'text/csv' }), `${s.id}.csv`)}
                >
                  CSV
                </button>
                <button
                  type="button"
                  className="btn small ghost danger"
                  onClick={async () => {
                    if (!confirm(`Delete ${s.label}? Games already recorded with it keep their own copy.`)) return;
                    await removeCodeSet(s.id);
                    load();
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section className="card">
        <h3>File format</h3>
        <p className="small">
          A CSV file (save as CSV from Excel or Google Sheets) with a header row: <code>code, name, yards, category</code>. Category must be one of:
        </p>
        <ul className="small">
          {CATEGORIES.map((c) => (
            <li key={c.id}>
              <code>{c.id}</code>: {c.label}
            </li>
          ))}
        </ul>
        <p className="small muted">
          Categories drive the second-unsportsmanlike DQ warning, the sideline progression and the stats, so they matter more than the names.
        </p>
      </section>
    </div>
  );
}

function Uploader(props: { existing: CodeSetDoc | null; taken: string[]; onClose: () => void; onSaved: (msg: string) => void }) {
  const [state, setState] = useState(props.existing?.state ?? '');
  const [season, setSeason] = useState(props.existing?.season ?? String(new Date().getFullYear()));
  const [label, setLabel] = useState(props.existing?.label ?? '');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const check: CodeListCheck | null = useMemo(() => (text.trim() ? checkCodeList(text) : null), [text]);
  const id = props.existing?.id ?? `${state}-${season}`.toLowerCase();
  const finalLabel = label.trim() || `${state} ${season}`;
  const clash = !props.existing && props.taken.includes(id);

  const save = async (published: boolean) => {
    if (!check || check.errors.length || !state) return;
    setBusy(true);
    setErr('');
    try {
      await saveCodeSet({ id, state, season, label: finalLabel, codes: check.codes, published, updatedAt: Date.now() });
      props.onSaved(`${finalLabel} saved${published ? ' and published' : ' as a draft'}.`);
    } catch (e) {
      setErr(`Couldn't save: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card">
      <div className="card-head">
        <h3>{props.existing ? `Replace ${props.existing.label}` : 'Upload a code list'}</h3>
        <button type="button" className="btn ghost small" onClick={props.onClose}>
          Cancel
        </button>
      </div>
      <div className="row4">
        <Field label="State">
          <select value={state} disabled={!!props.existing} onChange={(e) => setState(e.target.value)}>
            <option value="">Choose…</option>
            {US_STATES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Season">
          <input inputMode="numeric" value={season} disabled={!!props.existing} onChange={(e) => setSeason(e.target.value.replace(/\D/g, '').slice(0, 4))} />
        </Field>
        <Field label="Name shown to users">
          <input value={label} placeholder={`${state || 'State'} ${season}`} onChange={(e) => setLabel(e.target.value)} />
        </Field>
      </div>
      {clash && <p className="alert warn">A list for {state} {season} already exists. Saving will replace it.</p>}
      <Field label="CSV file">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) setText(await f.text());
          }}
        />
      </Field>
      <details>
        <summary className="small">…or paste the CSV text</summary>
        <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="code,name,yards,category" />
      </details>

      {check && (
        <>
          {check.errors.length > 0 && (
            <div className="alert danger stacked">
              <b>Fix these before saving ({check.errors.length}):</b>
              <ul>
                {check.errors.slice(0, 15).map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          {check.warnings.length > 0 && (
            <div className="alert warn stacked">
              <b>Check these ({check.warnings.length}):</b>
              <ul>
                {check.warnings.slice(0, 15).map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="small muted">{check.codes.length} codes read. Preview:</p>
          <div className="table-wrap preview-table">
            <table className="stats">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Yards</th>
                  <th>Category</th>
                </tr>
              </thead>
              <tbody>
                {check.codes.map((c) => (
                  <tr key={c.code}>
                    <th>{c.code}</th>
                    <td className="left">{c.name}</td>
                    <td>{c.yds}</td>
                    <td className="left">{catLabel(c.category)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {err && <p className="alert danger">{err}</p>}
      <div className="send-buttons">
        <button type="button" className="btn" disabled={busy || !check || !!check.errors.length || !state} onClick={() => save(false)}>
          Save as draft
        </button>
        <button type="button" className="btn primary" disabled={busy || !check || !!check.errors.length || !state} onClick={() => save(true)}>
          Save and publish
        </button>
      </div>
    </section>
  );
}
