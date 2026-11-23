import { useEffect, useState } from 'react';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
  type User,
} from 'firebase/auth';
import { BUILTIN_SET, type CodeSetRef } from './data/codes';
import { auth } from './firebase';
import { deleteAllUserData, getCodeSet, listCodeSets, saveProfile, type CodeSetDoc, type Profile, type SyncState } from './cloud';
import type { CrewPos } from './types';
import { CREW_NAMES, CREW_POSITIONS } from './types';
import { getTheme, setTheme, type ThemeChoice } from './theme';
import { Chips, Field } from './ui';

export const PRIVACY_CONTACT = 'kentjohnson4@gmail.com';

/** Where verification and reset links send people back to. */
const returnUrl = () => ({ url: `${location.origin}${location.pathname}` });

export const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN',
  'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA',
  'WV', 'WI', 'WY',
];

export function authMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-credential': 'That email and password don’t match an account.',
    'auth/wrong-password': 'That email and password don’t match an account.',
    'auth/user-not-found': 'That email and password don’t match an account.',
    'auth/email-already-in-use': 'There’s already an account with that email. Sign in instead.',
    'auth/weak-password': 'Use a password of at least 6 characters.',
    'auth/invalid-email': 'That email address doesn’t look right.',
    'auth/missing-password': 'Enter a password.',
    'auth/network-request-failed': 'No connection. Signing in needs a signal.',
    'auth/too-many-requests': 'Too many tries. Wait a few minutes and try again.',
    'auth/popup-blocked': 'The sign-in window was blocked. Allow pop-ups for this site and try again.',
    'auth/unauthorized-domain': 'This site isn’t allowed to sign in yet. In Firebase: Authentication → Settings → Authorized domains, add this site’s domain.',
    'auth/operation-not-allowed': 'This sign-in method isn’t turned on in Firebase (Authentication → Sign-in method).',
  };
  return map[code] ?? `Something went wrong (${code || (e as Error)?.message || 'unknown error'}).`;
}

const ignorable = (e: unknown) => ['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes((e as { code?: string })?.code ?? '');

export function SignIn(props: { onDone?: () => void }) {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      props.onDone?.();
    } catch (e) {
      if (!ignorable(e)) setMsg({ kind: 'error', text: authMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="signin">
      <button type="button" className="btn block google" disabled={busy} onClick={() => run(() => signInWithPopup(auth, new GoogleAuthProvider()))}>
        <span aria-hidden className="g">G</span> Continue with Google
      </button>
      <div className="or">
        <span>or use email</span>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (mode === 'in') run(() => signInWithEmailAndPassword(auth, email.trim(), password));
          else
            run(async () => {
              const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
              if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
              await sendEmailVerification(cred.user, returnUrl()).catch(() => undefined);
            });
        }}
      >
        {mode === 'up' && (
          <Field label="Your name">
            <input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        )}
        <Field label="Email">
          <input type="email" autoComplete="email" autoCapitalize="off" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Password" hint={mode === 'up' ? 'At least 6 characters' : undefined}>
          <input
            type="password"
            autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <button type="submit" className="btn primary block" disabled={busy}>
          {busy ? 'One moment…' : mode === 'in' ? 'Sign in' : 'Create account'}
        </button>
      </form>
      <div className="signin-links">
        <button type="button" className="btn ghost small" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
          {mode === 'in' ? 'New here? Create an account' : 'Have an account? Sign in'}
        </button>
        {mode === 'in' && (
          <button
            type="button"
            className="btn ghost small"
            onClick={() => {
              if (!email.trim()) return setMsg({ kind: 'error', text: 'Enter your email above first.' });
              run(async () => {
                await sendPasswordResetEmail(auth, email.trim(), returnUrl());
                setMsg({ kind: 'ok', text: `If there's an account for ${email.trim()}, a reset link is on its way.` });
              });
            }}
          >
            Forgot password?
          </button>
        )}
      </div>
      {msg && <p className={msg.kind === 'error' ? 'alert danger' : 'note'}>{msg.text}</p>}
    </div>
  );
}

/** Code lists a user can pick: the built-in sheet plus every published state list. */
export function useCodeSetOptions() {
  const [sets, setSets] = useState<CodeSetDoc[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    listCodeSets(false)
      .then(setSets)
      .catch(() => {
        setSets([]);
        setError(true);
      });
  }, []);
  return { sets, error };
}

export function CodeSetPicker(props: { value: string; state?: string; onChange: (set: CodeSetRef) => void }) {
  const { sets, error } = useCodeSetOptions();
  const [busy, setBusy] = useState(false);
  const options = [...(sets ?? [])].sort((a, b) => Number(b.state === props.state) - Number(a.state === props.state) || a.label.localeCompare(b.label));
  return (
    <Field label="Code list" hint={error ? 'Could not load state lists (no connection?). The built-in list is always available.' : 'Used for new games.'}>
      <select
        value={props.value}
        disabled={busy}
        onChange={async (e) => {
          const id = e.target.value;
          if (id === BUILTIN_SET.id) return props.onChange(BUILTIN_SET);
          const found = sets?.find((s) => s.id === id);
          setBusy(true);
          try {
            const full = found ?? (await getCodeSet(id));
            if (full) props.onChange({ id: full.id, label: full.label, codes: full.codes });
          } finally {
            setBusy(false);
          }
        }}
      >
        <option value={BUILTIN_SET.id}>{BUILTIN_SET.label}</option>
        {options.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label} ({s.codes.length} codes)
          </option>
        ))}
        {props.value !== BUILTIN_SET.id && !options.some((s) => s.id === props.value) && <option value={props.value}>Current list</option>}
      </select>
    </Field>
  );
}

export function SetupProfile(props: {
  user: User;
  existing: Profile | null;
  activeSet: CodeSetRef;
  onSaved: (p: Profile, set: CodeSetRef) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(props.existing?.name ?? props.user.displayName ?? '');
  const [state, setState] = useState(props.existing?.state ?? '');
  const [position, setPosition] = useState<CrewPos | ''>(props.existing?.position ?? '');
  const [set, setSet] = useState<CodeSetRef>(props.activeSet);
  const [share, setShare] = useState(props.existing?.shareStats ?? false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  return (
    <form
      className="setup"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr('');
        const p: Profile = {
          name: name.trim(),
          state,
          position,
          codeSetId: set.id,
          createdAt: props.existing?.createdAt ?? Date.now(),
          // Only stored when on, so the field is absent for everyone who hasn't opted in.
          ...(share ? { shareStats: true } : {}),
        };
        try {
          await saveProfile(props.user.uid, p);
          props.onSaved(p, set);
        } catch (e2) {
          setErr(`Couldn't save: ${(e2 as Error).message}`);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label="Your name" hint="Filled into your crew slot on new games">
        <input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <div className="row2">
        <Field label="State">
          <select value={state} onChange={(e) => setState(e.target.value)} required>
            <option value="">Choose…</option>
            {US_STATES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Usual position">
          <select value={position} onChange={(e) => setPosition(e.target.value as CrewPos | '')}>
            <option value="">Varies</option>
            {CREW_POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p} · {CREW_NAMES[p]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <CodeSetPicker value={set.id} state={state} onChange={setSet} />
      <ShareConsent checked={share} state={state} onChange={setShare} />
      {props.existing?.shareStats && !share && (
        <p className="alert warn">Saving will remove the games you shared from the {props.existing.state} team stats.</p>
      )}
      {err && <p className="alert danger">{err}</p>}
      <div className="send-buttons">
        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? 'Saving…' : props.existing ? 'Save' : 'Finish setup'}
        </button>
        {props.onCancel && (
          <button type="button" className="btn ghost" onClick={props.onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export function ShareConsent(props: { checked: boolean; state: string; onChange: (v: boolean) => void }) {
  return (
    <>
      <label className="share-consent">
        <input type="checkbox" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
        <span>Add my games to the combined team stats for {props.state || 'my state'}</span>
      </label>
      <div className="share-details">
        <p>Optional. Turning it on lets you see every team’s top penalties and most-penalized players across all officials in your state who share.</p>
        <ul>
          <li>
            <b>Shared:</b> game date, schools, final score, and for each foul the team, code, jersey number, quarter and whether it was accepted.
          </li>
          <li>
            <b>Never shared:</b> your name, your crew, clock times, notes, or the referee’s email.
          </li>
          <li>Only signed-in officials in your state who also share can see the combined stats.</li>
          <li>Turning it off removes everything you shared.</li>
        </ul>
      </div>
    </>
  );
}

export function ThemePicker() {
  const [theme, setThemeState] = useState<ThemeChoice>(getTheme);
  return (
    <div className="theme-picker">
      <Chips<ThemeChoice>
        label="Appearance"
        options={['auto', 'light', 'dark']}
        value={theme}
        onChange={(v) => {
          const t = (v || 'auto') as ThemeChoice;
          setTheme(t);
          setThemeState(t);
        }}
        render={(t) => ({ auto: 'Automatic', light: 'Light', dark: 'Dark' })[t]}
      />
      <p className="muted small">Automatic follows your phone’s setting.</p>
    </div>
  );
}

/** Shown after creating an email/password account until the address is confirmed. */
export function VerifyEmail(props: { user: User; onVerified: () => void; onSignOut: () => void }) {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const check = async () => {
    setBusy(true);
    setMsg('');
    try {
      await props.user.reload();
      if (auth.currentUser?.emailVerified) {
        // Refresh the sign-in token so the database sees the confirmed address right away.
        await auth.currentUser.getIdToken(true);
        props.onVerified();
      } else setMsg('Not confirmed yet. Tap the link in the email, then come back and try again.');
    } catch (e) {
      setMsg(authMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="home account">
      <header className="home-head">
        <h1>Confirm your email</h1>
      </header>
      <section className="card">
        <p>
          We sent a link to <b>{props.user.email}</b>. Tap it to confirm your address, then come back here. Check your spam folder if it isn’t there in a
          minute.
        </p>
        <div className="send-buttons">
          <button type="button" className="btn primary" disabled={busy} onClick={check}>
            I’ve confirmed it
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={async () => {
              try {
                await sendEmailVerification(props.user, returnUrl());
                setMsg(`Sent another link to ${props.user.email}.`);
              } catch (e) {
                setMsg(authMessage(e));
              }
            }}
          >
            Send the link again
          </button>
          <button type="button" className="btn ghost" onClick={props.onSignOut}>
            Sign out
          </button>
        </div>
        {msg && <p className="note">{msg}</p>}
        <p className="muted small">Until then, you can sign out and keep using the app without an account.</p>
      </section>
    </div>
  );
}

const SYNC_TEXT: Record<SyncState, string> = {
  off: 'Not signed in: games are saved on this device only.',
  connecting: 'Connecting to your account…',
  synced: 'All games are saved to your account.',
  pending: 'Saving changes to your account…',
  offline: 'No connection. Changes are saved on this device and will upload when you’re back online.',
  error: 'Sync problem. Your games are still saved on this device; check your connection and reopen the app.',
};

export function SyncBadge(props: { state: SyncState }) {
  return <span className={`sync sync-${props.state}`}>{SYNC_TEXT[props.state]}</span>;
}

export function AccountScreen(props: {
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  sync: SyncState;
  activeSet: CodeSetRef;
  onSetChange: (set: CodeSetRef) => void;
  onProfileSaved: (p: Profile, set: CodeSetRef) => void;
  onSignOut: () => void;
  onDeleted: () => void;
  onBack: () => void;
  onAdmin: () => void;
  onPrivacy: () => void;
}) {
  const { user, profile } = props;
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const isPasswordUser = user?.providerData.some((p) => p.providerId === 'password');

  const deleteAccount = async () => {
    if (!user) return;
    setMsg('');
    try {
      // Firebase only deletes an account right after a fresh sign-in, so confirm first.
      if (isPasswordUser) await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email ?? '', password));
      else await reauthenticateWithPopup(user, new GoogleAuthProvider());
      await deleteAllUserData(user.uid, profile?.shareStats ? profile.state : undefined);
      await deleteUser(user);
      props.onDeleted();
    } catch (e) {
      if (!ignorable(e)) setMsg(authMessage(e));
    }
  };

  return (
    <div className="home account">
      <header className="home-head">
        <button type="button" className="btn ghost back-link" onClick={props.onBack}>
          ‹ Games
        </button>
        <h1>{user ? 'Your account' : 'Sign in'}</h1>
      </header>

      {!user ? (
        <>
          <section className="card">
            <p>
              An account keeps your games in the cloud, so they’re safe if you lose your phone and they show up on your tablet too. Games already on this
              device are copied into your account when you sign in.
            </p>
            <SignIn />
          </section>
          <section className="card">
            <h3>Without an account</h3>
            <CodeSetPicker value={props.activeSet.id} onChange={props.onSetChange} />
          </section>
        </>
      ) : (
        <>
          <section className="card">
            <p className="kv">
              <span>Signed in as</span>
              <b>{user.email}</b>
            </p>
            <SyncBadge state={props.sync} />
          </section>
          <section className="card">
            <div className="card-head">
              <h3>Profile</h3>
              {!editing && profile && (
                <button type="button" className="btn small" onClick={() => setEditing(true)}>
                  Edit
                </button>
              )}
            </div>
            {editing || !profile ? (
              <SetupProfile
                user={user}
                existing={profile}
                activeSet={props.activeSet}
                onSaved={(p, s) => {
                  props.onProfileSaved(p, s);
                  setEditing(false);
                }}
                onCancel={profile ? () => setEditing(false) : undefined}
              />
            ) : (
              <>
                <p className="kv">
                  <span>Name</span>
                  <b>{profile.name}</b>
                </p>
                <p className="kv">
                  <span>State</span>
                  <b>{profile.state}</b>
                </p>
                <p className="kv">
                  <span>Usual position</span>
                  <b>{profile.position ? `${profile.position} · ${CREW_NAMES[profile.position]}` : 'Varies'}</b>
                </p>
                <p className="kv">
                  <span>Code list</span>
                  <b>{props.activeSet.label}</b>
                </p>
                <p className="kv">
                  <span>State team stats</span>
                  <b>{profile.shareStats ? `Sharing with ${profile.state}` : 'Not sharing'}</b>
                </p>
              </>
            )}
          </section>
          {props.isAdmin && (
            <section className="card">
              <h3>Admin</h3>
              <button type="button" className="btn primary" onClick={props.onAdmin}>
                Manage state code lists
              </button>
            </section>
          )}
          <section className="card">
            <h3>Account</h3>
            <div className="send-buttons">
              <button type="button" className="btn" onClick={props.onSignOut}>
                Sign out
              </button>
              <button type="button" className="btn ghost danger" onClick={() => setDeleting(!deleting)}>
                Delete account…
              </button>
            </div>
            {deleting && (
              <div className="danger-zone">
                <p>This permanently deletes your account and every game saved in it. Save a backup from the Games screen first if you want to keep them.</p>
                {isPasswordUser && (
                  <Field label="Confirm your password">
                    <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  </Field>
                )}
                <button type="button" className="btn danger" onClick={deleteAccount}>
                  {isPasswordUser ? 'Delete my account' : 'Confirm with Google and delete'}
                </button>
              </div>
            )}
            {msg && <p className="alert danger">{msg}</p>}
            <p className="muted small">
              Account ID: <code>{user.uid}</code>{' '}
              <button type="button" className="btn ghost small" onClick={() => navigator.clipboard?.writeText(user.uid)}>
                Copy
              </button>
            </p>
          </section>
        </>
      )}
      <section className="card">
        <h3>Appearance</h3>
        <ThemePicker />
      </section>
      <p className="muted small">
        <button type="button" className="btn ghost small" onClick={props.onPrivacy}>
          Privacy
        </button>
      </p>
    </div>
  );
}

export function PrivacyScreen(props: { onBack: () => void }) {
  return (
    <div className="home account prose">
      <header className="home-head">
        <button type="button" className="btn ghost back-link" onClick={props.onBack}>
          ‹ Back
        </button>
        <h1>Privacy</h1>
      </header>
      <section className="card">
        <h3>Without an account</h3>
        <p>Everything you enter stays in this browser on this device. Nothing is sent anywhere until you share a report yourself.</p>
        <h3>With an account</h3>
        <p>
          You must confirm your email address (Google accounts are already confirmed). Your email address, name, state, usual position and the games you record (teams, crew names, fouls with jersey numbers, timeouts, notes and the
          referee email you entered) are stored in Google Firebase so you can reach them from your devices. Only you can read your games. They are not sold,
          shared or used for advertising.
        </p>
        <h3>Combined state team stats (only if you opt in)</h3>
        <p>
          If you turn on sharing in your profile, a reduced copy of each finished game is added to your state’s combined stats: the date, the two schools,
          the final score, and for each foul the team, code, jersey number, quarter and result. Your name, crew, clock times, notes and the referee’s email
          are not included. Only signed-in officials in the same state who also share can see the combined stats. Turning sharing off, or deleting your
          account, removes your shared copies.
        </p>
        <h3>Report links</h3>
        <p>
          A report link carries the report inside the link itself, after the “#”. Web servers never receive that part, so the report goes only to whoever
          you send the link to. The referee’s email address is left out of links.
        </p>
        <h3>Deleting your data</h3>
        <p>Account → Delete account removes your account and all games stored in it. Without an account, deleting a game removes it from the device.</p>
        <h3>Contact</h3>
        <p>
          Questions or requests about your data: <a href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a>
        </p>
      </section>
    </div>
  );
}
