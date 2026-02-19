# Gridlock - Full Game Audit Guide (Template + Rubric)

**Document Purpose:** Provide a repeatable, evidence-driven format any reviewer (human or AI) can use to audit Gridlock end-to-end.

**Last Updated:** February 16, 2026

---

## 1. Audit Objective

Use this file to run a full game audit that is:

- Comparable across different reviewers
- Grounded in code and runtime evidence
- Explicit about uncertainty vs verified facts
- Actionable for implementation follow-up

This file is a guide plus scoring rubric, not a one-time narrative snapshot.

---

## 2. Non-Negotiable Rules

1. Findings-first reporting
   - Report defects and risks before summaries.
2. Evidence required
   - Every material claim must cite at least one file path, command output, or source link.
3. No silent assumptions
   - Mark each uncertain claim as `Inference`.
4. Time-sensitive claims must be verified
   - If the audit references "latest" behavior of Block Blast, verify with current sources and include access date.
5. Scoring integrity
   - Use one final score derived from the weighted table. If secondary scores are used, define formula and show computation.
6. Consistency over style
   - Use this rubric and this section order; do not invent ad-hoc scoring structure.

---

## 3. Required Inputs

Before scoring, gather these artifacts:

1. Codebase scan (`src/game`, `src/components`, `src/audio`, settings/persistence)
2. Build health (`npm run lint`, `npm run build`)
3. Runtime sanity (`npm run dev` launch success)
4. Source-of-truth docs in repo:
   - `BLOCK_BLAST_ORIGINAL_SPEC.md`
   - `GAME_SPEC.md`
   - Latest audit docs
5. External references for original-game behavior (if parity claims are included)
6. Audit stamp: repo path, commit hash, audit date/time

---

## 4. Audit Workflow

1. Baseline check
   - Confirm core constants and game mode differences.
2. Automated checks
   - Lint/build/test/runtime startup.
3. Mechanics trace
   - Validate full loop: drag -> place -> clear -> refresh -> game over -> revive.
4. Parity check
   - Compare implementation vs documented Block Blast behavior.
5. Retention systems review
   - VFX, SFX, rewards, pacing, progression hooks.
6. Performance and accessibility review
   - Animation cost, motion controls, haptics and sound controls, reduced-motion behavior.
7. Score with rubric
   - Apply weighted categories below.
8. Produce findings and recommendations
   - Prioritize by severity and implementation order.

---

## 5. Scoring Rubric (100 Points)

Use a 0-5 category score, then weighted conversion.

`weighted_points = (category_score / 5) * category_weight`

### 5.1 Categories

| Category | Weight | What to Evaluate | Hard-Fail Conditions |
|---|---:|---|---|
| Core Mechanics and Rules Parity | 25 | Grid logic, piece flow, clear logic, game-over correctness, revive rule correctness | Invalid placement logic, incorrect line clear behavior, incorrect game-over state checks |
| Piece Generation and DDA | 15 | Weighted RNG, mercy systems, difficulty scaling, deterministic daily behavior | Trays can generate consistently unplayable states, DDA context reset bugs |
| Scoring and Economy | 15 | Points formula, streak logic, bonuses, revive and undo scoring side effects | Score formula mismatch vs declared rules, exploitable score bugs |
| UX Feedback and VFX | 12 | Readability, feedback hierarchy, reward salience, animation coherence | Effects obscure board readability or break interaction clarity |
| Audio and Haptics Retention | 10 | Event coverage, reward escalation, fatigue risk, control granularity | No user control for disruptive tactile or audio behavior |
| Progression and Meta Loop | 8 | Daily loop, leaderboard, milestones, replay motivation | Progression data corruption or loss |
| Performance and Stability | 10 | Frame-risk patterns, particle and animation load, startup reliability | Lint/build failure, repeated runtime instability |
| Accessibility and Controls | 5 | Reduced motion, color reliance, control options | No reduced-motion respect, no critical non-visual alternatives |

### 5.2 Score Bands

| Final Score | Rating | Interpretation |
|---:|---|---|
| 95-100 | Excellent | Release-quality; minor optimization opportunities only |
| 85-94 | Strong | Good quality; several non-blocking gaps remain |
| 70-84 | Moderate | Usable but meaningful parity and quality issues present |
| 50-69 | Weak | Multiple major defects or reliability gaps |
| <50 | Critical | Not audit-passable for parity and quality goals |

---

## 6. Severity Model For Findings

List findings in this order: `P0 -> P1 -> P2 -> P3`

- `P0 Critical`
  - Breaks game correctness, data integrity, or core parity.
- `P1 High`
  - Significant user-facing quality or regression risk.
- `P2 Medium`
  - Noticeable but non-blocking quality issue.
- `P3 Low`
  - Nice-to-have polish or clarity improvement.

Each finding must include:

1. Severity
2. Impact
3. Evidence (file path and line)
4. Recommended fix direction

---

## 7. Mandatory Parity Checklist

Use this checklist before final scoring:

- [ ] 8x8 board, no gravity, no rotation.
- [ ] 3-piece tray must be fully consumed before refresh.
- [ ] Row and column completion logic is exact and simultaneous.
- [ ] Game over occurs only when no current tray piece fits anywhere.
- [ ] Revive behavior matches chosen parity target (and is explicitly documented).
- [ ] Daily mode uses deterministic seed behavior.
- [ ] Scoring constants and formulas match declared design docs.

---

## 8. Mandatory Retention Checklist

- [ ] Reward hierarchy is clear (minor, medium, major events).
- [ ] VFX does not overwhelm baseline readability.
- [ ] SFX and haptics have user controls and sensible defaults.
- [ ] Milestones and daily loop provide replay motivation.
- [ ] No major silent or flat feedback gaps in core loop.

---

## 9. Command Checklist (Minimum)

Run and include key outputs:

```bash
npm run lint
npm run build
npm run dev -- --host 127.0.0.1 --port 4173
```

Optional but recommended:

```bash
npm run test:run
npm audit --json
npm outdated --json
```

---

## 10. Required Output Format (Audit Report Template)

Use this exact section order:

1. **Executive Summary**
   - Final weighted score plus top 3 risks.
2. **Findings (P0-P3)**
   - Defects and risks with evidence and impact.
3. **Category Scores**
   - Table with category score, weight, weighted points, rationale.
4. **Parity Assessment**
   - What matches original, what diverges, confidence level.
5. **Retention Assessment**
   - VFX, SFX, progression strengths and missing systems.
6. **Performance and Accessibility Assessment**
   - Runtime and inclusion risks.
7. **Priority Action Plan**
   - P0/P1/P2 implementation order.
8. **Open Questions and Assumptions**
   - Explicitly listed.
9. **Evidence and Sources**
   - Commands run, files inspected, and any external links with access date.

---

## 11. Current Baseline Snapshot (As of 2026-02-16)

These values must be re-checked each audit run and cited with source lines:

- Classic revives per game: `3` (`src/game/constants.ts:30`)
- Daily revives per run: `0` (`src/game/reducer.ts:52`)
- Post-revive grace rule: if game over occurs before surviving first post-revive tray, remaining revives are forced to `0` (`src/game/reducer.ts:152`)
- Undo count: `0` (disabled) (`src/game/constants.ts:33`)
- All-clear bonus: `500` (`src/game/constants.ts:62`)
- Score milestones: `1000, 2500, 5000, 10000, 25000, 50000` (`src/game/constants.ts:65`)
- Themes currently present: `Classic, Midnight, Ocean, Sunset, Neon` (`src/game/themes.ts:32`)
- Reduced-motion support: OS-level `prefers-reduced-motion` handling exists (`src/App.css:93`)
- Known gap areas: no explicit VFX quality tiers, no in-app haptics toggle, no telemetry for retention experiments

If any baseline value changes, update this section first.

---

## 12. Quality Gate (Audit Completion Criteria)

An audit is not complete unless all are true:

1. Lint and build status captured.
2. Findings are severity-ranked with evidence.
3. Weighted rubric table is present.
4. Parity divergences are explicit and dated.
5. Recommendations are implementation-ordered.
6. Final score is mathematically consistent with rubric table.

If one item is missing, mark report status as `Incomplete`.
