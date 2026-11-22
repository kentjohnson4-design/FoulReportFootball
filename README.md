# Foul Report Football

An offline-first web app (PWA) for recording varsity high school football foul reports on a phone or tablet, then sending the report to the game's referee.

## What it does
- Records each penalty with every field from the statewide foul report sheet: quarter, game clock, team (H/V), foul code, O/D/K/R, player number, accepted/declined/offsetting, and calling official (R U L H B D).
- Includes all 81 codes from the 2026 foul report code sheet, searchable by code or name, with recently used codes on top.
- Tracks unsportsmanlike fouls by player and warns on a second one (DQ), follows the sideline progression (SLW → SL5 → UNS-SLM), and lists disqualifications.
- Tracks timeouts per team per half (3 per half, 1 per OT period), coin toss, OT toss, period start/end times, crew, kicker numbers and score.
- Produces a PDF and a plain-text report. The PDF goes out through the phone's share sheet; "Email as text" opens a pre-addressed email.
- Keeps a history of games on the device, with a backup/restore file.

## Develop
```bash
npm install
npm run dev     # local dev server
npm test        # rules and report tests
npm run build   # production build in dist/
```

The foul codes live in `src/data/codes.ts`. Update that file when the code sheet changes each season.
