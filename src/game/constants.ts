export const GRID_SIZE = 8;
export const FINGER_OFFSET = 40; // px upward on mobile
export const CLEAR_ANIMATION_MS = 450;
export const CLEAR_STAGGER_MS = 20; // delay per cell in cascade
export const CLEAR_ANTICIPATION_MS = 80; // hit-stop + anticipation pulse before cascade

export const PIECE_COLORS = {
  blue: '#4B7BF5',
  cyan: '#1DC4F4',
  red: '#F43838',
  orange: '#FF8C00',
  yellow: '#FFD600',
  green: '#3DD856',
  purple: '#B83DEB',
  pink: '#FF2D78',
} as const;

export const PIECE_COLOR_KEYS = Object.keys(PIECE_COLORS) as (keyof typeof PIECE_COLORS)[];

// Scoring
export const POINTS_PER_CELL = 10;
export const LINE_BONUS = 10; // flat bonus per line cleared
export const COMBO_MULTIPLIERS = [1.0, 1.5, 2.5, 4.0, 6.0] as const; // index = linesCleared - 1
export const STREAK_MULTIPLIER_INCREMENT = 0.5;

// Revive
export const REVIVES_PER_GAME = 3;
export const REVIVE_CELLS_CLEARED = 20;

// Undo
export const UNDOS_PER_GAME = 0;

// Adaptive piece generation — mercy (when struggling)
export const PITY_THRESHOLD = 7;
export const SOLUTION_THRESHOLD = 15;
export const PITY_WEIGHT_BOOST = 3.0;
export const SOLUTION_WEIGHT_BOOST = 5.0;

// Adaptive piece generation — difficulty scaling (when doing well)
export const DIFFICULTY_SCORE_THRESHOLD = 3000; // score where difficulty ramp begins
export const DIFFICULTY_SCORE_CEILING = 15000;  // score where difficulty maxes out
export const DIFFICULTY_HARD_BOOST_MAX = 3.0;   // max multiplier for hard pieces at ceiling
export const DIFFICULTY_EASY_PENALTY_MAX = 0.3; // min multiplier for easy pieces at ceiling
export const STREAK_HARDENING_THRESHOLD = 2;    // streak count where pushback starts
export const STREAK_HARD_BOOST = 1.5;           // weight multiplier for hard pieces per streak
export const BOARD_OPEN_THRESHOLD = 0.6;        // if >60% cells empty, board is "open" → harder pieces
export const BOARD_CRITICAL_THRESHOLD = 0.25;   // if <25% cells empty, board is "critical" → easier pieces

// All-clear bonus
export const ALL_CLEAR_BONUS = 300;

// Score milestones
export const SCORE_MILESTONES = [1000, 2500, 5000, 10000, 25000, 50000] as const;

// Celebration text thresholds
export const CELEBRATION_TEXTS = [
  { minLines: 1, text: 'Good Work!' },
  { minLines: 2, text: 'Excellent!' },
  { minLines: 3, text: 'Amazing!' },
  { minLines: 4, text: 'Perfect!' },
] as const;
