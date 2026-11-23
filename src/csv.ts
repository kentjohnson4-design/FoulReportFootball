import { CATEGORIES, type Category, type FoulCode } from './data/codes';

/** Minimal RFC 4180 CSV reader: commas, quoted fields, doubled quotes, CRLF. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

const esc = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function toCSV(codes: FoulCode[]): string {
  return ['code,name,yards,category', ...codes.map((c) => [c.code, c.name, c.yds, c.category ?? 'other'].map(esc).join(','))].join('\n') + '\n';
}

// Accept the category ids and a few plain-English spellings an admin is likely to type.
const CATEGORY_ALIASES: Record<string, Category> = {
  '': 'other',
  other: 'other',
  foul: 'other',
  pf: 'pf',
  personal: 'pf',
  'personal foul': 'pf',
  uns: 'uns',
  unsportsmanlike: 'uns',
  dq: 'dq',
  disqualification: 'dq',
  'dq-uns': 'dq-uns',
  'sl-warn': 'sl-warn',
  'sideline warning': 'sl-warn',
  'sl-5': 'sl-5',
  'sl-15': 'sl-15',
};

export interface CodeListCheck {
  codes: FoulCode[];
  errors: string[];
  warnings: string[];
}

/** Turns an uploaded CSV into a code list, reporting anything that would break the app. */
export function checkCodeList(text: string): CodeListCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rows = parseCSV(text);
  if (!rows.length) return { codes: [], errors: ['The file is empty.'], warnings };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (names: string[]) => header.findIndex((h) => names.includes(h));
  const ci = col(['code']);
  const ni = col(['name', 'foul', 'description']);
  const yi = col(['yards', 'yds', 'yardage', 'penalty']);
  const ki = col(['category', 'type', 'kind']);
  if (ci < 0 || ni < 0 || yi < 0) {
    return { codes: [], errors: ['The first row must be a header with columns: code, name, yards, category.'], warnings };
  }
  if (ki < 0) errors.push('Missing the "category" column. Every code needs one so the unsportsmanlike, DQ and sideline checks work.');

  const codes: FoulCode[] = [];
  const seen = new Set<string>();
  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const code = (r[ci] ?? '').trim().toUpperCase();
    const name = (r[ni] ?? '').trim();
    const yds = (r[yi] ?? '').trim();
    const rawCat = ki >= 0 ? (r[ki] ?? '').trim().toLowerCase() : '';
    if (!code) return errors.push(`Row ${line}: no code.`);
    if (!/^[A-Z0-9][A-Z0-9-]{0,11}$/.test(code)) errors.push(`Row ${line}: "${code}" isn't a valid code (letters, numbers and dashes, up to 12).`);
    if (seen.has(code)) errors.push(`Row ${line}: ${code} appears more than once.`);
    seen.add(code);
    if (!name) errors.push(`Row ${line}: ${code} has no name.`);
    if (!yds) warnings.push(`Row ${line}: ${code} has no yardage.`);
    else if (!/^\d+/.test(yds) && !/warn/i.test(yds)) warnings.push(`Row ${line}: ${code} yardage "${yds}" doesn't start with a number, so it counts as 0 yards in totals.`);
    const category = CATEGORY_ALIASES[rawCat];
    if (ki >= 0 && !category) errors.push(`Row ${line}: ${code} category "${rawCat}" isn't one of: ${CATEGORIES.map((c) => c.id).join(', ')}.`);
    codes.push({ code, name, yds, category: category ?? 'other' });
  });

  if (!codes.length) errors.push('No codes found below the header row.');
  const has = (c: Category) => codes.some((x) => x.category === c);
  if (codes.length && !has('dq-uns')) warnings.push('No "dq-uns" code: the app can warn about a second unsportsmanlike foul but cannot offer a one-tap DQ code.');
  if (codes.length && !(has('sl-warn') && has('sl-5') && has('sl-15'))) warnings.push('Not all three sideline steps (sl-warn, sl-5, sl-15) are present, so the sideline progression check is limited.');
  return { codes, errors, warnings };
}
