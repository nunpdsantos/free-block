# CLAUDE.md

## Project

**Name:** Free Block
**Stack:** React 19, TypeScript, Vite 7, CSS (no UI library), Firebase (Auth + Firestore)
**Repo:** github.com/nunpdsantos/free-block
**Live:** gridlock-gilt.vercel.app
**PWA:** Installable on mobile via manifest.json + vite-plugin-pwa

## Commands

- `npm run build` — TypeScript check + Vite production build (also generates service worker)
- CI: GitHub Actions runs `npm ci && npm run build` on push to main and PRs (`.github/workflows/ci.yml`)

## Architecture

### Game engine (`src/game/`)
- `constants.ts` — All tunable values: grid size, FINGER_OFFSET=30, scoring (POINTS_PER_CELL_PLACED=1, POINTS_PER_CELL=10, COMBO_BASE_BONUS=20, COMBO_INCREMENT=10, STREAK_MULTIPLIER_INCREMENT=0.5), animation timing (CLEAR_ANIMATION_MS=280, CLEAR_STAGGER_MS=12, CLEAR_ANTICIPATION_MS=50), DDA thresholds, piece colors (8 high-saturation colors), REVIVES_PER_GAME=2. Runtime sizing comes from CSS vars.
- `responsive.ts` — `getCSSPx(name)` reads resolved CSS custom property values from `:root`
- `types.ts` — Board, PieceShape, GameState (includes `turnHadClear` for per-tray streak tolerance), GameAction, UndoSnapshot, GameMode, DailyResult, LeaderboardEntry, GlobalLeaderboardEntry, PlayerStats, AchievementProgress, DailyStreak
- `logic.ts` — Pure functions: placement, line clearing, scoring (`calculateScore`: base + additive combo bonus × streak multiplier), revive cell removal
- `pieces.ts` — 15 piece families (37 orientations), weighted random selection with DDA, piece-fit validation (20 retries + 1×1 fallback), `generateDailyPieces` for seeded daily mode, `generateRevivePieces` for pity-weighted selection without fit-check (revive carves its own space)
- `reducer.ts` — useReducer state machine: PLACE_PIECE (awards placement points + clear points, per-tray streak tolerance via `turnHadClear`), NEW_GAME, NEW_DAILY_GAME, REVIVE, DISMISS_CELEBRATION (UNDO action exists but disabled via UNDOS_PER_GAME=0)
- `themes.ts` — 5 color themes (Classic, Midnight, Ocean, Sunset, Neon) with per-theme CSS variables, background palettes, and optional `requiredAchievement` for unlock gating
- `random.ts` — Mulberry32 seeded PRNG, date-to-seed conversion, day number utilities (uses `Date.UTC` for timezone safety), `getYesterdayDateStr()`
- `achievements.ts` — 20 achievement definitions (bronze/silver/gold tiers) with optional `progress()` for trackable indicators, `checkAchievements()` returns newly unlocked IDs, `getAchievementById()` lookup. Endgame tier: Mythic (35k), Line Legend (1k lines), Veteran (100 games), Daily Legend (30-day streak), Unstoppable (15-streak)

### Firebase (`src/firebase/`)
- `config.ts` — Firebase init (`initializeApp`, `getAuth`, `initializeFirestore` with `persistentLocalCache` for offline PWA support). Exports `auth` + `db`. Emulator support via `VITE_USE_EMULATORS=true` env var.
- `leaderboard.ts` — All Firestore I/O uses direct REST API (bypasses SDK persistent cache which fails with composite-index queries). `submitScore(uid, displayName, score, mode)` writes via REST PATCH; `fetchTopScores(mode)` reads via REST structured query filtered by mode. On 403 (security rules rejection), `writeScoreREST` reads the server's actual score via `readScoreREST` and syncs localStorage best to prevent infinite retries.
- `names.ts` — `generateDisplayName()` returns `Adjective_Noun` pattern (30x30 = 900 combos) for anonymous players.

### Auth (`src/hooks/useAuth.ts`)
- Auto signs in anonymously on first load (persistent UID). Optional Google sign-in via `linkWithPopup` upgrades anonymous account, preserving UID and scores. Falls back to `signInWithPopup` if linking fails (e.g. Google account already linked elsewhere). Sign-out creates a new anonymous account automatically.
- Display names stored in Firestore `users/{uid}` doc. Google users get their Google display name; anonymous users get a generated name.

### Audio (`src/audio/`)
- `synth.ts` — Web Audio API synthesizer using sine/triangle waves, pentatonic scale (C5-E6), ADSR envelopes. Master `GainNode` for volume control via `setMasterVolume()`.
- `sounds.ts` — Sound playback controller with volume level (0-100), haptic feedback via `navigator.vibrate()` suppressed when muted (volume=0). Events: place, clear, all-clear, game over, revive, achievement. Migrates old `gridlock-muted` key to `gridlock-volume`.

### Key patterns
- Game state is a `useReducer` — all mutations go through `reducer.ts`
- Responsive scaling: CSS custom properties in `:root` (`--cell-size`, `--cell-gap`, `--board-padding`, `--preview-cell`, `--finger-offset`) drive all board/piece/drag sizing. `--cell-size: min(48px, calc((100vw - 58px) / 8), calc((100dvh - 170px) / 10))` caps at 48px on large viewports, scales down on narrow screens AND short viewports (the `/10` accounts for board + tray height together). JS reads resolved values via `getCSSPx()` from `responsive.ts` — uses a persistent hidden element to resolve CSS expressions (`calc`, `min`, `clamp`) that `parseFloat` can't parse. Board, Cell, PiecePreview, PieceTray CSS all use `var()` references — no hardcoded pixel sizes for layout.
- Drag system (`hooks/useDrag.ts`) — imperative DOM overlay (zero React rendering on pointer move), caches `getBoundingClientRect` + computed padding + responsive CSS values once per drag start. Magnetic snap: `findNearestValidPlacement` searches expanding rings around raw grid position (SNAP_RADIUS_DRAG=1 during move, SNAP_RADIUS_DROP=2 on release). Haptic click (4ms vibrate) fires when ghost snaps to valid position. Uses `pointerrawupdate` when available + coalesced events for lowest-latency overlay tracking. Ghost cell updates (React state) are rAF-throttled — overlay moves at hardware poll rate (120-240 Hz) while React re-renders at most once per display frame (60 Hz). `useDeferredValue` on dragState/ghostCells keeps line-completion preview non-blocking
- Block design: two-tier gemstone — thick outer bevel (`box-shadow inset` 5px top/bottom at 0.7/0.8, 4.5px sides at 0.4/0.55), dark groove channel (`0 0 0 1px rgba(0,0,0,0.35)` on `::before`), recessed inner face (`::before` with `inset: 4px`, convex gloss gradient 140deg bright→dark). 3px outer radius, 2px inner. Board bg `#161A33`, empty cells `#1E2244`. DragOverlay matches with heavier drop shadow (`0 5px 16px`). PiecePreview uses proportionally scaled bevels (3.5px/3px, `inset: 3px` face, 0.5px channel)
- Line-clear animations use a three-phase approach: (1) anticipation pulse (all clearing cells flash simultaneously, 50ms), (2) staggered cascade (per-cell 12ms delays via `clearingCells` Map + CSS animation-delay, 240ms cell-clear animation), (3) dispatch fires after total animation completes (~414ms total). Post-clear settle bounce (200ms) on adjacent surviving cells
- Piece generation uses 5 multiplicative DDA systems: score ramp, pity timer, solution boost, streak pushback, board-state awareness
- Revive (2 per game) uses piece-aware surgical clearing: generates 3 pity-weighted pieces first (`generateRevivePieces`), then `clearCellsForRevive` finds the minimum cells to remove so each piece can fit (greedy sequential — clears for piece 1, then piece 2 may already fit from piece 1's clearing, etc.). Typical removal: 5-12 cells vs old approach of 16-24. Resets streak to 0 and sets movesSinceLastClear to PITY_THRESHOLD. `postReviveGrace` penalty: if player can't place all 3 post-revive pieces, loses 1 extra revive (not all). GameOver button shows remaining count: "Revive (2 left)"
- Theme system: `App.tsx` stores `themeId` in localStorage, applies CSS vars via `applyTheme()`, passes to Game → PauseMenu. 3 themes locked behind achievements: Ocean (Clean Slate), Sunset (Inferno), Neon (No Safety Net). Classic + Midnight always free. Falls back to Classic if selected theme is locked. PauseMenu swatches show lock icon + tooltip on locked themes.
- Background palette cycles through 6 theme-specific colors as score increases, using CSS variable transitions. Each palette has tense variants (`bgTense`/`bgDarkTense`); tension signal interpolates toward them via `color-mix(in oklch, ...)`
- Board danger states: 3-tier system based on fill ratio — warning (72%+: orange glow, 2s breathing pulse), danger (82%+: red overlay, 1.2s breathing, 0.8s pulse), critical (90%+: intense red overlay, 0.7s breathing, 0.5s pulse). CSS classes `board--warning`/`board--danger`/`board--critical` with breathing scale animations
- Tension-reactive visuals: `tension` (0-1) derived from `movesSinceLastClear` (60%) + `fillRatio` (40%) drives background desaturation, ambient particle speed/opacity/hue shift, and clear burst particles. `pressure` (0-1, with dead zone at 0.25) drives board-edge vignette via `--pressure` CSS var with red tint layer
- Streak glow has 5 tiers: streak (1-2), hot (3-4), fire (5-7), whitehot (8-10), supernova (11+). All use static `box-shadow` + animated `outline-color` only (no animated box-shadow). Streak badge in ScoreDisplay scales with tier (22px base / 26px hot / 30px fire) with color-coded pulse
- Score counter animates smoothly via `useAnimatedNumber` hook (ease-out cubic over 200ms). Score bump uses WAAPI (scale 1.18 + brightness 1.3 overshoot). Score pop overlay: 38px bold, 0.55s slam-and-float animation
- Scoring: placement points (piece.coords.length × POINTS_PER_CELL_PLACED) on every placement + clear points (base + additive combo + streak multiplier) when lines clear. Per-tray streak tolerance: non-clearing placements don't break streak; streak only resets when a full tray of 3 pieces produces zero clears
- `pieceGeneration` counter in game state drives piece tray entrance animations (React key change → remount → CSS animation)
- Undo system: disabled (UNDOS_PER_GAME=0). Infrastructure remains — PLACE_PIECE snapshots only when undosRemaining > 0, UNDO restores snapshot. Re-enable by setting constant > 0.
- Daily challenge: seeded PRNG (mulberry32) ensures identical piece sequence per date, no DDA/revive/undo. Resets at local midnight.
- Score saving: `handleGameOver` in `App.tsx` saves to local leaderboard and submits to global Firestore leaderboard in one pass. `Game.tsx` no longer has `saveScore` or `onSaveScore` — all score persistence is in App.
- Stats system: `App.tsx` owns `PlayerStats` via `useLocalStorage('gridlock-stats')`. `Game.tsx` reports events upward via `onStatsUpdate` (pieces placed, lines cleared, streak, all-clear in `handleDrop`) and `onGameOver` (games played, total score, revives used, no-revive high score).
- Achievement system: centralized in `App.tsx`. A `useEffect` watching `stats` + `dailyStreak` runs `checkAchievements()` from `achievements.ts`. Newly unlocked achievements queue as toasts. `AchievementProgress` stored in `gridlock-achievements` (Record of id → timestamp).
- Daily streak: updated in `handleDailySaveResult` — compares `lastPlayedDate` to today/yesterday to increment or reset. Stored in `gridlock-daily-streak`. Stale streaks reset to 0 on app mount if `lastPlayedDate` is neither today nor yesterday.
- Achievement toast queue: `toastQueue` state in `App.tsx`, dequeues from front on dismiss. Each auto-dismisses after 3s. Rendered globally via `AchievementToast` (fixed position, z-index 9999). Plays `synthAchievement()` fanfare (C5→G5 rising fifth + E5 fill + sparkle noise) on unlock.
- Game context ref: `gameContextRef` in `App.tsx` holds in-game state (score, revives remaining, last clear count) updated by `Game.tsx` via `onGameContextUpdate` callback — allows achievement checks to access live game state without prop drilling.

### Screen flow
```
App (screen state + leaderboard + theme + daily results + stats + achievements + streak + toast queue)
├── MainMenu → Play, Daily Challenge, Profile, How to Play
│   ├── DailyStreakBadge (flame icon + count, 3 visual tiers: warm/hot/fire)
│   └── Install App button (Android: triggers beforeinstallprompt, iOS: shows share instructions, hidden when installed)
├── Tutorial → Paginated 4-step stepper with dots + back/next
├── ProfileScreen → AuthStrip + Tabbed container (Stats | Achievements | Leaderboard)
│   ├── AuthStrip → Shows display name + Google sign-in/sign-out button
│   ├── StatsContent → 8 stat cards in 2-col grid
│   ├── AchievementsContent → 20 achievements gallery (locked/unlocked, tiers, progress bars)
│   └── LeaderboardContent → Global/Local toggle + Classic/Daily mode sub-toggle; global shows top 20 per mode with player names + current user highlight + "Syncing..." cache indicator
├── DailyCalendar → Completed daily challenges list with share
└── Game (mode: classic | daily) → Board, PieceTray, DragOverlay, ScoreDisplay
    ├── PauseMenu overlay (volume slider + theme picker with lock states + restart/quit)
    ├── GameOver overlay (classic: Revive/Play Again/Menu; daily: Share/Calendar/Menu)
    ├── CelebrationText (line clear feedback)
    ├── Confetti (multi-clear particles)
    └── Offline badge (when navigator.onLine is false)
AchievementToast (global, renders across all screens)
```

## Gotchas

- `PIECE_COLORS` keys are used as the color pool — adding/removing colors changes piece variety
- Piece-fit validation in `generateThreePieces` validates each piece independently against the current board (not sequential simulation)
- `clearCellsForRevive(board, pieces)` is deterministic for a given board+pieces — it always picks the position with the fewest blocking cells for each piece. The randomness comes from `generateRevivePieces` piece selection, not from the clearing algorithm
- DragOverlay is pure imperative DOM (`useDrag.ts` creates/positions/removes elements directly) — no React component, no `createPortal`. CSS lives in `DragOverlay.css`, imported by the hook
- CSS variables defined in `:root` in `App.css` — theme system overrides color vars via `applyTheme()` in `themes.ts`. Sizing vars (`--cell-size`, `--cell-gap`, etc.) are not theme-dependent
- `PiecePreview.tsx` calls `getCSSPx()` on every render (not cached) since values resolve from live CSS so orientation changes work automatically. `getCSSPx` uses a persistent hidden `<div>` to resolve CSS expressions (calc/min/clamp) that `parseFloat` alone cannot parse. `useDrag.ts` caches CSS values once per drag start
- Background palette effect sets `--bg`/`--bg-dark` on `document.documentElement` during gameplay (may use `color-mix(in oklch, ...)` when tension > 0); resets to theme default on game exit
- `clearingCells` is a `Map<string, number>` (key → delay in ms), not a Set — the delay drives staggered cascade animation via `animation-delay` on each cell
- `CLEAR_ANIMATION_MS` (280ms) is the JS timer duration; CSS `cell-clear` animation is 240ms. Total clear time = `CLEAR_ANTICIPATION_MS(50) + CLEAR_ANIMATION_MS(280) + (GRID_SIZE - 1) * CLEAR_STAGGER_MS(12)` ≈ 414ms
- Cell CSS uses `contain: layout style` for paint isolation — no `will-change` on base cells (only added during clearing/shatter animations)
- PWA service worker is auto-generated by vite-plugin-pwa on build — no manual sw.js file
- Daily mode uses `mulberry32(seed + pieceGeneration)` for each tray refresh — deterministic regardless of move order. Both `getTodayDateStr()` and `getDayNumber()` use local time, not UTC.
- Volume slider persists to `gridlock-volume` (0-100); synth master GainNode applies it in real time
- `gridlock-stats` stores cumulative `PlayerStats`; `gridlock-achievements` stores `AchievementProgress` (id → timestamp); `gridlock-daily-streak` stores `DailyStreak` — all initialize to defaults for existing users (no migration)
- Achievement checks run on every `stats` or `dailyStreak` change via `useEffect` — in-game achievements (score thresholds, combo_king, survivor) rely on `gameContextRef` being updated by `Game.tsx` before the stats update triggers the check
- `DailyStreakBadge` returns `null` when `currentStreak <= 0` — no empty space on main menu for new users
- Firebase config uses `VITE_` prefixed env vars (Vite exposes only `VITE_` vars to client). Create `.env` from `.env.example` with real Firebase project values. Vercel needs the same vars in project settings.
- `useAuth` auto-creates anonymous accounts — every visitor gets a UID without any user action. Google sign-in `linkWithPopup` preserves the anonymous UID so all prior scores stay attached.
- `authRef` in `App.tsx` avoids re-creating `handleGameOver` on every auth state change — reads uid/displayName from a ref instead of closing over `user`/`displayName` state.
- Firestore `persistentLocalCache` with `persistentSingleTabManager` handles offline writes — scores submitted offline queue automatically and sync when back online.
- `firestore.rules` at project root — deploy via `firebase deploy --only firestore:rules`. Leaderboard entries are create-or-update (score must increase on update), uid must match auth, score 1-999999. `firestore.indexes.json` defines composite index on `(mode ASC, score DESC)` — deploy via `firebase deploy --only firestore:indexes`.
