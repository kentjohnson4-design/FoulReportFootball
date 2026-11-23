import { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  waitForPendingWrites,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { FoulCode } from './data/codes';
import { db } from './firebase';
import { migrate } from './store';
import { dedupeShared, isShareable, sharedToGames, toShared, type SharedGame } from './stateShare';
import type { CrewPos, Game } from './types';

export interface Profile {
  name: string;
  state: string;
  position: CrewPos | '';
  codeSetId: string;
  createdAt: number;
  /** Consent to add this user's games to the combined team stats for their state. */
  shareStats?: boolean;
}

export interface CodeSetDoc {
  id: string;
  state: string;
  season: string;
  label: string;
  codes: FoulCode[];
  published: boolean;
  updatedAt: number;
}

const gamesCol = (uid: string) => collection(db, 'users', uid, 'games');

export async function getProfile(uid: string): Promise<Profile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as Profile) : null;
}

export async function saveProfile(uid: string, p: Profile) {
  await setDoc(doc(db, 'users', uid), p);
}

export async function checkAdmin(uid: string): Promise<boolean> {
  try {
    return (await getDoc(doc(db, 'admins', uid))).exists();
  } catch {
    return false;
  }
}

export async function listCodeSets(includeDrafts: boolean): Promise<CodeSetDoc[]> {
  const col = collection(db, 'codeSets');
  const snap = await getDocs(includeDrafts ? col : query(col, where('published', '==', true)));
  return snap.docs.map((d) => ({ ...(d.data() as Omit<CodeSetDoc, 'id'>), id: d.id })).sort((a, b) => a.label.localeCompare(b.label));
}

export async function getCodeSet(id: string): Promise<CodeSetDoc | null> {
  const snap = await getDoc(doc(db, 'codeSets', id));
  return snap.exists() ? { ...(snap.data() as Omit<CodeSetDoc, 'id'>), id: snap.id } : null;
}

export async function saveCodeSet(set: CodeSetDoc) {
  const { id, ...data } = set;
  await setDoc(doc(db, 'codeSets', id), data);
}

export async function removeCodeSet(id: string) {
  await deleteDoc(doc(db, 'codeSets', id));
}

export async function deleteCloudGame(uid: string, id: string) {
  await deleteDoc(doc(gamesCol(uid), id));
}

/** Uploads waiting on this device; resolves false if they don't finish within `ms`. */
export async function flushWrites(ms = 5000): Promise<boolean> {
  return Promise.race([waitForPendingWrites(db).then(() => true), new Promise<boolean>((r) => setTimeout(() => r(false), ms))]);
}

export async function deleteAllUserData(uid: string, state?: string) {
  if (state) await unshareAll(uid, state);
  const snap = await getDocs(gamesCol(uid));
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  await deleteDoc(doc(db, 'users', uid));
}

export type SyncState = 'off' | 'connecting' | 'synced' | 'pending' | 'offline' | 'error';

/**
 * Keeps the games on this device and the signed-in user's cloud games in step.
 * The newer copy of a game (by updatedAt) wins. Games that exist only on the device are
 * uploaded, which is how games recorded before signing in move to the account.
 * Deletions are not inferred here; the caller deletes from the cloud explicitly.
 */
export function useCloudSync(user: User | null, games: Game[], setGames: (f: (g: Game[]) => Game[]) => void): SyncState {
  const [state, setState] = useState<SyncState>('off');
  const known = useRef(new Map<string, number>()); // game id -> updatedAt of the cloud copy
  const [ready, setReady] = useState(false);
  const uid = user?.uid ?? null;

  useEffect(() => {
    known.current = new Map();
    setReady(false);
    if (!uid) {
      setState('off');
      return;
    }
    setState('connecting');
    return onSnapshot(
      gamesCol(uid),
      { includeMetadataChanges: true },
      (snap) => {
        const incoming: Game[] = [];
        const removed: string[] = [];
        for (const ch of snap.docChanges()) {
          if (ch.type === 'removed') {
            known.current.delete(ch.doc.id);
            removed.push(ch.doc.id);
          } else {
            const g = migrate({ ...(ch.doc.data() as Game), id: ch.doc.id });
            known.current.set(g.id, g.updatedAt);
            incoming.push(g);
          }
        }
        if (incoming.length || removed.length) {
          setGames((all) => {
            const byId = new Map(all.map((g) => [g.id, g]));
            for (const g of incoming) {
              const cur = byId.get(g.id);
              if (!cur || cur.updatedAt < g.updatedAt) byId.set(g.id, g);
            }
            for (const id of removed) byId.delete(id);
            return [...byId.values()];
          });
        }
        setReady(true);
        setState(snap.metadata.hasPendingWrites ? 'pending' : snap.metadata.fromCache ? 'offline' : 'synced');
      },
      () => setState('error'),
    );
  }, [uid]);

  useEffect(() => {
    if (!uid || !ready) return;
    for (const g of games) {
      if ((known.current.get(g.id) ?? -1) >= g.updatedAt) continue;
      known.current.set(g.id, g.updatedAt);
      setDoc(doc(gamesCol(uid), g.id), JSON.parse(JSON.stringify(g))).catch(() => setState('error'));
    }
  }, [uid, ready, games]);

  return state;
}

// ---- Combined state team stats (opt-in) ----

const sharedCol = (state: string) => collection(db, 'stateStats', state, 'games');
const sharedId = (uid: string, gameId: string) => `${uid}_${gameId}`;

export async function unshareAll(uid: string, state: string) {
  const snap = await getDocs(query(sharedCol(state), where('owner', '==', uid)));
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

export async function unshareGame(uid: string, state: string, gameId: string) {
  await deleteDoc(doc(sharedCol(state), sharedId(uid, gameId)));
}

export async function loadStateGames(state: string, season: string): Promise<{ games: Game[]; contributors: number; records: number }> {
  const col = sharedCol(state);
  const snap = await getDocs(season === 'all' ? col : query(col, where('season', '==', season)));
  const list = snap.docs.map((d) => d.data() as SharedGame);
  return { games: sharedToGames(dedupeShared(list)), contributors: new Set(list.map((g) => g.owner)).size, records: list.length };
}

/**
 * While the user has opted in, keeps their shared copies current. It compares against what
 * is already shared (read once per session) so unchanged games are not uploaded again.
 */
export function useStateSharing(user: User | null, profile: Profile | null | undefined, games: Game[]) {
  const uid = user?.uid ?? null;
  const state = profile?.shareStats ? profile.state : '';
  const known = useRef<Map<string, number> | null>(null);

  useEffect(() => {
    known.current = null;
    if (!uid || !state) return;
    let live = true;
    getDocs(query(sharedCol(state), where('owner', '==', uid)))
      .then((snap) => {
        if (!live) return;
        known.current = new Map(snap.docs.map((d) => [(d.data() as SharedGame).gameId, (d.data() as SharedGame).updatedAt]));
        setTick((t) => t + 1);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [uid, state]);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!uid || !state || !known.current) return;
    for (const g of games) {
      if (!isShareable(g) || (known.current.get(g.id) ?? -1) >= g.updatedAt) continue;
      known.current.set(g.id, g.updatedAt);
      setDoc(doc(sharedCol(state), sharedId(uid, g.id)), toShared(uid, g)).catch(() => known.current?.delete(g.id));
    }
  }, [uid, state, games, tick]);
}
