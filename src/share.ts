import { migrate, uid } from './store';
import type { Game } from './types';

// A report link carries the whole report inside the part of the URL after "#".
// Browsers never send that part to the web server, so the report data stays between
// the sender and whoever opens the link. No server or account is involved.

function toB64url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

export async function encodeGame(game: Game): Promise<string> {
  // The referee's email, send history and internal ids are left out of the link.
  const { refereeEmail: _e, sentLog: _s, id: _i, createdAt: _c, updatedAt: _u, ...rest } = game;
  const slim = {
    ...rest,
    fouls: game.fouls.map(({ id: _id, createdAt: _ca, ...f }) => f),
    timeouts: game.timeouts.map(({ id: _id, createdAt: _ca, ...t }) => t),
  };
  const bytes = new TextEncoder().encode(JSON.stringify({ v: 1, g: slim }));
  if (typeof CompressionStream !== 'undefined') return 'z' + toB64url(await pipe(bytes, new CompressionStream('deflate-raw')));
  return 'p' + toB64url(bytes);
}

export async function decodeGame(token: string): Promise<Game> {
  const kind = token[0];
  let bytes = fromB64url(token.slice(1));
  if (kind === 'z') {
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser is too old to open report links. Try a current Safari or Chrome.');
    bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
  } else if (kind !== 'p') throw new Error('This report link is damaged.');
  const data = JSON.parse(new TextDecoder().decode(bytes));
  if (data?.v !== 1 || !data.g) throw new Error('This report link is damaged.');
  const now = Date.now();
  const g = migrate({ ...data.g, id: uid(), createdAt: now, updatedAt: now });
  g.fouls = g.fouls.map((f, i) => ({ ...f, id: uid(), createdAt: now + i }));
  g.timeouts = g.timeouts.map((t, i) => ({ ...t, id: uid(), createdAt: now + i }));
  return g;
}

export function reportUrl(token: string): string {
  return `${location.origin}${location.pathname}#r=${token}`;
}
