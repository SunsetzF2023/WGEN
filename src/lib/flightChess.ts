// ─── Flight Chess (飞行棋) Game Logic ───
// 4 players, each with 4 planes.
// 52-cell main loop + 6-cell home stretch per player.
// Roll 6 to take off. Passing over opponents sends them back to base.

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

// Each color enters the main loop at a different entry point
export const ENTRY_POINTS: number[] = [0, 13, 26, 39];
export const COLOR_NAMES = ['red', 'yellow', 'blue', 'green'] as const;
export const COLOR_EMOJI = ['🔴', '🟡', '🔵', '🟢'] as const;
export const COLOR_HEX = ['#ef4444', '#eab308', '#3b82f6', '#22c55e'] as const;

export const GRID_SIZE = 14;

// Build 52-cell main loop as the outer ring of a 14x14 grid
function buildMainLoopCoords(): { row: number; col: number }[] {
  const coords: { row: number; col: number }[] = [];
  for (let c = 0; c < GRID_SIZE; c++) coords.push({ row: 0, col: c });
  for (let r = 1; r < GRID_SIZE; r++) coords.push({ row: r, col: GRID_SIZE - 1 });
  for (let c = GRID_SIZE - 2; c >= 0; c--) coords.push({ row: GRID_SIZE - 1, col: c });
  for (let r = GRID_SIZE - 2; r >= 1; r--) coords.push({ row: r, col: 0 });
  return coords;
}

export const MAIN_LOOP_COORDS = buildMainLoopCoords();

// Home stretch: 6 cells diagonally toward center from each corner
export const HOME_STRETCH_COORDS: { row: number; col: number }[][] = [
  [{ row: 1, col: 1 }, { row: 2, col: 2 }, { row: 3, col: 3 }, { row: 4, col: 4 }, { row: 5, col: 5 }, { row: 6, col: 6 }],
  [{ row: 1, col: 12 }, { row: 2, col: 11 }, { row: 3, col: 10 }, { row: 4, col: 9 }, { row: 5, col: 8 }, { row: 6, col: 7 }],
  [{ row: 12, col: 12 }, { row: 11, col: 11 }, { row: 10, col: 10 }, { row: 9, col: 9 }, { row: 8, col: 8 }, { row: 7, col: 7 }],
  [{ row: 12, col: 1 }, { row: 11, col: 2 }, { row: 10, col: 3 }, { row: 9, col: 4 }, { row: 8, col: 5 }, { row: 7, col: 6 }],
];

// Base (airport) positions - 4 planes in a 2x2 grid near each corner
export const BASE_COORDS: { row: number; col: number }[][] = [
  [{ row: 2, col: 2 }, { row: 2, col: 4 }, { row: 4, col: 2 }, { row: 4, col: 4 }],
  [{ row: 2, col: 10 }, { row: 2, col: 12 }, { row: 4, col: 10 }, { row: 4, col: 12 }],
  [{ row: 9, col: 10 }, { row: 9, col: 12 }, { row: 11, col: 10 }, { row: 11, col: 12 }],
  [{ row: 9, col: 2 }, { row: 9, col: 4 }, { row: 11, col: 2 }, { row: 11, col: 4 }],
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

// Move a plane and handle captures
export function movePlane(state: GameState, color: PlayerColor, planeId: number, dice: number): GameState {
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
  const nextPlayer = extraTurn ? color : ((color + 1) % 4) as PlayerColor;

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
