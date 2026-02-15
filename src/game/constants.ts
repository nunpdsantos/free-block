export const GRID_SIZE = 8;
export const CELL_SIZE = 48; // px
export const CELL_GAP = 2; // px
export const FINGER_OFFSET = 40; // px upward on mobile
export const CLEAR_ANIMATION_MS = 450;

export const PIECE_COLORS = {
  red: '#e74c3c',
  orange: '#e67e22',
  yellow: '#f1c40f',
  green: '#2ecc71',
  teal: '#1abc9c',
  blue: '#3498db',
  indigo: '#5b6abf',
  purple: '#9b59b6',
  pink: '#e84393',
  brown: '#b5651d',
} as const;

export const PIECE_COLOR_KEYS = Object.keys(PIECE_COLORS) as (keyof typeof PIECE_COLORS)[];

export const THEME = {
  bg: '#1a1a2e',
  boardBg: '#16213e',
  cellEmpty: '#1e2d4a',
  cellBorder: '#0f1b30',
  ghostValid: 'rgba(46, 204, 113, 0.4)',
  ghostInvalid: 'rgba(231, 76, 60, 0.4)',
  textPrimary: '#ffffff',
  textSecondary: '#8899aa',
  streakGlow: '#f1c40f',
} as const;

// Scoring
export const POINTS_PER_CELL = 10;
export const COMBO_BASE_BONUS = 20;
export const COMBO_INCREMENT = 10;
export const STREAK_MULTIPLIER_INCREMENT = 0.5;
export const STREAK_MULTIPLIER_CAP = 3.0;
export const PERFECT_CLEAR_BONUS = 1000;
export const PLACEMENT_POINTS = 10;

// Revive
export const REVIVES_PER_GAME = 1;
export const REVIVE_ROWS_TO_CLEAR = 2;

// Adaptive piece generation — mercy (when struggling)
export const PITY_THRESHOLD = 7;
export const SOLUTION_THRESHOLD = 15;
export const PITY_WEIGHT_BOOST = 3.0;
export const SOLUTION_WEIGHT_BOOST = 5.0;

// Adaptive piece generation — difficulty scaling (when doing well)
export const DIFFICULTY_SCORE_THRESHOLD = 3000; // score where difficulty ramp begins
export const DIFFICULTY_SCORE_CEILING = 20000;  // score where difficulty maxes out
export const DIFFICULTY_HARD_BOOST_MAX = 3.0;   // max multiplier for hard pieces at ceiling
export const DIFFICULTY_EASY_PENALTY_MAX = 0.3; // min multiplier for easy pieces at ceiling
export const STREAK_HARDENING_THRESHOLD = 2;    // streak count where pushback starts
export const STREAK_HARD_BOOST = 1.5;           // weight multiplier for hard pieces per streak
export const BOARD_OPEN_THRESHOLD = 0.6;        // if >60% cells empty, board is "open" → harder pieces
export const BOARD_CRITICAL_THRESHOLD = 0.25;   // if <25% cells empty, board is "critical" → easier pieces

// Celebration text thresholds
export const CELEBRATION_TEXTS = [
  { minLines: 1, text: 'Good Work!' },
  { minLines: 2, text: 'Excellent!' },
  { minLines: 3, text: 'Amazing!' },
  { minLines: 4, text: 'Perfect!' },
] as const;
