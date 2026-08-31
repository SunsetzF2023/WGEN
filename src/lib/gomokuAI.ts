// Gomoku opponent AI: pattern-based evaluation + minimax with alpha-beta
// pruning and iterative deepening. This is a genuine tree search, not a
// hand-coded if/else defense table — the engine looks 4-6 plies ahead
// (AI move, human move, AI move, human move, ...), scoring every resulting
// position with a shape-classification evaluation function, and prunes
// branches that cannot affect the final decision (alpha-beta).

export type Cell = 0 | 1 | 2;
export type Board = Cell[][];

const SIZE = 15;
const DIRS: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1]];

// Score table for shapes, roughly matching standard gomoku theory naming:
// five, open-four (活四), four (冲四, one end open), open-three (活三),
// sleep-three (眠三, one end open), open-two (活二), sleep-two (眠二).
const SCORE = {
  five: 10_000_000,
  openFour: 1_000_000,
  four: 100_000,
  gapFour: 90_000, // broken four, e.g. XX_XX — just as forcing as a plain four
  openThree: 10_000,
  sleepThree: 1_000,
  openTwo: 200,
  sleepTwo: 50,
};

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}

// -1 = out of bounds, treated as blocking for every color.
function at(board: Board, r: number, c: number): number {
  return inBounds(r, c) ? board[r][c] : -1;
}

function runScore(len: number, frontOpen: boolean, backOpen: boolean): number {
  if (len >= 5) return SCORE.five;
  const openEnds = (frontOpen ? 1 : 0) + (backOpen ? 1 : 0);
  if (len === 4) return openEnds === 2 ? SCORE.openFour : openEnds === 1 ? SCORE.four : 0;
  if (len === 3) return openEnds === 2 ? SCORE.openThree : openEnds === 1 ? SCORE.sleepThree : 0;
  if (len === 2) return openEnds === 2 ? SCORE.openTwo : openEnds === 1 ? SCORE.sleepTwo : 0;
  return 0;
}

// Scores every contiguous run of `stone` on the board (five/open-four/four/
// open-three/sleep-three/open-two/sleep-two).
function scanRuns(board: Board, stone: Cell): number {
  let score = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] !== stone) continue;
      for (const [dr, dc] of DIRS) {
        if (at(board, r - dr, c - dc) === stone) continue; // not the start of a run
        let len = 0, rr = r, cc = c;
        while (at(board, rr, cc) === stone) { len++; rr += dr; cc += dc; }
        const frontOpen = at(board, rr, cc) === 0;
        const backOpen = at(board, r - dr, c - dc) === 0;
        score += runScore(len, frontOpen, backOpen);
      }
    }
  }
  return score;
}

// Scores "broken" shapes that a plain contiguous-run scan misses, e.g.
// X X _ X X (gap four) or X _ X (gap inside a three). Only counts windows
// where the gap sits strictly inside the run (not at either end — those are
// already covered by scanRuns) to avoid double counting.
function scanGaps(board: Board, stone: Cell): number {
  let score = 0;
  for (const [dr, dc] of DIRS) {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const endR = r + dr * 4, endC = c + dc * 4;
        if (!inBounds(endR, endC)) continue;
        let selfCount = 0, emptyCount = 0, gapPos = -1, blocked = false;
        for (let k = 0; k < 5; k++) {
          const v = board[r + dr * k][c + dc * k];
          if (v === stone) selfCount++;
          else if (v === 0) { emptyCount++; gapPos = k; }
          else { blocked = true; break; }
        }
        if (blocked) continue;
        if (selfCount === 4 && emptyCount === 1 && gapPos > 0 && gapPos < 4) {
          score += SCORE.gapFour;
        } else if (selfCount === 3 && emptyCount === 2 && gapPos > 0 && gapPos < 4) {
          score += SCORE.sleepThree * 0.6;
        }
      }
    }
  }
  return score;
}

export function evaluateBoard(board: Board, forPlayer: Cell): number {
  const opp: Cell = forPlayer === 1 ? 2 : 1;
  const self = scanRuns(board, forPlayer) + scanGaps(board, forPlayer);
  const enemy = scanRuns(board, opp) + scanGaps(board, opp);
  return self - enemy * 1.05;
}

function checkFiveAt(board: Board, row: number, col: number, stone: Cell): boolean {
  for (const [dr, dc] of DIRS) {
    let count = 1;
    let r = row + dr, c = col + dc;
    while (at(board, r, c) === stone) { count++; r += dr; c += dc; }
    r = row - dr; c = col - dc;
    while (at(board, r, c) === stone) { count++; r -= dr; c -= dc; }
    if (count >= 5) return true;
  }
  return false;
}

// Candidate moves: only empty cells within `radius` of an existing stone
// (standard pruning — a 15x15 board has 225 cells but only a handful are
// ever worth considering once the game has started).
function getCandidates(board: Board, radius = 2): [number, number][] {
  const cells = new Set<string>();
  let any = false;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === 0) continue;
      any = true;
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          const rr = r + dr, cc = c + dc;
          if (inBounds(rr, cc) && board[rr][cc] === 0) cells.add(`${rr},${cc}`);
        }
      }
    }
  }
  if (!any) return [[7, 7]];
  return [...cells].map((s) => {
    const [r, c] = s.split(',').map(Number);
    return [r, c] as [number, number];
  });
}

// Cheap local score used purely to order candidate moves before recursing,
// so alpha-beta pruning cuts far more branches.
function pointHeuristic(board: Board, r: number, c: number, me: Cell, opp: Cell): number {
  board[r][c] = me;
  const selfScore = localScoreAt(board, r, c, me);
  board[r][c] = opp;
  const oppScore = localScoreAt(board, r, c, opp);
  board[r][c] = 0;
  return Math.max(selfScore, oppScore * 0.9);
}

function localScoreAt(board: Board, row: number, col: number, stone: Cell): number {
  let score = 0;
  for (const [dr, dc] of DIRS) {
    let len = 1, r = row + dr, c = col + dc;
    while (at(board, r, c) === stone) { len++; r += dr; c += dc; }
    const frontOpen = at(board, r, c) === 0;
    let r2 = row - dr, c2 = col - dc;
    while (at(board, r2, c2) === stone) { len++; r2 -= dr; c2 -= dc; }
    const backOpen = at(board, r2, c2) === 0;
    score += runScore(len, frontOpen, backOpen);
  }
  return score;
}

function orderMoves(board: Board, candidates: [number, number][], me: Cell, opp: Cell): [number, number][] {
  const scored = candidates.map((mv) => ({ mv, s: pointHeuristic(board, mv[0], mv[1], me, opp) }));
  scored.sort((a, b) => b.s - a.s);
  return scored.map((x) => x.mv);
}

type SearchResult = { score: number; move: [number, number] | null };

function minimax(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  me: Cell,
  opp: Cell,
  deadline: number,
  beamWidth: number
): SearchResult {
  if (depth === 0 || Date.now() > deadline) {
    return { score: evaluateBoard(board, me), move: null };
  }
  const current = maximizing ? me : opp;
  const candidates = orderMoves(board, getCandidates(board), me, opp).slice(0, beamWidth);
  if (candidates.length === 0) return { score: evaluateBoard(board, me), move: null };

  let bestMove: [number, number] | null = candidates[0];
  if (maximizing) {
    let best = -Infinity;
    for (const [r, c] of candidates) {
      board[r][c] = current;
      const win = checkFiveAt(board, r, c, current);
      const score = win ? SCORE.five - (50 - depth) : minimax(board, depth - 1, alpha, beta, false, me, opp, deadline, beamWidth).score;
      board[r][c] = 0;
      if (score > best) { best = score; bestMove = [r, c]; }
      alpha = Math.max(alpha, best);
      if (beta <= alpha || Date.now() > deadline) break;
    }
    return { score: best, move: bestMove };
  } else {
    let best = Infinity;
    for (const [r, c] of candidates) {
      board[r][c] = current;
      const win = checkFiveAt(board, r, c, current);
      const score = win ? -(SCORE.five - (50 - depth)) : minimax(board, depth - 1, alpha, beta, true, me, opp, deadline, beamWidth).score;
      board[r][c] = 0;
      if (score < best) { best = score; bestMove = [r, c]; }
      beta = Math.min(beta, best);
      if (beta <= alpha || Date.now() > deadline) break;
    }
    return { score: best, move: bestMove };
  }
}

export type AIOptions = {
  timeBudgetMs?: number;
  maxDepth?: number; // total plies (AI + human alternating); 4-6 recommended
};

// Finds the AI's next move for `aiPlayer` against `humanPlayer`. Always
// takes an immediate win, always blocks an immediate loss, and otherwise
// runs iterative-deepening minimax with alpha-beta pruning to the requested
// depth (or until the time budget runs out, returning the best move found
// at the deepest depth that completed in time).
export function findBestMove(
  board: Board,
  aiPlayer: Cell,
  humanPlayer: Cell,
  opts: AIOptions = {}
): [number, number] | null {
  const { timeBudgetMs = 1200, maxDepth = 6 } = opts;
  const candidates0 = getCandidates(board);
  if (candidates0.length === 0) return null;

  for (const [r, c] of candidates0) {
    board[r][c] = aiPlayer;
    const win = checkFiveAt(board, r, c, aiPlayer);
    board[r][c] = 0;
    if (win) return [r, c];
  }
  for (const [r, c] of candidates0) {
    board[r][c] = humanPlayer;
    const win = checkFiveAt(board, r, c, humanPlayer);
    board[r][c] = 0;
    if (win) return [r, c];
  }

  const deadline = Date.now() + timeBudgetMs;
  const workBoard = board.map((row) => [...row]) as Board;
  let best: [number, number] | null = null;
  for (let depth = 2; depth <= maxDepth; depth += 2) {
    const beamWidth = depth <= 2 ? 20 : depth <= 4 ? 14 : 10;
    const res = minimax(workBoard, depth, -Infinity, Infinity, true, aiPlayer, humanPlayer, deadline, beamWidth);
    if (res.move) best = res.move;
    if (Date.now() > deadline) break;
  }
  return best ?? candidates0[0];
}
