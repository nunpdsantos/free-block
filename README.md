# Gridlock (Block Blast-style puzzle)

Gridlock is a React + TypeScript + Vite block puzzle game inspired by Block Blast Classic mode.

## Gameplay rules (current)

- 8x8 board
- No gravity
- 3-piece tray; all 3 must be placed before drawing a new tray
- No rotation
- Row/column clears
- Scoring: base cells + combo bonus + streak multiplier
- Perfect clear bonus: 300
- Revives: 3 per classic run
  - Revive clears `min(20, filled)` random filled cells
  - Generates a fresh tray of 3 pieces

## Tech stack

- React 19
- TypeScript
- Vite
- Firebase (Auth + Firestore REST-backed sync/leaderboard)
- PWA via `vite-plugin-pwa`

## Requirements

- Node.js 20+
- npm 10+

## Setup

```bash
npm install
cp .env.example .env
```

Fill Firebase env vars in `.env`:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Optional:

- `VITE_USE_EMULATORS=true`

## Scripts

- `npm run dev` - start Vite dev server
- `npm run build` - type-check + production build
- `npm run lint` - ESLint
- `npm run test:run` - Vitest regression tests
- `npm run preview` - preview production build

## Notes

- Local classic leaderboard key: `gridlock-leaderboard` (top 5)
- Daily results/streaks are stored separately in local storage
