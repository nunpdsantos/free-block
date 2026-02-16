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
};

export type GameAction =
  | { type: 'PLACE_PIECE'; pieceIndex: number; row: number; col: number }
  | { type: 'NEW_GAME' }
  | { type: 'REVIVE' }
  | { type: 'DISMISS_CELEBRATION' }
  | { type: 'LOAD_HIGH_SCORE'; highScore: number };
