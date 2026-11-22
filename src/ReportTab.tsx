import { useEffect, useState } from 'react';
import { buildPdf } from './pdf';
import { SEND_METHOD_NAMES, buildTextReport, fmtWhen, hashReport, reportFileName, reportTitle, sendState } from './report';
import { encodeGame, reportUrl } from './share';
import type { SendRecord } from './types';
import { discipline, officialCounts, playerLabel, reportIssues, teamName, teamStats } from './rules';
import { downloadBlob } from './store';
import type { Game, Team } from './types';
import { OFFICIALS } from './types';

export default function ReportTab(props: { game: Game; update: (p: Partial<Game>) => void }) {
  const { game, update } = props;
  const [msg, setMsg] = useState('');
  const issues = reportIssues(game);
  const disc = discipline(game);
  const byOfficial = officialCounts(game);
  const contentHash = hashReport(game);
  const state = sendState(game);
  const last = game.sentLog[game.sentLog.length - 1];

  // The report link is built ahead of time so the share sheet can open straight from the tap.
  const [link, setLink] = useState('');
  useEffect(() => {
    let live = true;
    encodeGame(game)
      .then((t) => live && setLink(reportUrl(t)))
      .catch(() => live && setLink(''));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentHash]);

  const recordSend = (method: SendRecord['method']) =>
    update({ sentLog: [...game.sentLog, { at: Date.now(), method, hash: contentHash }] });

  // The PDF is built synchronously inside the tap handler: iPhone Safari only allows the
  // share sheet to open directly from a user tap.
  const sharePdf = async () => {
    const name = reportFileName(game);
    const blob = buildPdf(game, link || undefined);
    const file = new File([blob], name, { type: 'application/pdf' });
    const text = link ? `${reportTitle(game)}\n\nView the report online: ${link}` : reportTitle(game);
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: reportTitle(game), text });
        recordSend('share-pdf');
        setMsg(game.refereeEmail ? `Shared. Make sure it went to ${game.refereeEmail}.` : 'Shared.');
      } else {
        downloadBlob(blob, name);
        setMsg('This browser cannot attach files to a share, so the PDF was downloaded instead.');
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setMsg(`Could not share: ${(e as Error).message}`);
    }
  };

  const emailText = () => {
    const url = `mailto:${encodeURIComponent(game.refereeEmail)}?subject=${encodeURIComponent(reportTitle(game))}&body=${encodeURIComponent(
      buildTextReport(game, link || undefined),
    )}`;
    recordSend('email-text');
    window.location.href = url;
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(buildTextReport(game, link || undefined));
      setMsg('Report text copied.');
    } catch {
      setMsg('Copy failed on this browser.');
    }
  };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(game.refereeEmail);
      setMsg(`Copied ${game.refereeEmail}. Paste it into the To: field after you tap Share PDF.`);
    } catch {
      setMsg('Copy failed on this browser.');
    }
  };

  return (
    <div className="report">
      <section className="card">
        <h3>Send to the referee</h3>
        {game.refereeEmail ? (
          <p className="muted">
            To: <b>{game.refereeEmail}</b>{' '}
            <button type="button" className="btn small ghost" onClick={copyEmail}>
              Copy
            </button>
          </p>
        ) : (
          <p className="alert warn">Add the referee's email on the Game & toss tab.</p>
        )}
        <div className="send-buttons">
          <button type="button" className="btn primary" onClick={sharePdf}>
            Share PDF
          </button>
          <button type="button" className="btn" onClick={emailText} disabled={!game.refereeEmail}>
            Email as text
          </button>
          <button type="button" className="btn ghost" onClick={() => downloadBlob(buildPdf(game, link || undefined), reportFileName(game))}>
            Download PDF
          </button>
          <button type="button" className="btn ghost" onClick={copyText}>
            Copy text
          </button>
        </div>
        <p className="muted small">
          Tapping <b>Share PDF</b> or <b>Email as text</b> records the game as sent; if you back out without sending, the app can't tell, so check the status below. <b>Share PDF</b> opens your phone's share sheet. Pick Mail or Gmail; you'll need to add the referee's address yourself, because phones don't
          let apps fill it in. <b>Email as text</b> fills in the address and puts the full report in the message body, with no attachment.
        </p>
        {msg && <p className="note">{msg}</p>}
        <div className={`send-status ${state}`}>
          {state === 'never' && <span>Not sent yet.</span>}
          {state === 'sent' && last && (
            <span>
              ✓ Sent {fmtWhen(last.at)} ({SEND_METHOD_NAMES[last.method]}). Nothing has changed since.
            </span>
          )}
          {state === 'changed' && last && <span>Changed since it was sent {fmtWhen(last.at)}. Send it again so the referee has the final version.</span>}
          {state !== 'sent' && (
            <button type="button" className="btn small" onClick={() => recordSend('manual')}>
              Mark as sent
            </button>
          )}
        </div>
        {game.sentLog.length > 1 && (
          <details className="small muted">
            <summary>Send history ({game.sentLog.length})</summary>
            <ul>
              {game.sentLog.map((r) => (
                <li key={r.at}>
                  {fmtWhen(r.at)}: {SEND_METHOD_NAMES[r.method]}
                </li>
              ))}
            </ul>
          </details>
        )}
        {link && (
          <p className="small muted">
            The PDF and email include a link the referee can open in any browser.{' '}
            <a href={link} target="_blank" rel="noreferrer">
              Preview the link
            </a>
          </p>
        )}
        <label className="final-toggle">
          <input type="checkbox" checked={game.status === 'final'} onChange={(e) => update({ status: e.target.checked ? 'final' : 'in-progress' })} />
          Mark game as final
        </label>
      </section>

      {issues.length > 0 && (
        <section className="card">
          <h3>Still blank ({issues.length})</h3>
          <ul className="issues">
            {issues.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
      )}

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
        <div className="table-wrap">
          <table className="stats">
            <thead>
              <tr>
                <th>By quarter</th>
                <th>Q1</th>
                <th>Q2</th>
                <th>Q3</th>
                <th>Q4</th>
                <th>OT</th>
              </tr>
            </thead>
            <tbody>
              {(['H', 'V'] as Team[]).map((t) => (
                <tr key={t}>
                  <th>{teamName(game, t)}</th>
                  {teamStats(game, t).byQuarter.map((n, i) => (
                    <td key={i}>{n}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-wrap">
          <table className="stats">
            <thead>
              <tr>
                <th>Called by</th>
                {OFFICIALS.map((o) => (
                  <th key={o}>{o}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>Flags</th>
                {OFFICIALS.map((o) => (
                  <td key={o}>{byOfficial[o]}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="muted small">*Yards for accepted fouls, using the nominal penalty from the code sheet (not yardage walked off).</p>
      </section>

      <section className="card">
        <h3>Unsportsmanlike & disqualifications</h3>
        {disc.length === 0 ? (
          <p className="muted">None.</p>
        ) : (
          <ul className="disc">
            {disc.map((d) => (
              <li key={`${d.team}${d.player}`} className={d.dq.length ? 'dq' : ''}>
                <b>{teamName(game, d.team)}</b> {playerLabel(d.player)}: {d.uns.length} UNS
                {d.dq.length > 0 && <strong> · DISQUALIFIED ({d.dq.map((f) => f.code).join(', ')})</strong>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h3>Preview</h3>
        <pre className="preview">{buildTextReport(game)}</pre>
      </section>
    </div>
  );
}
