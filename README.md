# Foul Report Football

**Live app:** https://kentjohnson4-design.github.io/FoulReportFootball/

An offline-first web app (PWA) for recording varsity high school football foul reports on a phone or tablet, then sending the report to the game's referee.

## What it does
- Records each penalty with every field from the statewide foul report sheet: quarter, game clock, team (H/V), foul code, O/D/K/R, player number, accepted/declined/offsetting, and calling official (R U L H B D).
- Includes all 81 codes from the 2026 foul report code sheet, searchable by code or name, with recently used codes on top.
- Tracks unsportsmanlike fouls by player and warns on a second one (DQ), follows the sideline progression (SLW → SL5 → UNS-SLM), and lists disqualifications.
- Tracks timeouts per team per half (3 per half, 1 per OT period), coin toss, OT toss, period start/end times, crew, kicker numbers and score.
- Produces a PDF and a plain-text report. The PDF goes out through the phone's share sheet; "Email as text" opens a pre-addressed email.
- Keeps a history of games on the device, with a backup/restore file.
- New-game sheet with home and visiting school names, referee email and crew, suggesting names used before.
- Undo after saving, editing or deleting a foul; tap any foul to edit it.
- Most-called codes at the top of the picker (from your own history), and search by code, name or nickname ("pi", "hold def", "facemask").
- Guided end of quarter, halftime (timeout reset, 2nd-half receiver) and end of game (final score, completeness check).
- Tracks whether each report was sent, and flags reports changed after sending.
- Season stats per official (flags credited to the crew member at the calling position) and history per team.
- A report link in the PDF and email: the referee opens it in any browser to see the full report, download the PDF, or save it. The report travels inside the link, after the `#`, so it never reaches a server; the referee's email is left out.

## Develop
```bash
npm install
npm run dev     # local dev server
npm test        # rules and report tests
npm run build   # production build in dist/
```

The foul codes live in `src/data/codes.ts`. Update that file when the code sheet changes each season.

## Accounts and cloud sync (Firebase)

Accounts are optional. Without one, games stay on the device. With one, games sync to Firebase (Firestore) and work offline; changes upload when there is signal.

- Sign-in: email/password and Google (Firebase Authentication).
- Data: `users/{uid}` (profile) and `users/{uid}/games/{gameId}`; only the owner can read or write them.
- State code lists: `codeSets/{state-season}`; anyone can read published lists, only admins can write.
- Admins: a document in `admins/{uid}`, created by hand in the Firebase console. No email addresses are stored in this repo.

### One-time Firebase setup
1. Firestore Database → Rules: paste `firestore.rules` and click Publish.
2. Authentication → Settings → Authorized domains: make sure `kentjohnson4-design.github.io` is listed.
3. Make yourself an admin: sign in to the app, open Account, copy your Account ID, then in Firestore Database → Data click "Start collection", collection ID `admins`, document ID = your Account ID, add a field `role` = `admin`, Save.

### Develop against local emulators
```bash
npx firebase emulators:start --only auth,firestore   # needs Java
npm run dev:emulator
npm run test:rules                                    # security-rule tests
```

### Code list CSV format
Header `code,name,yards,category`; category is one of `other, pf, uns, dq, dq-uns, sl-warn, sl-5, sl-15`. The admin page has a template download.
