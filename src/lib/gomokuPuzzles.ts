// Gomoku puzzle data: 34 hand-constructed tactical endgame challenges
// Each puzzle: player is Black (1), must find a decisive move.
// Board is 15x15, 0=empty, 1=black, 2=white
// solution: [row, col] of one valid decisive move (other equally-decisive
// moves, e.g. the other end of an open four, are also accepted at runtime
// via isDecisiveMove — see handlePuzzleClick in Gomoku.tsx).

export type Puzzle = {
  id: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  board: number[][]; // 15x15
  solution: [number, number];
  hint: string;
};

const SIZE = 15;
type Dir = [number, number];
const DIRS: Dir[] = [[0, 1], [1, 0], [1, 1], [1, -1]];

function emptyBoard(): number[][] {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}

// Helper to place stones on a board
function place(stones: [number, number, number][]): number[][] {
  const b = emptyBoard();
  for (const [r, c, v] of stones) {
    if (inBounds(r, c)) b[r][c] = v;
  }
  return b;
}

type LineShape = 'five' | 'openFour' | 'four' | 'openThree' | 'none';

// Classify the line passing through (row, col) along direction (dr, dc),
// assuming `stone` was just placed at (row, col).
function analyzeLine(board: number[][], row: number, col: number, dr: number, dc: number, stone: number): LineShape {
  let count = 1;
  let r = row + dr, c = col + dc;
  while (inBounds(r, c) && board[r][c] === stone) { count++; r += dr; c += dc; }
  const frontOpen = inBounds(r, c) && board[r][c] === 0;

  let r2 = row - dr, c2 = col - dc;
  while (inBounds(r2, c2) && board[r2][c2] === stone) { count++; r2 -= dr; c2 -= dc; }
  const backOpen = inBounds(r2, c2) && board[r2][c2] === 0;

  if (count >= 5) return 'five';
  if (count === 4) return frontOpen && backOpen ? 'openFour' : frontOpen || backOpen ? 'four' : 'none';
  if (count === 3) return frontOpen && backOpen ? 'openThree' : 'none';
  return 'none';
}

// True if placing `stone` at (row, col) is a decisive move: an outright win,
// an open four (unstoppable), a double-four, a four+open-three combo, or a
// double open-three (双活三). This is the same standard used to construct
// every puzzle below, and is reused at runtime to accept alternate winning
// moves that weren't the specific coordinate the puzzle was authored around.
export function isDecisiveMove(board: number[][], row: number, col: number, stone: number): boolean {
  let five = false, openFours = 0, fours = 0, openThrees = 0;
  for (const [dr, dc] of DIRS) {
    const shape = analyzeLine(board, row, col, dr, dc, stone);
    if (shape === 'five') five = true;
    else if (shape === 'openFour') openFours++;
    else if (shape === 'four') fours++;
    else if (shape === 'openThree') openThrees++;
  }
  if (five || openFours >= 1) return true;
  if (fours >= 2) return true;
  if (fours >= 1 && openThrees >= 1) return true;
  if (openThrees >= 2) return true;
  return false;
}

// Deterministic tiny PRNG so puzzle boards are stable across reloads.
function mulberry32(seed: number) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// It is Black's move in every puzzle here, which only reflects a reachable
// game state if the board actually looks like one real, tangled local fight
// — the way an actual gomoku endgame screenshot looks: a single dense knot
// of interlocked black/white stones, not the tactical shape floating alone
// with a separate decoy pile parked somewhere else on the board. So the
// extra stones are grown directly OUT of the tactical shape itself: the
// frontier starts as the tactical stones, and each new stone lands
// immediately adjacent (radius 1) to an existing stone in the cluster,
// alternating colors, until both sides reach `targetPerSide`. Every cell
// reserved by `protectedCells` (the empty squares the tactic needs to stay
// open) is strictly off-limits, so the solution is unaffected no matter how
// tightly the surrounding stones pack in.
function buildRealisticContext(
  tacticalStones: [number, number, number][],
  protectedCells: [number, number][],
  seed: number,
  targetPerSide = 7
): [number, number, number][] {
  const rand = mulberry32(seed);
  const used = new Set<string>();
  for (const [r, c] of tacticalStones) used.add(`${r},${c}`);
  for (const [r, c] of protectedCells) used.add(`${r},${c}`);

  const black0 = tacticalStones.filter(([, , v]) => v === 1).length;
  const white0 = tacticalStones.filter(([, , v]) => v === 2).length;
  let needBlack = Math.max(0, targetPerSide - black0);
  let needWhite = Math.max(0, targetPerSide - white0);

  const result: [number, number, number][] = [];
  const frontier: [number, number][] = tacticalStones.map(([r, c]) => [r, c]);
  let colorTurn: 1 | 2 = rand() < 0.5 ? 1 : 2;
  let guard = 0;

  while ((needBlack > 0 || needWhite > 0) && guard < 500) {
    guard++;
    const color: 1 | 2 = needBlack > 0 && needWhite > 0 ? colorTurn : needBlack > 0 ? 1 : 2;

    let placed = false;
    // Radius-1 growth (mostly) keeps everything touching/interlocked like a
    // real dense mid-game knot; an occasional radius-2 hop lets the cluster
    // widen a little instead of becoming a single unbroken blob.
    for (let tries = 0; tries < 25 && !placed; tries++) {
      const [br, bc] = frontier[Math.floor(rand() * frontier.length)];
      const radius = rand() < 0.8 ? 1 : 2;
      const dr = Math.floor(rand() * (radius * 2 + 1)) - radius;
      const dc = Math.floor(rand() * (radius * 2 + 1)) - radius;
      if (dr === 0 && dc === 0) continue;
      const r = br + dr, c = bc + dc;
      if (!inBounds(r, c)) continue;
      const key = `${r},${c}`;
      if (used.has(key)) continue;
      used.add(key);
      result.push([r, c, color]);
      frontier.push([r, c]);
      placed = true;
    }
    if (!placed) {
      // Fallback: drop anywhere free so we never get stuck short of target.
      for (let i = 0; i < 300; i++) {
        const r = Math.floor(rand() * SIZE), c = Math.floor(rand() * SIZE);
        const key = `${r},${c}`;
        if (used.has(key)) continue;
        used.add(key);
        result.push([r, c, color]);
        frontier.push([r, c]);
        placed = true;
        break;
      }
      if (!placed) break;
    }
    if (color === 1) needBlack--; else needWhite--;
    colorTurn = color === 1 ? 2 : 1;
  }

  return result;
}

function makePuzzles(): Puzzle[] {
  const puzzles: Puzzle[] = [];
  let id = 1;

  // ─── Difficulty 1: open four — one end blocked, fill the open end for five ───
  const tier1: { dir: number; base: [number, number] }[] = [
    { dir: 0, base: [3, 3] },
    { dir: 1, base: [4, 7] },
    { dir: 2, base: [2, 2] },
    { dir: 3, base: [5, 10] },
    { dir: 0, base: [10, 2] },
    { dir: 1, base: [8, 9] },
  ];
  for (const { dir, base: [br, bc] } of tier1) {
    const [dr, dc] = DIRS[dir];
    const stones: [number, number, number][] = [];
    for (let k = 0; k < 4; k++) stones.push([br + dr * k, bc + dc * k, 1]);
    stones.push([br + dr * 4, bc + dc * 4, 2]); // block far end
    const solR = br - dr, solC = bc - dc;
    puzzles.push({
      id: id++,
      difficulty: 1,
      board: place([...stones, ...buildRealisticContext(stones, [[solR, solC]], id)]),
      solution: [solR, solC],
      hint: '一端已被封堵，把子下在另一端即可五连获胜',
    });
  }

  // ─── Difficulty 2: broken four (gap in the middle) — fill the gap for five ───
  const tier2: { dir: number; base: [number, number] }[] = [
    { dir: 0, base: [3, 3] },
    { dir: 1, base: [6, 2] },
    { dir: 2, base: [2, 6] },
    { dir: 3, base: [9, 11] },
    { dir: 0, base: [11, 1] },
    { dir: 1, base: [1, 9] },
  ];
  for (const { dir, base: [br, bc] } of tier2) {
    const [dr, dc] = DIRS[dir];
    const stones: [number, number, number][] = [];
    for (const k of [0, 1, 3, 4]) stones.push([br + dr * k, bc + dc * k, 1]);
    stones.push([br + dr * 5, bc + dc * 5, 2]); // block far end
    const solR = br + dr * 2, solC = bc + dc * 2;
    puzzles.push({
      id: id++,
      difficulty: 2,
      board: place([...stones, ...buildRealisticContext(stones, [[solR, solC]], id)]),
      solution: [solR, solC],
      hint: '四子中间断了一个点，补上缺口即可五连',
    });
  }

  // ─── Difficulty 3: four + open-three combo (冲四活三) ───
  // dirA already has 3 stones with the far end blocked (becomes a forcing
  // "four" when completed); dirB has 2 stones with both ends open (becomes
  // an open three). The shared point wins either way the opponent responds.
  const tier3Pairs: [number, number][] = [[0, 1], [1, 0], [0, 2], [2, 0], [0, 3], [1, 2], [2, 3]];
  for (const [a, b] of tier3Pairs) {
    const [T_R, T_C] = [7, 7];
    const [adr, adc] = DIRS[a];
    const [bdr, bdc] = DIRS[b];
    const stones: [number, number, number][] = [
      [T_R - adr, T_C - adc, 1],
      [T_R - adr * 2, T_C - adc * 2, 1],
      [T_R - adr * 3, T_C - adc * 3, 1],
      [T_R - adr * 4, T_C - adc * 4, 2],
      [T_R + bdr, T_C + bdc, 1],
      [T_R + bdr * 2, T_C + bdc * 2, 1],
    ];
    const protectedCells: [number, number][] = [
      [T_R, T_C],
      [T_R + adr, T_C + adc],
      [T_R - bdr, T_C - bdc],
      [T_R + bdr * 3, T_C + bdc * 3],
    ];
    puzzles.push({
      id: id++,
      difficulty: 3,
      board: place([...stones, ...buildRealisticContext(stones, protectedCells, id)]),
      solution: [T_R, T_C],
      hint: '冲四活三：这步棋同时形成一个冲四和一个活三，对手防不住两头',
    });
  }

  // ─── Difficulty 4: double open three (双活三) ───
  const tier4: { a: number; b: number; mirrorA?: boolean }[] = [
    { a: 0, b: 1 }, { a: 0, b: 2 }, { a: 0, b: 3 },
    { a: 1, b: 2 }, { a: 1, b: 3 }, { a: 2, b: 3 },
    { a: 0, b: 1, mirrorA: true },
  ];
  for (const { a, b, mirrorA } of tier4) {
    const [T_R, T_C] = [7, 7];
    const [adr, adc] = DIRS[a];
    const [bdr, bdc] = DIRS[b];
    const sign = mirrorA ? -1 : 1;
    const stones: [number, number, number][] = [
      [T_R + adr * sign, T_C + adc * sign, 1],
      [T_R + adr * sign * 2, T_C + adc * sign * 2, 1],
      [T_R + bdr, T_C + bdc, 1],
      [T_R + bdr * 2, T_C + bdc * 2, 1],
    ];
    const protectedCells: [number, number][] = [
      [T_R, T_C],
      [T_R - adr * sign, T_C - adc * sign],
      [T_R + adr * sign * 3, T_C + adc * sign * 3],
      [T_R - bdr, T_C - bdc],
      [T_R + bdr * 3, T_C + bdc * 3],
    ];
    puzzles.push({
      id: id++,
      difficulty: 4,
      board: place([...stones, ...buildRealisticContext(stones, protectedCells, id)]),
      solution: [T_R, T_C],
      hint: '双活三：这步棋同时做出两个活三，对手只能挡住一边',
    });
  }

  // ─── Difficulty 5: double four (双冲四) — hardest, both lines forcing ───
  const tier5: { a: number; b: number; sign?: number }[] = [
    { a: 0, b: 1 }, { a: 0, b: 2 }, { a: 0, b: 3 },
    { a: 1, b: 2 }, { a: 1, b: 3 }, { a: 2, b: 3 },
    { a: 0, b: 1, sign: 1 }, { a: 2, b: 3, sign: 1 },
  ];
  for (const { a, b, sign = -1 } of tier5) {
    const [T_R, T_C] = [7, 7];
    const [adr, adc] = DIRS[a];
    const [bdr, bdc] = DIRS[b];
    const stones: [number, number, number][] = [
      [T_R + adr * sign, T_C + adc * sign, 1],
      [T_R + adr * sign * 2, T_C + adc * sign * 2, 1],
      [T_R + adr * sign * 3, T_C + adc * sign * 3, 1],
      [T_R + adr * sign * 4, T_C + adc * sign * 4, 2],
      [T_R + bdr * sign, T_C + bdc * sign, 1],
      [T_R + bdr * sign * 2, T_C + bdc * sign * 2, 1],
      [T_R + bdr * sign * 3, T_C + bdc * sign * 3, 1],
      [T_R + bdr * sign * 4, T_C + bdc * sign * 4, 2],
    ];
    const protectedCells: [number, number][] = [
      [T_R, T_C],
      [T_R - adr * sign, T_C - adc * sign],
      [T_R - bdr * sign, T_C - bdc * sign],
    ];
    puzzles.push({
      id: id++,
      difficulty: 5,
      board: place([...stones, ...buildRealisticContext(stones, protectedCells, id)]),
      solution: [T_R, T_C],
      hint: '双冲四：这步棋同时形成两个冲四，对手无法两头都堵',
    });
  }

  return puzzles;
}

export const GOMOKU_PUZZLES: Puzzle[] = makePuzzles();
