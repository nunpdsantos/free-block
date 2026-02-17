export type Coord = { row: number; col: number };

export type PieceShape = {
  coords: Coord[];
  color: string;
  id: string;
};

export type Board = (string | null)[][];

export type DragState = {
  piece: PieceShape;
  pieceIndex: number;
  pointerX: number;
  pointerY: number;
  boardRow: number | null;
  boardCol: number | null;
  isValid: boolean;
};

export type GhostCells = Map<string, boolean>; // "row,col" -> valid

export type ClearingCell = { row: number; col: number };

export type LeaderboardEntry = { score: number; date: string };

export type GlobalLeaderboardEntry = {
  uid: string;
  displayName: string;
  score: number;
  mode: 'classic' | 'daily';
  date: string;
};

export type UndoSnapshot = {
  board: Board;
  currentPieces: (PieceShape | null)[];
  score: number;
  streak: number;
  movesSinceLastClear: number;
  pieceGeneration: number;
  lastMilestone: number;
};

export type GameMode = 'classic' | 'daily';

export type DailyResult = {
  date: string;
  score: number;
  dayNumber: number;
};

export type GameState = {
  board: Board;
  currentPieces: (PieceShape | null)[];
  score: number;
  highScore: number;
  streak: number;
  isGameOver: boolean;
  lastClearCount: number;
  celebrationText: string | null;
  revivesRemaining: number;
  movesSinceLastClear: number;
  pieceGeneration: number;
  lastMilestone: number;
  undoSnapshot: UndoSnapshot | null;
  undosRemaining: number;
  postReviveGrace: boolean;
  mode: GameMode;
  dailySeed?: number;
};

export type GameAction =
  | { type: 'PLACE_PIECE'; pieceIndex: number; row: number; col: number }
  | { type: 'NEW_GAME' }
  | { type: 'NEW_DAILY_GAME'; seed: number }
  | { type: 'REVIVE' }
  | { type: 'UNDO' }
  | { type: 'DISMISS_CELEBRATION' }
  | { type: 'LOAD_HIGH_SCORE'; highScore: number };

export type PlayerStats = {
  gamesPlayed: number;
  totalScore: number;
  totalLinesCleared: number;
  totalPiecesPlaced: number;
  bestStreak: number;
  allClearCount: number;
  totalRevivesUsed: number;
  highestScoreWithoutRevive: number;
};

export type AchievementProgress = Record<string, number>; // achievementId → unlock timestamp

export type DailyStreak = {
  currentStreak: number;
  bestStreak: number;
  lastPlayedDate: string | null; // YYYY-MM-DD
};

export type PlayerRankInfo = {
  rank: number;
  score: number;
  displayName: string;
};
