import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CODE_MAP } from './data/codes';
import { discipline, nominalYards, playerLabel, teamName, teamStats } from './rules';
import { fmtDate, periodTimeText, timeoutText, tossLines } from './report';
import type { Game, Team } from './types';
import { CREW_POSITIONS, STATUS_NAMES, quarterLabel } from './types';

type DocWithTable = jsPDF & { lastAutoTable?: { finalY: number } };

const HEAD = [30, 41, 59] as [number, number, number];

export function buildPdf(game: Game, link?: string): Blob {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' }) as DocWithTable;
  const W = doc.internal.pageSize.getWidth();
  const M = 36;
  let y = M;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('FOUL REPORT (VARSITY)', M, y + 6);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(fmtDate(game.date), W - M, y + 6, { align: 'right' });
  y += 26;

  doc.setFont('helvetica', 'bold');
  doc.text(`Home: ${teamName(game, 'H')}  ${game.homeScore || '—'}`, M, y);
  doc.text(`Visitor: ${teamName(game, 'V')}  ${game.awayScore || '—'}`, W / 2, y);
  y += 15;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Home kicker #: ${game.homeKicker || '—'}    Visitor kicker #: ${game.awayKicker || '—'}`, M, y);
  const times = periodTimeText(game);
  if (times) doc.text(`Period times: ${times}`, W / 2, y);
  if (link) {
    y += 13;
    doc.setTextColor(29, 78, 216);
    doc.textWithLink('View this report online (opens in any browser)', M, y, { url: link });
    doc.setTextColor(0);
  }
  y += 10;

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [['#', 'Q', 'Time', 'Team', 'Code', 'Foul', 'O/D/K/R', 'Player', 'A/D/O', 'Called by', 'Yds']],
    body: game.fouls.length
      ? game.fouls.map((f, i) => [
          String(i + 1),
          quarterLabel(f.quarter),
          f.time || '—',
          `${f.team || '?'} - ${teamName(game, f.team)}`,
          f.code,
          (CODE_MAP.get(f.code)?.name ?? '') + (f.note ? `\nNote: ${f.note}` : ''),
          f.side || '—',
          playerLabel(f.player),
          STATUS_NAMES[f.status],
          f.official || '—',
          CODE_MAP.get(f.code)?.yds ?? String(nominalYards(f.code)),
        ])
      : [[{ content: 'No fouls recorded.', colSpan: 11 }]],
    styles: { fontSize: 9, cellPadding: 4, valign: 'middle' },
    headStyles: { fillColor: HEAD, textColor: 255 },
    alternateRowStyles: { fillColor: [241, 245, 249] },
    columnStyles: {
      0: { cellWidth: 22, halign: 'right' },
      1: { cellWidth: 26 },
      2: { cellWidth: 38 },
      4: { cellWidth: 52, fontStyle: 'bold' },
      6: { cellWidth: 48, halign: 'center' },
      7: { cellWidth: 60 },
      8: { cellWidth: 62 },
      9: { cellWidth: 50, halign: 'center' },
      10: { cellWidth: 46, halign: 'right' },
    },
  });
  y = (doc.lastAutoTable?.finalY ?? y) + 16;

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [['Team', 'Fouls', 'Accepted', 'Declined', 'Offsetting', 'Yds (accepted, nominal)', 'UNS', 'Personal', 'DQ', 'Q1', 'Q2', 'Q3', 'Q4', 'OT']],
    body: (['H', 'V'] as Team[]).map((t) => {
      const s = teamStats(game, t);
      return [teamName(game, t), s.total, s.accepted, s.declined, s.offsetting, s.yards, s.uns, s.pf, s.dq, ...s.byQuarter].map(String);
    }),
    styles: { fontSize: 9, cellPadding: 3, halign: 'center' },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
    headStyles: { fillColor: HEAD, textColor: 255 },
  });
  y = (doc.lastAutoTable?.finalY ?? y) + 16;

  const disc = discipline(game);
  const rows: string[][] = [];
  for (const t of ['H', 'V'] as Team[]) rows.push(['Timeouts', teamName(game, t), timeoutText(game, t)]);
  for (const d of disc) {
    rows.push([
      d.dq.length ? 'Disqualified' : 'Unsportsmanlike',
      `${teamName(game, d.team)} ${playerLabel(d.player)}`,
      [...new Set([...d.uns, ...d.dq])].map((f) => `${f.code} (${quarterLabel(f.quarter)} ${f.time || '—'})`).join(', '),
    ]);
  }
  for (const line of tossLines(game)) {
    const [k, ...rest] = line.split(': ');
    rows.push(['Coin toss', k, rest.join(': ')]);
  }
  const crew = CREW_POSITIONS.filter((p) => game.crew[p]).map((p) => `${p}: ${game.crew[p]}`).join('    ');
  if (crew) rows.push(['Crew', '', crew]);
  if (game.notes.trim()) rows.push(['Notes', '', game.notes.trim()]);

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    body: rows,
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { cellWidth: 90, fontStyle: 'bold' }, 1: { cellWidth: 150 } },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 0 && data.cell.raw === 'Disqualified') {
        data.cell.styles.textColor = [185, 28, 28];
      }
    },
  });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(
      `Yds column is the nominal penalty from the 2026 foul report codes, not yardage walked off.   Page ${i} of ${pages}`,
      M,
      doc.internal.pageSize.getHeight() - 18,
    );
  }
  return doc.output('blob');
}
