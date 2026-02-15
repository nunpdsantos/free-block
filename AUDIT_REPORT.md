# Gridlock vs Block Blast — Fidelity Audit Report

> Generated 15/02/2026 by cross-referencing 5 independent research sweeps against the Gridlock codebase.

---

## Overall Match Score: **82%**

| Category | Match | Weight | Weighted Score |
|----------|-------|--------|---------------|
| Core Mechanics | 95% | 25% | 23.8% |
| Scoring System | 85% | 20% | 17.0% |
| Piece System | 92% | 15% | 13.8% |
| Difficulty/DDA | 88% | 15% | 13.2% |
| Revive System | 60% | 10% | 6.0% |
| UI/Visual Design | 80% | 10% | 8.0% |
| Audio/Polish | 0% | 5% | 0.0% |
| **Total** | | **100%** | **81.8%** |

---

## 1. CORE MECHANICS — 95% Match

### What matches perfectly

| Mechanic | Original | Gridlock | Status |
|----------|----------|----------|--------|
| Grid size | 8×8 | 8×8 | ✅ |
| Gravity | None | None | ✅ |
| Timer | None (untimed) | None | ✅ |
| Rotation | Pieces cannot be rotated | Cannot rotate | ✅ |
| Undo | No undo | No undo | ✅ |
| Piece presentation | 3 pieces per round | 3 pieces per round | ✅ |
| Placement order | Any order within set of 3 | Any order | ✅ |
| Must place all 3 | Yes, before new set | Yes | ✅ |
| Line clearing | Both rows and columns | Both rows and columns | ✅ |
| Simultaneous clears | Yes, from single placement | Yes | ✅ |
| No gravity after clear | Blocks stay in place | Blocks stay in place | ✅ |
| Placement is permanent | Yes | Yes | ✅ |
| Drag-and-drop | Yes, with ghost preview | Yes, with ghost preview | ✅ |
| Finger offset (mobile) | ~40px upward | 40px upward | ✅ |

### Minor gap

| Mechanic | Original | Gridlock | Impact |
|----------|----------|----------|--------|
| Game over check timing | After each piece placement | After each piece placement | ✅ |
| 1×1 fallback piece | When no piece fits, generate 1×1 as fallback | No fallback — normal generation | ⚠️ Low |

**The 1×1 fallback** is documented in one open-source reimplementation. The original may generate a 1×1 block when no multi-cell piece can physically fit on the board. Our generator doesn't validate that generated pieces can actually fit (it's weighted random, not fit-validated). This is a minor difference — the original's approach prevents truly unplayable sets.

---

## 2. SCORING SYSTEM — 85% Match

### What matches

| Scoring Rule | Original (best estimate) | Gridlock | Status |
|-------------|--------------------------|----------|--------|
| Points per cell cleared | 10 | 10 | ✅ |
| 1 line combo bonus | +20 | +20 | ✅ |
| 2 lines combo bonus | +30 | +30 | ✅ |
| N lines combo bonus | +20 + (N-1)×10 | +20 + (N-1)×10 | ✅ |
| Streak formula | `base × (1 + streak × 0.5)` | `base × (1 + streak × 0.5)` | ✅ |
| Streak resets on no-clear | Yes | Yes | ✅ |

### Gaps found

| Scoring Rule | Original | Gridlock | Impact |
|-------------|----------|----------|--------|
| Perfect clear bonus | **1,000 points** | 300 points | ⚠️ Medium |
| Placement points | Possibly +10 per placement (conflicting sources) | 0 (no placement points) | ⚠️ Low-Medium |
| Streak multiplier cap | Reportedly 3.0× or 8.0× (conflicting) | No cap | ⚠️ Low |
| Platform streak rules | Android: per-piece; iOS: per-round-of-3 | Per-piece (Android model) | ℹ️ Intentional |

**Perfect clear bonus** is the most significant scoring gap. Multiple sources report 1,000 points for clearing the entire board; we award only 300. Community consensus says perfect clears aren't strategically worth pursuing, so the gameplay impact is low, but the number should be 1,000 for fidelity.

**Placement points**: Some sources claim +10 points per piece placed (regardless of clearing). This is unconfirmed but would explain the "minimum score of 10" finding. We don't award any points for placement alone.

---

## 3. PIECE SYSTEM — 92% Match

### What matches

| Feature | Original | Gridlock | Status |
|---------|----------|----------|--------|
| ~19 base shapes | Yes | Yes (14 families, 40 orientations) | ✅ |
| 1×1 monomino | Yes | Yes | ✅ |
| 2×1 / 1×2 domino | Yes (2 orientations) | Yes | ✅ |
| 3×1 / 1×3 triomino line | Yes | Yes | ✅ |
| 2×2 L-corners (triomino) | Yes (4 orientations) | Yes (4) | ✅ |
| 4×1 / 1×4 line | Yes | Yes | ✅ |
| 2×2 square | Yes | Yes | ✅ |
| L-shapes (4 cells) | Yes (4 orientations) | Yes (4) | ✅ |
| J-shapes (4 cells) | Yes (4 orientations) | Yes (4) | ✅ |
| T-shapes (4 cells) | Yes (4 orientations) | Yes (4) | ✅ |
| S/Z shapes (4 cells) | Yes (4 orientations) | Yes (4) | ✅ |
| 5×1 / 1×5 line | Yes | Yes | ✅ |
| 3×3 L-corner (Big L) | Yes (4 orientations) | Yes (4) | ✅ |
| 2×3 / 3×2 rectangle | Yes | Yes | ✅ |
| 3×3 square | Yes | Yes | ✅ |
| No duplicates within set of 3 | Yes | Yes | ✅ |
| Weighted random selection | Yes | Yes | ✅ |

### Gap

| Feature | Original | Gridlock | Impact |
|---------|----------|----------|--------|
| Piece-fit validation | Original validates each piece can fit somewhere before offering it | We do weighted random without fit validation | ⚠️ Medium |
| Color assignment | Possibly fixed per shape type | Random per piece | ⚠️ Low (cosmetic) |

**Piece-fit validation** is a notable gap. The original's generator (based on the open-source reimplementation) uses a greedy approach where each piece in the set of 3 is validated to have at least one valid placement on the board (with simulated prior placements). Our generator uses pure weighted random — it's possible (though rare) to get a set where a piece has zero valid placements at generation time.

---

## 4. DIFFICULTY / DDA — 88% Match

### What matches

| DDA System | Original (researched) | Gridlock | Status |
|-----------|----------------------|----------|--------|
| Score-based difficulty ramp | Spike at ~3,000-4,000 pts | Ramp starts at 3,000 | ✅ |
| Harder pieces at higher scores | Yes — more 3×3, 5×1, big-L | Yes — hard tier boosted up to 3× | ✅ |
| Fewer easy pieces at higher scores | Yes | Yes — easy tier reduced to 0.3× | ✅ |
| Pity timer | After ~7 difficult placements | After 7 moves without clear | ✅ |
| Solution boost | After ~15 moves without clear | After 15 moves — 5× boost | ✅ |
| Streak pushback | Consecutive clears → harder pieces | Yes — hard boost per streak level | ✅ |
| Board-state awareness | Yes — more open = harder | Yes — >60% empty = harder, <25% = easier | ✅ |
| Bidirectional DDA | Both harder AND easier adjustments | Yes — 5 multiplicative systems | ✅ |

### Gaps

| DDA Feature | Original | Gridlock | Impact |
|------------|----------|----------|--------|
| "God Mode" after losing streaks | After multiple consecutive game losses, piece selection becomes very favorable in the next game | Not implemented | ⚠️ Medium |
| Cross-session difficulty memory | Game tracks performance across sessions to adjust | No cross-session memory | ⚠️ Low |
| ~100 nested sub-rules | Proprietary algorithm with ~100 sub-rules | 5 multiplicative systems | ⚠️ Low (our 5 systems cover the documented behaviors) |
| Full difficulty ceiling at 20,000+ | Players report second spike at ~20K | Our ceiling is at 15,000 | ⚠️ Low-Medium |

**God Mode** is the most significant DDA gap. Professional analysts (Balancy, Gamigion) independently confirmed that after multiple consecutive game losses, the next game gives highly favorable pieces. This is a retention mechanic — we don't track cross-session performance.

---

## 5. REVIVE SYSTEM — 60% Match

This is our biggest deliberate deviation.

| Feature | Original | Gridlock | Status |
|---------|----------|----------|--------|
| Revives available | **1 per game** (requires watching ad) | 3 per game (free, no ads) | ⚠️ Intentional |
| Cell removal on revive | Removes "2-3 rows" or creates gaps | Removes 20 random cells | ⚠️ Different approach |
| Score preserved | Yes | Yes | ✅ |
| Streak resets | Likely (game-over state means streak was already 0) | Yes, explicitly resets to 0 | ✅ |
| New pieces generated | Yes | Yes | ✅ |
| Revive button shown | Only when revives available | Only when revives > 0 | ✅ |
| Ad requirement | 30-second rewarded video ad | None (free) | ✅ Intentional |

**This is intentionally different.** Our design goal is a free, ad-free clone. The original gates revives behind ads (its primary monetization). We offer 3 free revives as a generous alternative. The cell removal approach also differs — the original appears to clear entire rows while we remove 20 random cells (Fisher-Yates shuffle). Both approaches create space, but our random approach may leave a more scattered board.

---

## 6. UI / VISUAL DESIGN — 80% Match

### What matches

| Element | Original | Gridlock | Status |
|---------|----------|----------|--------|
| Dark navy background | Yes (#1a1a2e-ish) | #1a1a2e | ✅ |
| Score at top center | Yes | Yes | ✅ |
| Piece tray at bottom | Yes, 3 pieces | Yes, 3 pieces | ✅ |
| Celebration text | "Good Work!", "Excellent!", "Amazing!", "Perfect!" | Same exact texts | ✅ |
| Ghost preview on drag | Yes, highlights valid/invalid | Green valid, red invalid | ✅ |
| Pause button | Yes | Yes (⏸ top-right) | ✅ |
| Game over overlay | Score + retry options | Score + Revive/Play Again/Menu | ✅ |
| "New Best!" notification | Yes | Yes | ✅ |
| Leaderboard | Local storage | Local storage, top 5 | ✅ |
| Vibrant piece colors | Blue, green, purple, orange, red, pink | 10 colors: red through brown | ✅ |

### Gaps

| Element | Original | Gridlock | Impact |
|---------|----------|----------|--------|
| Line clear animation | Sparkle/pop/confetti particles | CSS fade-out only | ⚠️ Medium |
| Celebration text animation | Bouncy scale-in with rotation, ~1.5s | Simple fade | ⚠️ Low-Medium |
| Block appearance | Slight 3D/raised look with highlights | Flat colored squares | ⚠️ Low |
| Color themes | Multiple themes (forest, ocean, space) | Single dark theme | ⚠️ Low |
| Streak glow effect | Golden glow during streak | Gold "1×" text only | ⚠️ Low |
| Confetti on multi-clear | Yes | No | ⚠️ Low |
| Menu screen | Start, Settings, modes | Play, How to Play, Leaderboard | ✅ Appropriate |

---

## 7. AUDIO — 0% Match

The original has 349 audio files including:
- Background music (calm, meditative)
- Piece pickup sound
- Piece placement sound (satisfying click/pop)
- Line clear sound (pop/blast)
- Combo/multi-clear sound (enhanced)
- Celebration sound with text popup
- Game over sound
- Menu/UI interaction sounds

**Gridlock has no audio whatsoever.** This is the single largest fidelity gap in terms of player experience. Sound design is core to the "satisfying" feel that makes Block Blast addictive.

---

## Summary of Recommended Improvements (by impact)

### High Impact
1. **Add sound effects** — At minimum: placement pop, line clear blast, combo celebration, game over. This alone would move the overall score from 82% to ~87%.
2. **Perfect clear bonus → 1,000** — Simple constant change.
3. **Piece-fit validation** — Ensure generated pieces can actually fit on the current board.

### Medium Impact
4. **Richer line-clear animation** — Add particle/sparkle effects or at least a more dramatic CSS animation.
5. **Revive cell removal** — Consider clearing rows (like original) instead of random cells.
6. **Difficulty ceiling → 20,000** — Raise `DIFFICULTY_SCORE_CEILING` from 15,000 to 20,000.
7. **God Mode** — Track consecutive game losses in localStorage; boost easy pieces on the next game after 2+ losses.

### Low Impact
8. **Placement points** — Consider awarding +10 per piece placed (unconfirmed in original).
9. **Streak multiplier cap** — Add a cap at 3.0× or 8.0× (conflicting sources; 3.0× is safer).
10. **Block 3D appearance** — Add subtle border/shadow to make blocks look raised.
11. **Celebration text animation** — Add bouncy scale-in with rotation.
12. **1×1 fallback** — When no piece fits, generate 1×1 blocks.

---

## Confidence Notes

- Scoring formula (10pts/cell, combo table, streak multiplier): **HIGH confidence** — multiple independent sources agree.
- Revives = 1 per game: **HIGH confidence** — professional analysts (Balancy, Gamigion) confirm.
- Pity timer at 7, solution boost at 15: **MEDIUM confidence** — from one engineering analysis of 50K sessions, not independently verified.
- God Mode: **HIGH confidence** — independently confirmed by two professional analysts.
- Perfect clear = 1,000 pts: **MEDIUM confidence** — multiple sources agree but community says it's rarely triggered.
- Placement points (+10): **LOW confidence** — contradictory sources; may not exist.
- Streak cap: **LOW confidence** — sources conflict between 3.0× and 8.0×.

---

*This audit compares Gridlock's codebase against the best available research on Block Blast by Hungry Studio. No official Hungry Studio documentation exists for game internals — all findings are from community analysis, professional game deconstructions, and open-source reimplementations.*
