// Security-rule tests. Run with `npm run test:rules` (starts the Firestore emulator).
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, getDocs, collection, query, setDoc, where } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;
const game = (id: string) => ({ id, fouls: [], home: 'Central', away: 'North', updatedAt: 1 });
const profile = { name: 'Pat', state: 'OH', position: 'R', codeSetId: 'builtin', createdAt: 1 };
const V = { email_verified: true };
const as = (uid: string) => env.authenticatedContext(uid, V).firestore();
const shared = (uid: string, gameId: string) => ({ owner: uid, gameId, season: '2026', date: '2026-09-04', home: 'Central', away: 'North', homeScore: '7', awayScore: '3', fouls: [{ team: 'H', code: 'OH', player: '55', status: 'A', quarter: 1 }], updatedAt: 1 });
const codeSet = (published: boolean) => ({ state: 'OH', season: '2026', label: 'OH 2026', codes: [{ code: 'OH', name: 'Holding', yds: '10', category: 'other' }], published, updatedAt: 1 });

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'foul-report-football',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins/admin1'), { role: 'admin' });
    await setDoc(doc(db, 'users/alice/games/g1'), game('g1'));
    await setDoc(doc(db, 'codeSets/oh-2026'), codeSet(true));
    await setDoc(doc(db, 'codeSets/tx-2026'), codeSet(false));
    await setDoc(doc(db, 'users/carol'), { ...profile, shareStats: true });
    await setDoc(doc(db, 'users/dave'), { ...profile, shareStats: true });
    await setDoc(doc(db, 'users/erin'), { ...profile, shareStats: false });
    await setDoc(doc(db, 'users/tex'), { ...profile, state: 'TX', shareStats: true });
    await setDoc(doc(db, 'stateStats/OH/games/dave_g1'), shared('dave', 'g1'));
  });
});

describe('games and profiles', () => {
  it('lets a user read and write their own', async () => {
    const db = as('alice');
    await assertSucceeds(getDoc(doc(db, 'users/alice/games/g1')));
    await assertSucceeds(setDoc(doc(db, 'users/alice/games/g2'), game('g2')));
    await assertSucceeds(setDoc(doc(db, 'users/alice'), profile));
    await assertSucceeds(deleteDoc(doc(db, 'users/alice/games/g1')));
  });
  it("blocks other users and signed-out visitors", async () => {
    const bob = as('bob');
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(bob, 'users/alice/games/g1')));
    await assertFails(getDocs(collection(bob, 'users/alice/games')));
    await assertFails(setDoc(doc(bob, 'users/alice/games/g9'), game('g9')));
    await assertFails(getDoc(doc(anon, 'users/alice/games/g1')));
    await assertFails(setDoc(doc(bob, 'users/alice'), profile));
  });
  it('rejects malformed writes', async () => {
    const db = as('alice');
    await assertFails(setDoc(doc(db, 'users/alice/games/g3'), game('other-id')));
    await assertFails(setDoc(doc(db, 'users/alice'), { ...profile, admin: true }));
  });
});

describe('code lists', () => {
  it('anyone can read published lists, nobody but admins sees drafts', async () => {
    const anon = env.unauthenticatedContext().firestore();
    const alice = as('alice');
    await assertSucceeds(getDoc(doc(anon, 'codeSets/oh-2026')));
    await assertSucceeds(getDocs(query(collection(anon, 'codeSets'), where('published', '==', true))));
    await assertFails(getDoc(doc(alice, 'codeSets/tx-2026')));
    await assertFails(getDocs(collection(alice, 'codeSets')));
  });
  it('only admins can change them', async () => {
    const alice = as('alice');
    const admin = as('admin1');
    await assertFails(setDoc(doc(alice, 'codeSets/ca-2026'), codeSet(true)));
    await assertFails(deleteDoc(doc(alice, 'codeSets/oh-2026')));
    await assertSucceeds(getDocs(collection(admin, 'codeSets')));
    await assertSucceeds(setDoc(doc(admin, 'codeSets/ca-2026'), codeSet(false)));
    await assertSucceeds(deleteDoc(doc(admin, 'codeSets/tx-2026')));
  });
  it('nobody can make themselves an admin', async () => {
    const alice = as('alice');
    await assertFails(setDoc(doc(alice, 'admins/alice'), { role: 'admin' }));
    await assertSucceeds(getDoc(doc(alice, 'admins/alice')));
    await assertFails(getDoc(doc(alice, 'admins/admin1')));
  });
});

describe('email verification', () => {
  it('blocks unverified email accounts from their own data', async () => {
    const unverified = env.authenticatedContext('alice', { email_verified: false }).firestore();
    await assertFails(getDoc(doc(unverified, 'users/alice/games/g1')));
    await assertFails(setDoc(doc(unverified, 'users/alice'), profile));
  });
});

describe('combined state stats', () => {
  it('sharers in the state can read everyone’s shared games', async () => {
    await assertSucceeds(getDocs(collection(as('carol'), 'stateStats/OH/games')));
    await assertSucceeds(getDocs(query(collection(as('carol'), 'stateStats/OH/games'), where('season', '==', '2026'))));
  });
  it('people who do not share, or share in another state, cannot', async () => {
    await assertFails(getDocs(collection(as('erin'), 'stateStats/OH/games')));
    await assertFails(getDocs(collection(as('tex'), 'stateStats/OH/games')));
    await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(), 'stateStats/OH/games')));
  });
  it('a sharer can add, update and remove only their own records', async () => {
    const carol = as('carol');
    await assertSucceeds(setDoc(doc(carol, 'stateStats/OH/games/carol_g7'), shared('carol', 'g7')));
    await assertSucceeds(setDoc(doc(carol, 'stateStats/OH/games/carol_g7'), { ...shared('carol', 'g7'), updatedAt: 2 }));
    await assertFails(setDoc(doc(carol, 'stateStats/OH/games/dave_g1'), shared('carol', 'g1')));
    await assertFails(setDoc(doc(carol, 'stateStats/OH/games/carol_g8'), shared('dave', 'g8')));
    await assertFails(setDoc(doc(carol, 'stateStats/OH/games/carol_g9'), { ...shared('carol', 'g9'), crew: { R: 'Pat' } }));
    await assertFails(deleteDoc(doc(carol, 'stateStats/OH/games/dave_g1')));
    await assertSucceeds(deleteDoc(doc(carol, 'stateStats/OH/games/carol_g7')));
  });
  it('cannot share into another state or without consent', async () => {
    await assertFails(setDoc(doc(as('tex'), 'stateStats/OH/games/tex_g1'), shared('tex', 'g1')));
    await assertFails(setDoc(doc(as('erin'), 'stateStats/OH/games/erin_g1'), shared('erin', 'g1')));
  });
  it('someone who stopped sharing can still find and delete their old records', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'stateStats/OH/games/erin_old'), shared('erin', 'old'));
    });
    const erin = as('erin');
    await assertSucceeds(getDocs(query(collection(erin, 'stateStats/OH/games'), where('owner', '==', 'erin'))));
    await assertSucceeds(deleteDoc(doc(erin, 'stateStats/OH/games/erin_old')));
  });
});
