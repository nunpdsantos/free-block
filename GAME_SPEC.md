# Block Blast — Game Specification

> Complete specification for a free, ad-free clone of Block Blast (Hungry Studio).
> All mechanics target parity with the original Classic/Endless mode.

---

## 1. Board

| Property     | Value                |
| ------------ | -------------------- |
| Grid size    | 8 x 8               |
| Gravity      | None — blocks stay in place after line clears |
| Timer        | None — untimed gameplay |
| Special cells| None (Classic mode)  |

---

## 2. Pieces

### 2.1 Rotation
Pieces **cannot be rotated**. They must be placed in the exact orientation shown.

### 2.2 Piece Pool
19 base shapes, each orientation counted separately (~40 total orientations):

| Category          | Sizes       | Orientations |
| ----------------- | ----------- | ------------ |
| Monomino          | 1 cell      | 1            |
| Domino            | 2 cells     | 2 (H, V)     |
| Triomino line     | 3 cells     | 2 (H, V)     |
| Triomino L-corner | 3 cells     | 4            |
| Tetromino line    | 4 cells     | 2 (H, V)     |
| Square 2x2        | 4 cells     | 1            |
| L-shape           | 4 cells     | 4            |
| J-shape           | 4 cells     | 4            |
| T-shape           | 4 cells     | 4            |
| S-shape           | 4 cells     | 2            |
| Z-shape           | 4 cells     | 2            |
| Pentomino line    | 5 cells     | 2 (H, V)     |
| Big L-corner      | 5 cells     | 4            |
| Rectangle 2x3     | 6 cells     | 2            |
| Square 3x3        | 9 cells     | 1            |

### 2.3 Piece Presentation
- Three pieces are presented simultaneously each turn.
- Player can place them in **any order**.
- **All three must be placed** before a new set of three is drawn.
- No piece can be skipped or discarded.

### 2.4 Piece Generation (Dynamic Difficulty Adjustment)

Each piece has a **difficulty tier**: `easy` (1-3 cell pieces), `medium` (4-cell tetrominoes, 2x2 square), `hard` (S/Z shapes, 5+ cell pieces, 3x3 square).

Base selection uses weighted random (no duplicates within a set of 3). Five adaptive systems modify piece weights at set-generation time:

#### A. Score-Based Difficulty Scaling (harder when doing well)
- Below 3,000 points: base weights only (no scaling).
- 3,000–15,000 points: linear ramp. Hard pieces get up to **3x boost**, easy pieces reduced to **0.3x**.
- Above 15,000 points: full difficulty — hard pieces at 3x, easy pieces at 0.3x.

#### B. Streak Pushback (harder when clearing consecutively)
- Streak ≥ 2: each additional streak level boosts hard piece weight by **+0.5x** and reduces easy piece weight by **-0.15x** (floored at 0.4x).
- This means a 5-streak player sees significantly harder pieces than a 0-streak player at the same score.

#### C. Board-State Awareness (harder when board is open, easier when critical)
- Board >60% empty (player managing well): hard pieces boosted up to **+1.5x**, easy pieces reduced.
- Board <25% empty (critically full): easy pieces boosted up to **+1.5x**, hard pieces reduced.
- Between 25-60%: no board-state adjustment.

#### D. Pity Timer (mercy — easier when struggling)
- Counter: `movesSinceLastClear` — incremented each piece placement that clears 0 lines. Reset to 0 on any line clear.
- When `movesSinceLastClear >= 7`: pieces that fit easily on the current board (5+ valid positions) get a **3x weight boost**.

#### E. Solution Boost (mercy — easier when deeply stuck)
- When `movesSinceLastClear >= 15`: pieces that would **enable a line clear** (placing them completes at least one row or column) get a **5x weight boost**.
- Check: for each candidate piece, simulate placement in every valid position; if any placement completes a line, the piece qualifies.

#### Weight Resolution Order
All five systems apply multiplicatively to the base weight. Mercy systems (D, E) can counteract difficulty systems (A, B, C) for a struggling player even at high scores. Final weight is floored at 0.1 (no piece is ever fully eliminated).

#### Net Effect on Difficulty Curve
| Phase | Score Range | Behavior |
|-------|-----------|----------|
| Early game | 0–3,000 | Base weights only. Gentle, learning-friendly. |
| Mid game | 3,000–15,000 | Difficulty ramps. Harder pieces more frequent, easy pieces less. |
| Late game | 15,000+ | Full difficulty. Hard pieces dominant. Mercy kicks in if stuck. |

---

## 3. Placement

- Drag a piece from the tray onto the board.
- Placement is **permanent** — no undo, no move after placing.
- A piece can only be placed if **all of its cells** land on empty board cells within the 8x8 grid.
- Placement offset: on touch devices, the piece is offset upward by ~40px so the player can see it under their finger.

---

## 4. Line Clearing

- A **row** is cleared when all 8 cells in that row are filled.
- A **column** is cleared when all 8 cells in that column are filled.
- Multiple rows and/or columns can clear simultaneously from a single piece placement.
- Cleared cells become empty. **No gravity** — remaining blocks stay in place.
- Clearing is purely from completing full rows/columns. No chain reactions, no cascades.

---

## 5. Scoring

### 5.1 Base Points
Each cell cleared awards **10 points**.
- 1 line (8 cells) = 80 base points.
- 2 lines (up to 16 cells, minus overlaps at intersections) = varies.

### 5.2 Combo Bonus (multi-line clear in one move)
Tiered flat bonus added on top of base points:
- 1 line cleared: +20
- 2 lines cleared: +30
- 3 lines cleared: +40
- N lines cleared: +20 + (N-1) × 10

### 5.3 Streak Multiplier (consecutive clears across moves)
- **Streak counter** increments by 1 each time a piece placement clears ≥1 line.
- Resets to 0 when a piece is placed that clears **no** lines.
- Score formula: `(baseCellPoints + comboBonus) × (1 + streak × 0.5)`
- Examples:
  - Streak 0, 1 line: (80 + 20) × 1.0 = 100
  - Streak 1, 1 line: (80 + 20) × 1.5 = 150
  - Streak 3, 2 lines (16 cells): (160 + 30) × 2.5 = 475

### 5.4 Perfect Clear Bonus
Not confirmed in the original game. Our implementation awards a **300-point flat bonus** for clearing the entire board to empty. Optional — does not break difficulty balance.

---

## 6. Game Over

The game enters a "game over" state when:
1. A piece is placed (or the game starts a new round of 3 pieces).
2. The remaining pieces (those not yet placed from the current set of 3) are checked.
3. If **none** of the remaining pieces can fit **anywhere** on the board, game over is triggered.

The check evaluates actual piece shapes against available gaps, not just total empty cell count.

---

## 7. Revive System

| Property              | Value                              |
| --------------------- | ---------------------------------- |
| Revives per game      | 3 (free, no ads)                   |
| Trigger               | Game over state                    |
| Effect                | Removes ~20 random filled cells from the board |
| Score on revive       | Preserved — score does NOT reset   |
| Streak on revive      | Resets to 0                        |
| Pieces on revive      | New set of 3 pieces is generated   |

### 7.1 Revive Flow
1. Game over detected → check if revives remain.
2. If revives > 0: show "Revive" button with remaining count (e.g., "Revive (2 left)").
3. On revive: clear ~20 random filled cells from board, generate new pieces, reset streak, decrement revive counter.
4. If the board is STILL unplayable after clearing cells (unlikely but possible), the revive still counts as used.
5. If revives = 0: show only "Play Again" and "Menu" buttons.

### 7.2 Cell Removal Strategy
- Count total filled cells on the board.
- Remove `min(20, filledCount)` cells chosen uniformly at random.
- Cells are removed (set to empty), not rearranged.

---

## 8. Celebration Text

Displayed as a floating overlay when lines are cleared:

| Lines Cleared | Text         |
| ------------- | ------------ |
| 1             | Good Work!   |
| 2             | Excellent!   |
| 3             | Amazing!     |
| 4+            | Perfect!     |

Auto-dismisses after a short delay or on next interaction.

---

## 9. Screens & Navigation

```
App (screen state + leaderboard)
├── Main Menu
│   ├── Play → Game screen
│   ├── How to Play → Tutorial screen
│   └── Leaderboard → Leaderboard screen
├── Tutorial → Back to Menu
├── Leaderboard → Back to Menu
└── Game
    ├── Pause (⏸ button) → PauseMenu overlay
    │   ├── Resume
    │   ├── Restart
    │   └── Quit to Menu
    └── Game Over → GameOver overlay
        ├── Revive (if remaining)
        ├── Play Again
        └── Menu
```

---

## 10. Leaderboard

- Stored in `localStorage` as `'blockblast-leaderboard'`.
- Format: `Array<{ score: number; date: string }>`, max 5 entries.
- Sorted descending by score.
- Score is saved to leaderboard when game over is final (no more revives, or player chooses not to revive).
- Migration: on first load, if old `'blockblast-highscore'` key exists, migrate it into the leaderboard array.

---

## 11. Visual Theme

| Element          | Value                            |
| ---------------- | -------------------------------- |
| Background       | Dark navy `#1a1a2e`              |
| Board background | `#16213e`                        |
| Empty cell       | `#1e2d4a`                        |
| Cell border      | `#0f1b30`                        |
| Ghost (valid)    | `rgba(46, 204, 113, 0.4)` green  |
| Ghost (invalid)  | `rgba(231, 76, 60, 0.4)` red     |
| Text primary     | `#ffffff`                        |
| Text secondary   | `#8899aa`                        |
| Streak glow      | `#f1c40f` gold                   |

Piece colors: red, orange, yellow, green, teal, blue, indigo, purple, pink, brown.

---

## 12. Technical Constants

| Constant               | Value | Notes                          |
| ---------------------- | ----- | ------------------------------ |
| `GRID_SIZE`            | 8     | Board dimensions               |
| `CELL_SIZE`            | 48px  | Visual cell size               |
| `CELL_GAP`             | 2px   | Gap between cells              |
| `FINGER_OFFSET`        | 40px  | Touch drag offset upward       |
| `CLEAR_ANIMATION_MS`   | 450ms | Line clear animation duration  |
| `POINTS_PER_CELL`      | 10    | Base score per cleared cell    |
| `COMBO_BASE_BONUS`     | 20    | Bonus for 1 line clear         |
| `COMBO_INCREMENT`      | 10    | Additional bonus per extra line|
| `STREAK_MULTIPLIER`    | 0.5   | Multiplier increment per streak|
| `PERFECT_CLEAR_BONUS`  | 300   | Bonus for empty board          |
| `REVIVES_PER_GAME`     | 3     | Free revives per game session  |
| `REVIVE_CELLS_CLEARED` | 20    | Cells removed on revive        |
| `PITY_THRESHOLD`       | 7     | Moves without clear → pity boost     |
| `SOLUTION_THRESHOLD`   | 15    | Moves without clear → solution boost |
| `PITY_WEIGHT_BOOST`    | 3.0   | Weight multiplier for mercy (pity)   |
| `SOLUTION_WEIGHT_BOOST`| 5.0   | Weight multiplier for mercy (solution)|
| `DIFFICULTY_SCORE_THRESHOLD` | 3000 | Score where difficulty ramp begins |
| `DIFFICULTY_SCORE_CEILING`   | 15000 | Score where difficulty maxes out  |
| `DIFFICULTY_HARD_BOOST_MAX`  | 3.0  | Max weight multiplier for hard pieces |
| `DIFFICULTY_EASY_PENALTY_MAX`| 0.3  | Min weight multiplier for easy pieces |
| `STREAK_HARDENING_THRESHOLD` | 2    | Streak count where pushback starts |
| `STREAK_HARD_BOOST`          | 1.5  | Hard piece boost per streak level  |
| `BOARD_OPEN_THRESHOLD`       | 0.6  | >60% empty → harder pieces         |
| `BOARD_CRITICAL_THRESHOLD`   | 0.25 | <25% empty → easier pieces         |

---

## 13. What We Intentionally Omit

These exist in the original but are out of scope for this free clone:

- **Ads / Monetization** — no ads, no subscriptions, no IAP
- **Adventure Mode** — level-based progression with themes
- **Daily Challenges** — special objectives and rewards
- **Power-ups** (bomb, line clearer, single-block remover) — may add later
- **Cloud save / accounts** — local-only storage
- **Social features** — no sharing, no friend leaderboards
