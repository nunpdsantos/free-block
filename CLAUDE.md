# CLAUDE.md

## Project

**Name:** Gridlock
**Stack:** React 19, TypeScript, Vite 7, CSS (no UI library)
**Repo:** github.com/nunpdsantos/gridlock
**Live:** gridlock-gilt.vercel.app
**PWA:** Installable on mobile via manifest.json + vite-plugin-pwa

## Commands

- `npm run build` — TypeScript check + Vite production build (also generates service worker)

## Architecture

### Game engine (`src/game/`)
- `constants.ts` — All tunable values: grid size, scoring, DDA thresholds, piece colors, revive limit. `CELL_SIZE`/`CELL_GAP`/`FINGER_OFFSET` remain as static max/fallback values — runtime sizing comes from CSS vars
- `responsive.ts` — `getCSSPx(name)` reads resolved CSS custom property values from `:root`
- `types.ts` — Board, PieceShape, GameState, GameAction, UndoSnapshot, GameMode, DailyResult, LeaderboardEntry, PlayerStats, AchievementProgress, DailyStreak
- `logic.ts` — Pure functions: placement, line clearing, scoring, revive cell removal
- `pieces.ts` — 15 piece families (37 orientations), weighted random selection with DDA, piece-fit validation (20 retries + 1×1 fallback), `generateDailyPieces` for seeded daily mode, `generateRevivePieces` for pity-weighted selection without fit-check (revive carves its own space)
- `reducer.ts` — useReducer state machine: PLACE_PIECE, NEW_GAME, NEW_DAILY_GAME, REVIVE, DISMISS_CELEBRATION (UNDO action exists but disabled via UNDOS_PER_GAME=0)
- `themes.ts` — 5 color themes (Classic, Midnight, Ocean, Sunset, Neon) with per-theme CSS variables, background palettes, and optional `requiredAchievement` for unlock gating
- `random.ts` — Mulberry32 seeded PRNG, date-to-seed conversion, day number utilities, `getYesterdayDateStr()`
- `achievements.ts` — 20 achievement definitions (bronze/silver/gold tiers) with optional `progress()` for trackable indicators, `checkAchievements()` returns newly unlocked IDs, `getAchievementById()` lookup. Endgame tier: Mythic (50k), Line Legend (1k lines), Veteran (100 games), Daily Legend (30-day streak), Unstoppable (15-streak)

### Audio (`src/audio/`)
- `synth.ts` — Web Audio API synthesizer using sine/triangle waves, pentatonic scale (C5-E6), ADSR envelopes. Master `GainNode` for volume control via `setMasterVolume()`.
- `sounds.ts` — Sound playback controller with volume level (0-100), haptic feedback via `navigator.vibrate()` suppressed when muted (volume=0). Events: place, clear, all-clear, game over, revive, achievement. Migrates old `gridlock-muted` key to `gridlock-volume`.

### Key patterns
- Game state is a `useReducer` — all mutations go through `reducer.ts`
- Responsive scaling: CSS custom properties in `:root` (`--cell-size`, `--cell-gap`, `--board-padding`, `--preview-cell`, `--finger-offset`) drive all board/piece/drag sizing. `--cell-size: min(48px, calc((100vw - 58px) / 8), calc((100dvh - 170px) / 10))` caps at 48px on large viewports, scales down on narrow screens AND short viewports (the `/10` accounts for board + tray height together). JS reads resolved values via `getCSSPx()` from `responsive.ts` — uses a persistent hidden element to resolve CSS expressions (`calc`, `min`, `clamp`) that `parseFloat` can't parse. Board, Cell, PiecePreview, PieceTray CSS all use `var()` references — no hardcoded pixel sizes for layout.
- Drag system (`hooks/useDrag.ts`) caches `getBoundingClientRect` + computed padding + responsive CSS values (`totalCellRef`, `fingerOffsetRef`) once per drag start, batches updates via `requestAnimationFrame`, skips redundant ghost re-renders
- Line-clear animations use a two-phase approach: visual animation plays first (via `clearingCells` Map with per-cell stagger delays + CSS), then `dispatch` fires after animation completes
- Piece generation uses 5 multiplicative DDA systems: score ramp, pity timer, solution boost, streak pushback, board-state awareness
- Revive (3 per game) uses piece-aware surgical clearing: generates 3 pity-weighted pieces first (`generateRevivePieces`), then `clearCellsForRevive` finds the minimum cells to remove so each piece can fit (greedy sequential — clears for piece 1, then piece 2 may already fit from piece 1's clearing, etc.). Typical removal: 5-12 cells vs old approach of 16-24. Resets streak to 0 and sets movesSinceLastClear to PITY_THRESHOLD. `postReviveGrace` flag means if player can't place all 3 post-revive pieces, remaining revives are forfeited
- Theme system: `App.tsx` stores `themeId` in localStorage, applies CSS vars via `applyTheme()`, passes to Game → PauseMenu. 3 themes locked behind achievements: Ocean (Clean Slate), Sunset (Inferno), Neon (No Safety Net). Classic + Midnight always free. Falls back to Classic if selected theme is locked. PauseMenu swatches show lock icon + tooltip on locked themes.
- Background palette cycles through 6 theme-specific colors as score increases, using CSS variable transitions. Each palette has tense variants (`bgTense`/`bgDarkTense`); tension signal interpolates toward them via `color-mix(in oklch, ...)`
- Tension-reactive visuals: `tension` (0-1) derived from `movesSinceLastClear` (60%) + `fillRatio` (40%) drives background desaturation, ambient particle speed/opacity/hue shift, and clear burst particles. `pressure` (0-1, with dead zone) drives board-edge vignette via `--pressure` CSS var
- Streak glow has 5 tiers: streak (1-2), hot (3-4), fire (5-7), whitehot (8-10), supernova (11+). All use static `box-shadow` + animated `outline-color` only (no animated box-shadow)
- Score counter animates smoothly via `useAnimatedNumber` hook (ease-out cubic over 300ms)
- `pieceGeneration` counter in game state drives piece tray entrance animations (React key change → remount → CSS animation)
- Undo system: disabled (UNDOS_PER_GAME=0). Infrastructure remains — PLACE_PIECE snapshots only when undosRemaining > 0, UNDO restores snapshot. Re-enable by setting constant > 0.
- Daily challenge: seeded PRNG (mulberry32) ensures identical piece sequence per date, no DDA/revive/undo. Resets at local midnight.
- Stats system: `App.tsx` owns `PlayerStats` via `useLocalStorage('gridlock-stats')`. `Game.tsx` reports events upward via `onStatsUpdate` (pieces placed, lines cleared, streak, all-clear in `handleDrop`) and `onGameOver` (games played, total score, revives used, no-revive high score).
- Achievement system: centralized in `App.tsx`. A `useEffect` watching `stats` + `dailyStreak` runs `checkAchievements()` from `achievements.ts`. Newly unlocked achievements queue as toasts. `AchievementProgress` stored in `gridlock-achievements` (Record of id → timestamp).
- Daily streak: updated in `handleDailySaveResult` — compares `lastPlayedDate` to today/yesterday to increment or reset. Stored in `gridlock-daily-streak`. Stale streaks reset to 0 on app mount if `lastPlayedDate` is neither today nor yesterday.
- Achievement toast queue: `toastQueue` state in `App.tsx`, dequeues from front on dismiss. Each auto-dismisses after 3s. Rendered globally via `AchievementToast` (fixed position, z-index 9999). Plays `synthAchievement()` fanfare (C5→G5 rising fifth + E5 fill + sparkle noise) on unlock.
- Game context ref: `gameContextRef` in `App.tsx` holds in-game state (score, revives remaining, last clear count) updated by `Game.tsx` via `onGameContextUpdate` callback — allows achievement checks to access live game state without prop drilling.

### Screen flow
```
App (screen state + leaderboard + theme + daily results + stats + achievements + streak + toast queue)
├── MainMenu → Play, Daily Challenge, Profile, How to Play
│   └── DailyStreakBadge (flame icon + count, 3 visual tiers: warm/hot/fire)
├── Tutorial → Paginated 4-step stepper with dots + back/next
├── ProfileScreen → Tabbed container (Stats | Achievements | Leaderboard)
│   ├── StatsContent → 8 stat cards in 2-col grid
│   ├── AchievementsContent → 20 achievements gallery (locked/unlocked, tiers, progress bars)
│   └── LeaderboardContent → Top 5 local scores table
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
- The DragOverlay renders via `createPortal` to document.body (outside React tree)
- CSS variables defined in `:root` in `App.css` — theme system overrides color vars via `applyTheme()` in `themes.ts`. Sizing vars (`--cell-size`, `--cell-gap`, etc.) are not theme-dependent
- `DragOverlay.tsx` and `PiecePreview.tsx` call `getCSSPx()` on every render (not cached) since they re-render on pointer move / piece change — values resolve from live CSS so orientation changes work automatically. `getCSSPx` uses a persistent hidden `<div>` to resolve CSS expressions (calc/min/clamp) that `parseFloat` alone cannot parse
- Background palette effect sets `--bg`/`--bg-dark` on `document.documentElement` during gameplay (may use `color-mix(in oklch, ...)` when tension > 0); resets to theme default on game exit
- `clearingCells` is a `Map<string, number>` (key → delay in ms), not a Set — the delay drives staggered cascade animation via `animation-delay` on each cell
- `CLEAR_ANIMATION_MS` (600ms) is the per-cell animation duration; total clear time = `CLEAR_ANIMATION_MS + (GRID_SIZE - 1) * CLEAR_STAGGER_MS`
- PWA service worker is auto-generated by vite-plugin-pwa on build — no manual sw.js file
- Daily mode uses `mulberry32(seed + pieceGeneration)` for each tray refresh — deterministic regardless of move order. Both `getTodayDateStr()` and `getDayNumber()` use local time, not UTC.
- Volume slider persists to `gridlock-volume` (0-100); synth master GainNode applies it in real time
- `gridlock-stats` stores cumulative `PlayerStats`; `gridlock-achievements` stores `AchievementProgress` (id → timestamp); `gridlock-daily-streak` stores `DailyStreak` — all initialize to defaults for existing users (no migration)
- Achievement checks run on every `stats` or `dailyStreak` change via `useEffect` — in-game achievements (score thresholds, combo_king, survivor) rely on `gameContextRef` being updated by `Game.tsx` before the stats update triggers the check
- `DailyStreakBadge` returns `null` when `currentStreak <= 0` — no empty space on main menu for new users
