// ─── Flight Chess (飞行棋) Game Logic ───
// Classic cross-shaped Ludo-style board on a 15x15 grid.
// 4 players, each with 4 planes. 52-cell main loop + 6-cell home stretch per player.
// Roll 6 to take off. Passing over opponents (not just landing) sends them back to base.
// Roll 6 grants an extra turn.

export type PlayerColor = 0 | 1 | 2 | 3; // 0=red, 1=yellow, 2=blue, 3=green
export type PlaneState = 'base' | 'flying' | 'home' | 'finished';

export interface Plane {
  id: number; // 0-3
  color: PlayerColor;
  state: PlaneState;
  position: number; // -1 = base, 0-51 = main loop, 52-57 = home stretch, 58 = finished
}

export interface GameState {
  planes: Plane[]; // 16 planes total
  currentPlayer: PlayerColor;
  diceValue: number | null;
  winner: PlayerColor | null;
  turnCount: number;
  lastAction: string;
}

// Each color enters the main loop at a different entry point (52 / 4 = 13 apart)
export const ENTRY_POINTS: number[] = [0, 13, 26, 39];
export const COLOR_NAMES = ['red', 'yellow', 'blue', 'green'] as const;
export const COLOR_EMOJI = ['🔴', '🟡', '🔵', '🟢'] as const;
export const COLOR_HEX = ['#ef4444', '#eab308', '#3b82f6', '#22c55e'] as const;

// 15x15 classic Ludo-style cross board:
// - 4 corner 6x6 home quadrants (rows/cols 0-5 or 9-14)
// - 4 arms, each 3 cells wide x 6 cells long, connecting quadrants to the center
// - Center 3x3 (rows 6-8, cols 6-8) is the finish area
export const GRID_SIZE = 15;

// 52-cell main loop, traced clockwise starting at Red's entry (adjacent to Red's base)
export const MAIN_LOOP_COORDS: { row: number; col: number }[] = [
  { row: 6, col: 1 }, { row: 6, col: 2 }, { row: 6, col: 3 }, { row: 6, col: 4 }, { row: 6, col: 5 },
  { row: 5, col: 6 }, { row: 4, col: 6 }, { row: 3, col: 6 }, { row: 2, col: 6 }, { row: 1, col: 6 }, { row: 0, col: 6 },
  { row: 0, col: 7 },
  { row: 0, col: 8 },
  { row: 1, col: 8 }, { row: 2, col: 8 }, { row: 3, col: 8 }, { row: 4, col: 8 }, { row: 5, col: 8 },
  { row: 6, col: 9 }, { row: 6, col: 10 }, { row: 6, col: 11 }, { row: 6, col: 12 }, { row: 6, col: 13 }, { row: 6, col: 14 },
  { row: 7, col: 14 },
  { row: 8, col: 14 },
  { row: 8, col: 13 }, { row: 8, col: 12 }, { row: 8, col: 11 }, { row: 8, col: 10 }, { row: 8, col: 9 },
  { row: 9, col: 8 }, { row: 10, col: 8 }, { row: 11, col: 8 }, { row: 12, col: 8 }, { row: 13, col: 8 }, { row: 14, col: 8 },
  { row: 14, col: 7 },
  { row: 14, col: 6 },
  { row: 13, col: 6 }, { row: 12, col: 6 }, { row: 11, col: 6 }, { row: 10, col: 6 }, { row: 9, col: 6 },
  { row: 8, col: 5 }, { row: 8, col: 4 }, { row: 8, col: 3 }, { row: 8, col: 2 }, { row: 8, col: 1 }, { row: 8, col: 0 },
  { row: 7, col: 0 },
  { row: 6, col: 0 },
];

// Home stretch: 6 cells per color, leading from the arm into the center
export const HOME_STRETCH_COORDS: { row: number; col: number }[][] = [
  // Red: row 7, moving right from left arm into center
  [{ row: 7, col: 1 }, { row: 7, col: 2 }, { row: 7, col: 3 }, { row: 7, col: 4 }, { row: 7, col: 5 }, { row: 7, col: 6 }],
  // Yellow: col 7, moving down from top arm into center
  [{ row: 1, col: 7 }, { row: 2, col: 7 }, { row: 3, col: 7 }, { row: 4, col: 7 }, { row: 5, col: 7 }, { row: 6, col: 7 }],
  // Blue: row 7, moving left from right arm into center
  [{ row: 7, col: 13 }, { row: 7, col: 12 }, { row: 7, col: 11 }, { row: 7, col: 10 }, { row: 7, col: 9 }, { row: 7, col: 8 }],
  // Green: col 7, moving up from bottom arm into center
  [{ row: 13, col: 7 }, { row: 12, col: 7 }, { row: 11, col: 7 }, { row: 10, col: 7 }, { row: 9, col: 7 }, { row: 8, col: 7 }],
];

// Base (airport) positions - 4 planes in a 2x2 spread within each 6x6 corner quadrant
export const BASE_COORDS: { row: number; col: number }[][] = [
  [{ row: 1, col: 1 }, { row: 1, col: 4 }, { row: 4, col: 1 }, { row: 4, col: 4 }], // Red: rows0-5,cols0-5
  [{ row: 1, col: 10 }, { row: 1, col: 13 }, { row: 4, col: 10 }, { row: 4, col: 13 }], // Yellow: rows0-5,cols9-14
  [{ row: 10, col: 10 }, { row: 10, col: 13 }, { row: 13, col: 10 }, { row: 13, col: 13 }], // Blue: rows9-14,cols9-14
  [{ row: 10, col: 1 }, { row: 10, col: 4 }, { row: 13, col: 1 }, { row: 13, col: 4 }], // Green: rows9-14,cols0-5
];

export function createInitialState(): GameState {
  const planes: Plane[] = [];
  for (let c = 0; c < 4; c++) {
    for (let p = 0; p < 4; p++) {
      planes.push({ id: p, color: c as PlayerColor, state: 'base', position: -1 });
    }
  }
  return {
    planes,
    currentPlayer: 0,
    diceValue: null,
    winner: null,
    turnCount: 0,
    lastAction: '',
  };
}

export function rollDice(): number {
  return Math.floor(Math.random() * 6) + 1;
}

// Get the absolute loop position for a plane
function getLoopPosition(color: PlayerColor, position: number): number {
  return (ENTRY_POINTS[color] + position) % 52;
}

// Get planes that can be moved given the dice value
export function getMovablePlanes(state: GameState, color: PlayerColor, dice: number): Plane[] {
  if (state.winner !== null) return [];
  return state.planes.filter((p) => {
    if (p.color !== color) return false;
    if (p.state === 'finished') return false;
    if (p.state === 'base') return dice === 6;
    if (p.state === 'flying' || p.state === 'home') {
      return p.position + dice <= 58;
    }
    return false;
  });
}

// Check if any opponent planes are at the given relative position and capture them
function checkCaptures(planes: Plane[], movingColor: PlayerColor, relativePos: number): PlayerColor[] {
  const captured: PlayerColor[] = [];
  const movingLoopPos = getLoopPosition(movingColor, relativePos);

  for (const p of planes) {
    if (p.color === movingColor) continue;
    if (p.state !== 'flying') continue;
    const opponentLoopPos = getLoopPosition(p.color, p.position);
    if (opponentLoopPos === movingLoopPos) {
      p.state = 'base';
      p.position = -1;
      captured.push(p.color);
    }
  }

  return captured;
}

// Move a plane and handle captures.
// `activePlayers` = number of colors actually in play (used for turn rotation),
// since both local (vs AI) and online PvP modes only use 2 of the 4 colors.
export function movePlane(state: GameState, color: PlayerColor, planeId: number, dice: number, activePlayers = 4): GameState {
  const newPlanes = state.planes.map((p) => ({ ...p }));
  const plane = newPlanes.find((p) => p.color === color && p.id === planeId);
  if (!plane) return state;

  let captured: PlayerColor[] = [];
  let action = '';

  if (plane.state === 'base' && dice === 6) {
    plane.state = 'flying';
    plane.position = 0;
    action = `${COLOR_EMOJI[color]} 起飞！`;
    captured = checkCaptures(newPlanes, color, 0);
  } else if (plane.state === 'flying' || plane.state === 'home') {
    const startPos = plane.position;
    const newPos = startPos + dice;

    if (newPos >= 58) {
      plane.state = 'finished';
      plane.position = 58;
      action = `${COLOR_EMOJI[color]} 飞机${planeId + 1} 到达终点！`;
    } else if (newPos >= 52) {
      plane.state = 'home';
      plane.position = newPos;
      action = `${COLOR_EMOJI[color]} 飞机${planeId + 1} 进入归航道`;
    } else {
      plane.position = newPos;
      action = `${COLOR_EMOJI[color]} 飞机${planeId + 1} 前进 ${dice} 格`;
      // Capture: check all cells passed through (user rule: passing through captures)
      for (let step = 1; step <= dice; step++) {
        const pathPos = startPos + step;
        if (pathPos >= 52) break;
        const caps = checkCaptures(newPlanes, color, pathPos);
        captured.push(...caps);
      }
    }
  }

  if (captured.length > 0) {
    const uniqueCaptured = [...new Set(captured)];
    action += ` 击落 ${uniqueCaptured.map((c) => COLOR_EMOJI[c]).join('')}`;
  }

  const allFinished = newPlanes.filter((p) => p.color === color).every((p) => p.state === 'finished');
  const winner = allFinished ? color : null;

  const extraTurn = dice === 6 && !winner;
  const nextPlayer = extraTurn ? color : ((color + 1) % activePlayers) as PlayerColor;

  return {
    planes: newPlanes,
    currentPlayer: nextPlayer,
    diceValue: dice,
    winner,
    turnCount: state.turnCount + 1,
    lastAction: action,
  };
}

// Get display coordinates for a plane
export function getDisplayCoords(color: PlayerColor, planeId: number, position: number): { row: number; col: number } {
  if (position === -1) {
    return BASE_COORDS[color][planeId];
  }
  if (position === 58) {
    return { row: 7, col: 7 };
  }
  if (position < 52) {
    const absolutePos = (ENTRY_POINTS[color] + position) % 52;
    return MAIN_LOOP_COORDS[absolutePos];
  }
  const homeIdx = position - 52;
  return HOME_STRETCH_COORDS[color][homeIdx];
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}
