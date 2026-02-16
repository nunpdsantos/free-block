export const GRID_SIZE = 8;
export const CELL_SIZE = 48; // px
export const CELL_GAP = 2; // px
export const FINGER_OFFSET = 40; // px upward on mobile
export const CLEAR_ANIMATION_MS = 600;
export const CLEAR_STAGGER_MS = 30; // delay per cell in cascade

export const PIECE_COLORS = {
  blue: '#5B8DEF',
  cyan: '#42C6EA',
  red: '#EF5350',
  orange: '#FFA726',
  yellow: '#FFCA28',
  green: '#66BB6A',
  purple: '#AB47BC',
  pink: '#EC407A',
} as const;

export const PIECE_COLOR_KEYS = Object.keys(PIECE_COLORS) as (keyof typeof PIECE_COLORS)[];

// Scoring
export const POINTS_PER_CELL = 10;
export const COMBO_BASE_BONUS = 20;
export const COMBO_INCREMENT = 10;
export const STREAK_MULTIPLIER_INCREMENT = 0.5;
export const STREAK_MULTIPLIER_CAP = 8.0;

// Revive
export const REVIVES_PER_GAME = 1;

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

// Background palette stages — cycle as score increases
export const BG_PALETTES = [
  { score: 0,    bg: '#4A5899', bgDark: '#3D4A80' },   // Blue (default)
  { score: 500,  bg: '#2D7D6F', bgDark: '#1E5C4F' },   // Teal
  { score: 1500, bg: '#6B3FA0', bgDark: '#4A2D72' },   // Purple
  { score: 3000, bg: '#B85C38', bgDark: '#8B4329' },   // Warm Orange
  { score: 5000, bg: '#A84171', bgDark: '#7B2F54' },   // Rose
  { score: 8000, bg: '#2E4272', bgDark: '#1E2D4F' },   // Deep Navy
] as const;

// All-clear bonus
export const ALL_CLEAR_BONUS = 500;

// Score milestones
export const SCORE_MILESTONES = [1000, 2500, 5000, 10000, 25000, 50000] as const;

// Celebration text thresholds
export const CELEBRATION_TEXTS = [
  { minLines: 1, text: 'Good Work!' },
  { minLines: 2, text: 'Excellent!' },
  { minLines: 3, text: 'Amazing!' },
  { minLines: 4, text: 'Perfect!' },
] as const;
