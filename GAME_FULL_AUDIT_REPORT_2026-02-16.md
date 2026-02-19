# Gridlock Full Game Audit Report

Date: 2026-02-16  
Repo: `/Users/nunosantos/Desktop/studio/projects/gridlock`  
Branch: `main`  
Commit: `89e7c4b`  
Rubric Source: `FULL_GAME_AUDIT_REPORT.md`

---

## 1. Executive Summary

Final weighted score: **66.7 / 100 (Weak)**

Top 3 risks:
1. **Hard-fail on stability gate:** lint currently fails (`react-hooks/set-state-in-effect`) in ambient particle effect logic.
2. **Hard-fail on audio/haptics control gate:** vibration is always triggered with no in-app haptics toggle.
3. **Spec drift:** `GAME_SPEC.md` is not aligned with runtime constants/behavior (scoring + revive + DDA values), increasing parity and maintenance risk.

Audit status: **Complete (with hard-fail conditions recorded).**

---

## 2. Findings (P0-P3)

### P0 Critical

None identified.

### P1 High

1. **Lint failure blocks quality gate (Performance & Stability hard-fail).**
- Impact: quality checks are not clean; performance-risk pattern is already flagged by tooling.
- Evidence: `npm run lint` fails on `src/components/AmbientParticles.tsx:74` (`react-hooks/set-state-in-effect`).
- Recommended fix direction: refactor burst-particle update to avoid direct synchronous state update in effect body (use reducer/event queue/ref-based buffering).

2. **No in-app haptics control while vibration is always fired (Audio/Haptics hard-fail).**
- Impact: users cannot disable tactile feedback; retention/accessibility risk for sensory-sensitive users.
- Evidence: `src/audio/sounds.ts:26`, `src/audio/sounds.ts:49`, `src/audio/sounds.ts:58`, `src/audio/sounds.ts:65`, `src/audio/sounds.ts:72`; pause controls only expose volume in `src/components/PauseMenu.tsx:44`.
- Recommended fix direction: add persisted `hapticsEnabled` setting and guard `navigator.vibrate` calls.

3. **Spec and implementation are out of sync on key gameplay constants/rules.**
- Impact: parity decisions become ambiguous; future changes may regress silently.
- Evidence:
  - All-clear bonus: `GAME_SPEC.md:134` says `300`, runtime is `500` in `src/game/constants.ts:62`.
  - Difficulty ceiling: `GAME_SPEC.md:59`/`GAME_SPEC.md:261` says `15000`, runtime is `20000` in `src/game/constants.ts:43`.
  - Revive cell removal strategy: `GAME_SPEC.md:169` says uniform random `20`; runtime uses congestion-weighted 16/24 in `src/game/logic.ts:166` and `src/game/logic.ts:174`.
  - Revive UI copy with remaining count is described in `GAME_SPEC.md:162`, but current button text is static `Revive` in `src/components/GameOver.tsx:92`.
- Recommended fix direction: either update `GAME_SPEC.md` to match code or change code to match spec, then lock a single source of truth.

### P2 Medium

1. **No automated test script in package scripts.**
- Impact: mechanics regressions rely on manual verification.
- Evidence: `npm run test:run` fails (`Missing script`) and `package.json` has no test command (`package.json:6`).
- Recommended fix direction: add a minimal test runner (unit tests for `logic.ts`, `pieces.ts`, reducer transitions).

2. **Animation pipeline uses multiple unmanaged timers in hot path.**
- Impact: maintainability and overlap risk increase as effect complexity grows.
- Evidence: `src/components/Game.tsx:267`, `src/components/Game.tsx:297`, `src/components/Game.tsx:321`, `src/components/Game.tsx:338`, `src/components/Game.tsx:405`.
- Recommended fix direction: consolidate to a timeline controller and clear pending timers on unmount/state transition.

3. **No instrumentation for retention experiments (audio/VFX/meta).**
- Impact: no measurable validation of retention improvements.
- Evidence: no analytics hooks found by search (`rg` for analytics/telemetry events returned no matches in `src`).
- Recommended fix direction: introduce event schema (`game_start`, `revive_used`, `session_end`, `streak_peak`, `daily_complete`).

4. **Daily date handling mixes UTC and local parsing paths.**
- Impact: potential edge-case drift in pruning/display around timezone boundaries.
- Evidence: prune logic uses UTC parse in `src/App.tsx:101`; calendar display uses local parse in `src/components/DailyCalendar.tsx:45`.
- Recommended fix direction: standardize on one date-time strategy (all-local or all-UTC).

### P3 Low

1. **No separate music/SFX channel controls (master only).**
- Impact: reduced personalization.
- Evidence: `src/components/PauseMenu.tsx:49`; `src/audio/sounds.ts:39`.
- Recommended fix direction: split volume controls by channel.

---

## 3. Category Scores

Scoring model: `weighted_points = (category_score / 5) * category_weight`

| Category | Weight | Score (0-5) | Weighted Points | Rationale |
|---|---:|---:|---:|---|
| Core Mechanics and Rules Parity | 25 | 4.0 | 20.0 | Core loop correctness is strong (8x8, no gravity, tray flow, game-over checks), but parity target is blurred by spec drift. |
| Piece Generation and DDA | 15 | 4.2 | 12.6 | Multi-factor DDA is robust; daily mode is deterministic and revive path applies mercy reset intentionally. |
| Scoring and Economy | 15 | 3.4 | 10.2 | Runtime scoring logic is coherent, but declared rules are inconsistent across docs and UI revive-count messaging is incomplete. |
| UX Feedback and VFX | 12 | 3.6 | 8.6 | High feedback richness and clarity cues, with some complexity/noise and timer orchestration overhead. |
| Audio and Haptics Retention | 10 | 2.0 | 4.0 | Event sound design is decent, but missing haptics control is a hard-fail against rubric gate. |
| Progression and Meta Loop | 8 | 3.0 | 4.8 | Daily mode and leaderboard exist; long-term progression and experiment loops remain thin. |
| Performance and Stability | 10 | 2.0 | 4.0 | Build passes and dev boots, but lint failure triggers hard-fail for this category. |
| Accessibility and Controls | 5 | 2.5 | 2.5 | OS reduced-motion exists, but control granularity (haptics, richer accessibility options) is limited. |
| **Total** | **100** |  | **66.7 / 100** | Weak overall due hard-fail conditions despite strong mechanics core. |

Hard-fail conditions triggered:
- Performance and Stability (lint failure)
- Audio and Haptics Retention (no disruptive tactile control)

---

## 4. Parity Assessment

Parity target used in this audit:
- Primary implementation target: `GAME_SPEC.md`
- External parity reference inside repo: `BLOCK_BLAST_ORIGINAL_SPEC.md`

What matches well:
- Board, placement, no-rotation behavior, no gravity, simultaneous row/column clear checks.
- 3-piece tray consumption rule and shape-fit game-over evaluation.
- Daily deterministic seeding (`src/game/reducer.ts:141`, `src/game/pieces.ts:311`, `src/game/random.ts:13`).

What diverges or is ambiguous:
- Revive count and revive-rule nuances differ from some Block Blast reports; implementation is explicit but not universally confirmed externally.
- `GAME_SPEC.md` values are stale vs runtime for all-clear bonus and difficulty ceiling.

Confidence:
- High for implementation claims (code-cited).
- Medium for original-game parity where upstream sources conflict.

---

## 5. Retention Assessment

Strengths:
- Strong tactical feedback hierarchy (ghost validity, near-complete cues, streak tiers, score pop, clear choreography).
- DDA combines challenge ramp and mercy systems, supporting broader skill retention.
- Daily challenge and leaderboard provide basic replay hooks.

Missing/weak:
- No analytics loop to validate retention hypotheses.
- No haptics preference control.
- Limited long-term meta progression beyond daily score history and top-5 leaderboard.

---

## 6. Performance and Accessibility Assessment

Performance:
- `npm run build` passes and runtime starts successfully.
- Lint currently fails on effect-state update pattern in particle system.
- Effect pipeline includes many timer branches in gameplay hot path.

Accessibility:
- Positive: `prefers-reduced-motion` support in `src/App.css:93`.
- Gaps: no in-app haptics toggle; no broader accessibility controls (input alternatives/color-blind tuning).

---

## 7. Priority Action Plan

### P0
1. Fix lint blocker in `AmbientParticles` effect path until `npm run lint` is clean.
2. Add `hapticsEnabled` toggle and gate all vibration calls.
3. Reconcile `GAME_SPEC.md` with live constants/rules and lock source-of-truth policy.

### P1
1. Add minimal automated tests for pure game logic/reducer transitions.
2. Consolidate animation timing orchestration to reduce overlap risk.
3. Add telemetry scaffolding for retention measurement.

### P2
1. Expand settings granularity (SFX/music/haptics profiles).
2. Standardize date parsing strategy for daily result storage/pruning/display.
3. Add long-term progression hooks (achievement tiers, persistent milestones).

---

## 8. Open Questions and Assumptions

1. Is the intended parity target strict Block Blast live behavior or the current internal `GAME_SPEC.md`?
2. Should classic mode keep `3` revives plus post-revive grace, or target `1` revive parity?
3. Should all-clear bonus remain `500` or be normalized to documented values?
4. Assumption: current DDA parameters are intentionally tuned and not accidental drift.

---

## 9. Evidence and Sources

### Commands executed
- `npm run lint` -> **Failed** on `src/components/AmbientParticles.tsx:74`.
- `npm run build` -> **Passed**.
- `npm run dev -- --host 127.0.0.1 --port 4173` -> **Boot success** (`http://127.0.0.1:4173/`).
- `npm audit --json` -> **0 vulnerabilities**.
- `npm outdated --json` -> dependency updates available.
- `npm run test:run` -> **Missing script**.

### Local files inspected
- `FULL_GAME_AUDIT_REPORT.md`
- `GAME_SPEC.md`
- `BLOCK_BLAST_ORIGINAL_SPEC.md`
- `src/game/constants.ts`
- `src/game/reducer.ts`
- `src/game/logic.ts`
- `src/game/pieces.ts`
- `src/game/random.ts`
- `src/components/Game.tsx`
- `src/components/GameOver.tsx`
- `src/components/AmbientParticles.tsx`
- `src/audio/sounds.ts`
- `src/components/PauseMenu.tsx`
- `src/App.tsx`
- `src/components/DailyCalendar.tsx`
- `package.json`

### External sources
- None used directly in this pass (parity references rely on repository docs cited above).
