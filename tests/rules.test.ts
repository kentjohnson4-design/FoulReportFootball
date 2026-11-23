// Security-rule tests. Run with `npm run test:rules` (starts the Firestore emulator).
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, getDocs, collection, query, setDoc, where } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;
const game = (id: string) => ({ id, fouls: [], home: 'Central', away: 'North', updatedAt: 1 });
const profile = { name: 'Pat', state: 'OH', position: 'R', codeSetId: 'builtin', createdAt: 1 };
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
  });
});

describe('games and profiles', () => {
  it('lets a user read and write their own', async () => {
    const db = env.authenticatedContext('alice').firestore();
    await assertSucceeds(getDoc(doc(db, 'users/alice/games/g1')));
    await assertSucceeds(setDoc(doc(db, 'users/alice/games/g2'), game('g2')));
    await assertSucceeds(setDoc(doc(db, 'users/alice'), profile));
    await assertSucceeds(deleteDoc(doc(db, 'users/alice/games/g1')));
  });
  it("blocks other users and signed-out visitors", async () => {
    const bob = env.authenticatedContext('bob').firestore();
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(bob, 'users/alice/games/g1')));
    await assertFails(getDocs(collection(bob, 'users/alice/games')));
    await assertFails(setDoc(doc(bob, 'users/alice/games/g9'), game('g9')));
    await assertFails(getDoc(doc(anon, 'users/alice/games/g1')));
    await assertFails(setDoc(doc(bob, 'users/alice'), profile));
  });
  it('rejects malformed writes', async () => {
    const db = env.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(db, 'users/alice/games/g3'), game('other-id')));
    await assertFails(setDoc(doc(db, 'users/alice'), { ...profile, admin: true }));
  });
});

describe('code lists', () => {
  it('anyone can read published lists, nobody but admins sees drafts', async () => {
    const anon = env.unauthenticatedContext().firestore();
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(getDoc(doc(anon, 'codeSets/oh-2026')));
    await assertSucceeds(getDocs(query(collection(anon, 'codeSets'), where('published', '==', true))));
    await assertFails(getDoc(doc(alice, 'codeSets/tx-2026')));
    await assertFails(getDocs(collection(alice, 'codeSets')));
  });
  it('only admins can change them', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    const admin = env.authenticatedContext('admin1').firestore();
    await assertFails(setDoc(doc(alice, 'codeSets/ca-2026'), codeSet(true)));
    await assertFails(deleteDoc(doc(alice, 'codeSets/oh-2026')));
    await assertSucceeds(getDocs(collection(admin, 'codeSets')));
    await assertSucceeds(setDoc(doc(admin, 'codeSets/ca-2026'), codeSet(false)));
    await assertSucceeds(deleteDoc(doc(admin, 'codeSets/tx-2026')));
  });
  it('nobody can make themselves an admin', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(alice, 'admins/alice'), { role: 'admin' }));
    await assertSucceeds(getDoc(doc(alice, 'admins/alice')));
    await assertFails(getDoc(doc(alice, 'admins/admin1')));
  });
});
