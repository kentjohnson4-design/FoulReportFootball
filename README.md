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
