# Block Blast! — Complete Game Specification

> Reference spec for the original **Block Blast!** by Hungry Studio.
> Compiled from gameplay analysis, deconstructions (Balancy, GameRefinery), community guides, and gameplay footage review.
> Confidence levels noted where sources conflict.

---

## 1. Core Mechanics

### 1.1 Grid
- **Size:** 8×8 (64 cells)
- **No gravity:** Blocks stay exactly where placed; nothing falls after clearing.
- **No timer:** Classic mode is entirely untimed — pure strategy.

### 1.2 Piece Delivery
- 3 random pieces presented at the bottom each **round**.
- All 3 must be placed before a new set of 3 appears.
- Player chooses placement order within a set.
- Pieces **cannot be rotated** — placed exactly as shown. This is the defining differentiator from Tetris.
- **No undo.** Every placement is permanent.

### 1.3 Piece Placement
- Drag-and-drop onto any valid board position.
- Piece must fit entirely within the 8×8 grid.
- No overlap with existing blocks allowed.
- Snap-to-grid alignment.
- Ghost/preview shown during drag.

### 1.4 Line Clearing
- A complete **row** (8 horizontal cells filled) or complete **column** (8 vertical cells filled) is cleared instantly.
- Multiple rows and/or columns can clear simultaneously from a single placement.
- Cleared cells become empty and available for future placements.
- Partial lines are **never** cleared.
- No cascading/chain reactions — blocks don't fall after clearing.

---

## 2. Piece Catalog

### 2.1 Full Piece List (~19–35 shapes depending on counting rotations)

Since pieces cannot be rotated, each orientation counts as a separate piece.

| Category | Shapes | Cell Count | Notes |
|----------|--------|------------|-------|
| **Monomino** | 1×1 dot | 1 | Rare spawn |
| **Dominoes** | 1×2, 2×1 | 2 | Horizontal + vertical |
| **Triominoes (lines)** | 1×3, 3×1 | 3 | Horizontal + vertical |
| **Triominoes (L-corners)** | 4 orientations of 2+1 L | 3 | Small corners |
| **Tetrominoes (lines)** | 1×4, 4×1 | 4 | Horizontal + vertical |
| **Tetrominoes (square)** | 2×2 | 4 | Most common piece |
| **Tetrominoes (L-shapes)** | L, J, and rotations (4–8 distinct) | 4 | Standard L and reverse L |
| **Tetrominoes (T-shapes)** | 4 orientations | 4 | T in all directions |
| **Tetrominoes (S/Z)** | S, Z shapes (2–4 orientations) | 4 | Zigzag pieces |
| **Pentominoes (lines)** | 1×5, 5×1 | 5 | Horizontal + vertical |
| **Rectangles** | 2×3, 3×2 | 6 | Medium rectangles |
| **Large L-shapes** | 3×3 corners (4 orientations) | 5 | Big L-corners |
| **Large square** | 3×3 | 9 | Largest piece in the game |

**Confidence:** HIGH that the 2×2 square is the most frequently spawned piece. HIGH that 3×3 is the largest piece. MEDIUM on exact count — different analysts report 19 to 35 distinct shapes.

### 2.2 Piece Generation Algorithm

| Aspect | Detail | Confidence |
|--------|--------|------------|
| **Weighted distribution** | Not uniform — some pieces are more frequent | HIGH |
| **2×2 square bias** | Most common piece, spawns frequently | HIGH |
| **3×3 square rarity** | Rarest/hardest to place | HIGH |
| **Adaptive weighting** | Probabilities shift based on board state | MEDIUM |
| **"Pity timer"** | After ~7 hard pieces, easy pieces become 3× more likely | MEDIUM |
| **Modified 7-bag** | Randomizer with distribution skews toward completing patterns | MEDIUM |
| **"Solution blocks"** | After ~15 moves without clears, helpful pieces probability spikes | MEDIUM |

---

## 3. Scoring System

### 3.1 Base Scoring

| Component | Formula | Confidence |
|-----------|---------|------------|
| **Per block cleared** | 10 points per cell | HIGH |
| **Single row/column** | 8 cells × 10 = 80 points base | HIGH |

### 3.2 Combo Bonuses (multi-line clear from single placement)

| Lines Cleared | Bonus | Total Example |
|---------------|-------|---------------|
| 1 line | +20 | 80 + 20 = 100 |
| 2 lines | +30 | 160 + 30 = 190 |
| 3 lines | +40 | 240 + 40 = 280 |
| 4 lines | +50 | 320 + 50 = 370 |
| ... | +10 per additional line | Scales linearly |
| 9 lines | +100 | Theoretical max |

**Confidence:** MEDIUM — multiple sources report this pattern but exact values vary. Some sources suggest the bonus scales differently.

### 3.3 Streak Multiplier

| Aspect | Detail |
|--------|--------|
| **What triggers it** | Clearing ≥1 line on consecutive placements |
| **Multiplier formula** | `score = (blocks × 10) × (1 + streak_count × 0.5)` |
| **Streak of 1** | 1.5× multiplier |
| **Streak of 2** | 2.0× multiplier |
| **Streak of 5** | 3.5× multiplier |
| **Streak of 10** | 6.0× multiplier |
| **How it resets** | Placing a piece without clearing any line |

**Confidence:** MEDIUM — the 0.5× increment formula is reported by analysis sites but not officially confirmed.

### 3.4 Perfect Clear Bonus

Clearing the entire board (0 filled cells remaining) awards a significant bonus. Exact value unclear — our implementation uses +300 points.

**Confidence:** LOW — not widely documented for the original.

### 3.5 Scoring Insight

In high-scoring games (~89% of total points come from streak multipliers), sustained consecutive clears are exponentially more valuable than individual line clears.

---

## 4. Streak System

### 4.1 In-Game Streak (Combo Streak)

- Increments when a placement clears ≥1 line.
- Resets when a placement clears **zero** lines.
- Displayed as a counter during gameplay.
- Directly multiplies score via the streak multiplier formula.

### 4.2 Daily Play Streak

- Tracks consecutive days of playing.
- Win-streak counter displayed on home screen.
- **No meaningful reward milestones** for maintaining daily streaks (identified as a missed opportunity by Balancy analysis).
- Daily login bonuses exist but are minimal.

**Confidence:** HIGH that daily streak exists. LOW on daily streak rewards (they appear minimal or absent).

---

## 5. Game Over Conditions

- Game ends when **none of the 3 current pieces** can fit anywhere on the remaining empty spaces.
- The check is against the specific shapes of the queued pieces, not just available empty cells.
- A board with many scattered single-cell holes can trigger game over if no piece shape matches.
- Board fragmentation (isolated small gaps) is the primary cause of unexpected game overs.

**Confidence:** HIGH — universally consistent across all sources.

---

## 6. Revive / Continue System

### 6.1 Revive Mechanics

| Aspect | Detail | Confidence |
|--------|--------|------------|
| **Uses per game** | 1 per game session (Hungry Studio core version) | MEDIUM |
| **Alternative reports** | Some sources say 3 per session (may be version/platform dependent) | LOW |
| **Trigger** | Game over screen — player chooses to revive | HIGH |
| **Effect** | Removes several random blocks from the board, creating space | HIGH |
| **How to earn** | Watch a rewarded video ad (15–30 seconds) | HIGH |
| **Post-revive** | Game continues with existing hand + cleared board space | HIGH |

### 6.2 Revive Strategy

- Save revives for high-scoring games — using them at low scores wastes the opportunity.
- Revive does not guarantee playability — randomly removed blocks may not create viable placements.

---

## 7. Difficulty / Adaptive System

### 7.1 No Manual Difficulty Settings

There is no difficulty selector in the menus. The game has one mode (Classic).

### 7.2 Adaptive Difficulty (Dynamic Difficulty Adjustment — DDA)

| Feature | Detail | Confidence |
|---------|--------|------------|
| **Performance monitoring** | Tracks score, consecutive clears, game duration | MEDIUM |
| **Piece adjustment** | Harder pieces as score increases | MEDIUM |
| **"God Mode"** | After multiple consecutive losses, ideal pieces are served | MEDIUM |
| **Target** | Keep casual players engaged, challenge skilled players | MEDIUM |
| **Pity timer** | After 7+ hard pieces, easy piece probability increases 300% | MEDIUM |
| **Solution blocks** | After 15+ moves without clears, helpful pieces spike in probability | MEDIUM |

**Confidence:** MEDIUM overall — reported by the Balancy deconstruction and some analysis sites, but not officially confirmed by Hungry Studio. The "God Mode" and pity timer are reported in a single deconstruction analysis.

---

## 8. Power-Ups / Boosters

### 8.1 Available Power-Ups

| Power-Up | Effect | Confidence |
|----------|--------|------------|
| **Bomb** | Clears a 3×3 area around placement point | MEDIUM |
| **Row Clearer** | Eliminates an entire horizontal row | MEDIUM |
| **Column Clearer** | Eliminates an entire vertical column | MEDIUM |
| **Single Block Remover** | Removes one specific block | MEDIUM |

### 8.2 How to Earn Power-Ups

- Completing combo clears (multi-line simultaneous).
- Maintaining high score streaks.
- Completing daily challenge objectives.
- Daily login rewards (potentially).

### 8.3 Power-Up Rules

- Power-ups **do not** directly award extra points.
- Cleared blocks from power-ups generate points through normal scoring.
- Power-ups are consumed on use.

**Confidence:** MEDIUM — power-ups are referenced in multiple guide sites but some may be from variant versions (Adventure Master, etc.) rather than the core Hungry Studio game. The core game may have a simpler or no power-up system.

---

## 9. Game Modes

### 9.1 Classic Mode (Primary)

- Standard endless 8×8 gameplay.
- No timer, no level progression.
- Play until game over.
- Score-based competition.

### 9.2 Adventure Mode

| Aspect | Detail | Confidence |
|--------|--------|------------|
| **Structure** | 7-day limited event | MEDIUM |
| **Levels** | 96 sequential levels | MEDIUM |
| **Goal** | Complete objectives to unlock pixels of an image | MEDIUM |
| **Persistence** | No persistent rewards or collection system | MEDIUM |
| **Availability** | Periodic event, not always active | MEDIUM |

### 9.3 Hidden Drop Mode

One analysis references a third variant — a reverse-Tetris "drop" mode with lateral block movement only.

**Confidence:** LOW — single-source, not widely documented.

---

## 10. Daily Challenges

| Feature | Detail | Confidence |
|---------|--------|------------|
| **Daily puzzles** | Fresh challenge refreshes daily | MEDIUM |
| **Logic puzzles** | Strategic thinking focus | MEDIUM |
| **Exclusive achievements** | Only earnable through daily challenges | MEDIUM |
| **Daily login bonus** | Power-ups, lives, or minor rewards | MEDIUM |

**Confidence:** MEDIUM — referenced across multiple sources but details on exact implementation are sparse.

---

## 11. Achievements / Milestones

### 11.1 Score Milestones

| Threshold | Badge |
|-----------|-------|
| 1,000 points | Bronze-tier recognition |
| 10,000 points | Silver-tier |
| 50,000 points | Gold-tier |
| 100,000+ points | Master-tier |

### 11.2 Other Achievement Categories

- **Line clearing efficiency** — single and multi-line clears.
- **Combo achievements** — simultaneous multi-line clears.
- **Endurance** — extended play sessions.
- **Special challenges** — creative problem-solving under constraints.
- **Medal system** — bronze → silver → gold progression.
- **Theme unlocks** — new visual themes for reaching milestones.

**Confidence:** MEDIUM — achievements are referenced but exact structure unclear.

---

## 12. UI / UX Flow

### 12.1 Screens

| Screen | Elements |
|--------|----------|
| **Home** | Play button, Settings, Leaderboard, Daily Streak display |
| **Gameplay** | 8×8 grid (center), 3 pieces (bottom), Score (top), Streak counter |
| **Game Over** | Final score, Revive button, Ad prompt, Play Again |
| **Pause** | Resume, Restart, Quit to Menu |
| **Power-Up Selection** | Before or during games (if power-ups available) |

### 12.2 Visual Feedback

| Element | Detail |
|---------|--------|
| **Block colors** | Vibrant, high-contrast against dark grid |
| **Placement animation** | Snap-to-grid with subtle bounce |
| **Clear animation** | Flash/dissolve with particle effects |
| **Celebration text** | "Good Work!", "Excellent!", "Amazing!", "Perfect!", "Great Job!" |
| **Text animation** | Bouncy scale-in, ~1.5s display, smooth scale-out |
| **Haptic feedback** | Subtle vibration on placement (mobile) |
| **Background music** | Relaxing ambient track |
| **Sound effects** | Satisfying sounds on placement and clears |
| **Social proof** | Post-level percentage showing ranking vs. player base |

### 12.3 Design Philosophy

- Zero-friction onboarding — no tutorial walls.
- Designed to create "flow state" — complete immersion.
- Minimal UI chrome — focus on the grid and pieces.
- Immediate intuitiveness of drag-and-drop.

---

## 13. Monetization

### 13.1 Revenue Model

| Aspect | Detail |
|--------|--------|
| **Primary model** | 100% ad-driven |
| **Estimated daily revenue** | ~$1M/day |
| **Daily active users** | ~40 million |
| **In-app purchases** | **None** (no IAP shop as of early 2025) |

### 13.2 Ad Types

| Type | Placement | Duration |
|------|-----------|----------|
| **Banner ads** | Bottom of screen during gameplay | Persistent |
| **Interstitial ads** | Between game sessions | Short, skippable |
| **Rewarded video** | Revive trigger | 15–30+ seconds |

### 13.3 Identified Gaps (per Balancy Analysis)

- No undo-via-ad option.
- No ad-removal IAP.
- No Adventure mode persistent rewards.
- No notification-driven retention.
- Win-streak counter with no reward milestones.

---

## 14. Audio

| Event | Sound Character |
|-------|-----------------|
| **Piece placement** | Satisfying click/snap |
| **Single line clear** | Chime/sweep upward |
| **Multi-line clear** | Escalating chime sequence |
| **Combo/streak** | Amplified celebratory tone |
| **Game over** | Descending tone, deflating |
| **Background** | Relaxing ambient music loop |

---

## 15. Persistence

| Data | Storage |
|------|---------|
| **High score** | Persisted locally |
| **Leaderboard** | Local top scores |
| **Daily streak** | Days played consecutively |
| **Achievements** | Unlocked milestones |
| **Theme unlocks** | Visual themes earned |
| **Settings** | Sound on/off, preferences |

---

## 16. Platform Notes

| Aspect | Detail |
|--------|--------|
| **Platforms** | iOS, Android |
| **Offline play** | Fully supported |
| **Downloads** | 222+ million |
| **App Store ranking** | #1 globally for mobile game downloads |
| **Developer** | Hungry Studio |

---

## Appendix: Confidence Guide

| Level | Meaning |
|-------|---------|
| **HIGH** | Confirmed across 3+ independent sources or directly observable |
| **MEDIUM** | Reported by 1–2 analysis sites; plausible but unconfirmed officially |
| **LOW** | Single-source, possibly speculative, or conflicting reports |

Many specifics (exact scoring formulas, adaptive difficulty parameters, power-up availability) remain unconfirmed because Hungry Studio has published no official game design documentation. Some "guide" sites contain AI-generated content that may not reflect actual game behavior.
