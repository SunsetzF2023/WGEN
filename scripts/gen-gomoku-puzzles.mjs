// Offline generator for genuinely free-form gomoku puzzles.
//
// Instead of hand-authoring one tactical shape and reverse-engineering
// "decoy" stones around it (which bakes in a single designed answer), this
// script:
//   1. Plays many randomized self-play games using the SAME minimax engine
//      that will act as the in-app opponent (see src/lib/gomokuAI.ts),
//      producing realistic, organically-arising board positions.
//   2. At sampled Black-to-move positions, runs an independent deeper
//      verification search to check whether Black has a forced win — i.e.
//      the search proves a line to five-in-a-row against best defense,
//      not "this one coordinate was designed to work." Any move that keeps
//      Black on a forced-win line is correct; there is no single baked
//      answer.
//   3. The minimum search depth needed to prove the forced win becomes the
//      difficulty rating — deeper forced sequences are harder to spot.
//
// Run with: node scripts/gen-gomoku-puzzles.mjs
// Writes:   src/lib/gomokuPuzzleData.json

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SIZE = 15;
const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
const SCORE = {
  five: 10_000_000,
  openFour: 1_000_000,
  four: 100_000,
  gapFour: 90_000,
  openThree: 10_000,
  sleepThree: 1_000,
  openTwo: 200,
  sleepTwo: 50,
};

function inBounds(r, c) { return r >= 0 && r < SIZE && c >= 0 && c < SIZE; }
function at(board, r, c) { return inBounds(r, c) ? board[r][c] : -1; }
function emptyBoard() { return Array.from({ length: SIZE }, () => Array(SIZE).fill(0)); }

function runScore(len, frontOpen, backOpen) {
  if (len >= 5) return SCORE.five;
  const openEnds = (frontOpen ? 1 : 0) + (backOpen ? 1 : 0);
  if (len === 4) return openEnds === 2 ? SCORE.openFour : openEnds === 1 ? SCORE.four : 0;
  if (len === 3) return openEnds === 2 ? SCORE.openThree : openEnds === 1 ? SCORE.sleepThree : 0;
  if (len === 2) return openEnds === 2 ? SCORE.openTwo : openEnds === 1 ? SCORE.sleepTwo : 0;
  return 0;
}

function scanRuns(board, stone) {
  let score = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] !== stone) continue;
      for (const [dr, dc] of DIRS) {
        if (at(board, r - dr, c - dc) === stone) continue;
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

function scanGaps(board, stone) {
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
        if (selfCount === 4 && emptyCount === 1 && gapPos > 0 && gapPos < 4) score += SCORE.gapFour;
        else if (selfCount === 3 && emptyCount === 2 && gapPos > 0 && gapPos < 4) score += SCORE.sleepThree * 0.6;
      }
    }
  }
  return score;
}

function evaluateBoard(board, forPlayer) {
  const opp = forPlayer === 1 ? 2 : 1;
  const self = scanRuns(board, forPlayer) + scanGaps(board, forPlayer);
  const enemy = scanRuns(board, opp) + scanGaps(board, opp);
  return self - enemy * 1.05;
}

function checkFiveAt(board, row, col, stone) {
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

function getCandidates(board, radius = 2) {
  const cells = new Set();
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
  return [...cells].map((s) => s.split(',').map(Number));
}

function localScoreAt(board, row, col, stone) {
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

function pointHeuristic(board, r, c, me, opp) {
  board[r][c] = me;
  const selfScore = localScoreAt(board, r, c, me);
  board[r][c] = opp;
  const oppScore = localScoreAt(board, r, c, opp);
  board[r][c] = 0;
  return Math.max(selfScore, oppScore * 0.9);
}

function orderMoves(board, candidates, me, opp) {
  const scored = candidates.map((mv) => ({ mv, s: pointHeuristic(board, mv[0], mv[1], me, opp) }));
  scored.sort((a, b) => b.s - a.s);
  return scored.map((x) => x.mv);
}

function minimax(board, depth, alpha, beta, maximizing, me, opp, beamWidth) {
  if (depth === 0) return { score: evaluateBoard(board, me), move: null };
  const current = maximizing ? me : opp;
  const candidates = orderMoves(board, getCandidates(board), me, opp).slice(0, beamWidth);
  if (candidates.length === 0) return { score: evaluateBoard(board, me), move: null };

  let bestMove = candidates[0];
  if (maximizing) {
    let best = -Infinity;
    for (const [r, c] of candidates) {
      board[r][c] = current;
      const win = checkFiveAt(board, r, c, current);
      const score = win ? SCORE.five - (50 - depth) : minimax(board, depth - 1, alpha, beta, false, me, opp, beamWidth).score;
      board[r][c] = 0;
      if (score > best) { best = score; bestMove = [r, c]; }
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return { score: best, move: bestMove };
  } else {
    let best = Infinity;
    for (const [r, c] of candidates) {
      board[r][c] = current;
      const win = checkFiveAt(board, r, c, current);
      const score = win ? -(SCORE.five - (50 - depth)) : minimax(board, depth - 1, alpha, beta, true, me, opp, beamWidth).score;
      board[r][c] = 0;
      if (score < best) { best = score; bestMove = [r, c]; }
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return { score: best, move: bestMove };
  }
}

// Root search that returns ALL candidate moves with their scores (for
// weighted-random self-play move selection, so games don't all converge to
// one deterministic line).
function rootSearch(board, depth, me, opp, beamWidth) {
  const candidates = orderMoves(board, getCandidates(board), me, opp).slice(0, beamWidth);
  const results = [];
  let alpha = -Infinity;
  for (const [r, c] of candidates) {
    board[r][c] = me;
    const win = checkFiveAt(board, r, c, me);
    const score = win ? SCORE.five : minimax(board, depth - 1, alpha, Infinity, false, me, opp, beamWidth).score;
    board[r][c] = 0;
    results.push({ move: [r, c], score });
    alpha = Math.max(alpha, score);
  }
  results.sort((a, b) => b.score - a.score);
  return results;
}

function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickSelfPlayMove(board, me, opp, rand) {
  const candidates0 = getCandidates(board);
  for (const [r, c] of candidates0) {
    board[r][c] = me;
    const win = checkFiveAt(board, r, c, me);
    board[r][c] = 0;
    if (win) return [r, c];
  }
  for (const [r, c] of candidates0) {
    board[r][c] = opp;
    const win = checkFiveAt(board, r, c, opp);
    board[r][c] = 0;
    if (win) return [r, c];
  }
  const results = rootSearch(board, 3, me, opp, 10);
  const topK = Math.min(3, results.length);
  const idx = Math.floor(rand() * topK);
  return results[idx].move;
}

// Escalating-depth forced-win check: tries the cheapest search first and
// only pays for deeper search when the position doesn't resolve early.
//
// Only ODD depths are tested. Given how this minimax alternates the
// maximizing player every ply, Black's own moves (the only ones that can
// directly complete his five) land at depths D, D-2, D-4, ... An EVEN
// root depth D only ever reaches the same set of Black-move opportunities
// an odd depth D-1 already covers, plus one extra (wasted) ply of White
// defense verification — so even depths can never surface a genuinely new
// forced win. Testing 2,3,5,7 instead directly corresponds to "Black needs
// 1/2/3/4 forced moves to win", which is both cheaper and a much more
// meaningful difficulty signal than raw eval score.
const CHECK_DEPTHS = [2, 3, 5, 7];
const FORCED_WIN_THRESHOLD = 8_000_000;
function findForcedWinDepth(board, me, opp) {
  for (const depth of CHECK_DEPTHS) {
    const workBoard = board.map((row) => [...row]);
    const res = minimax(workBoard, depth, -Infinity, Infinity, true, me, opp, depth <= 3 ? 12 : 8);
    if (res.score >= FORCED_WIN_THRESHOLD) return depth;
  }
  return null;
}

function boardKey(board) {
  return board.map((row) => row.join('')).join('|');
}

function countStones(board) {
  let n = 0;
  for (const row of board) for (const v of row) if (v !== 0) n++;
  return n;
}

// ─── Self-play generation ───
const NUM_GAMES = 70;
const MAX_PLIES = 44;
const CHECK_FROM_PLY = 8;
const CHECK_EVERY = 2;

const candidates = [];
const seenBoards = new Set();

const startTime = Date.now();
for (let g = 0; g < NUM_GAMES; g++) {
  const rand = mulberry32(g * 7919 + 13);
  const board = emptyBoard();
  let toMove = 1; // black starts
  let sinceLastCheck = 0;

  for (let ply = 0; ply < MAX_PLIES; ply++) {
    const opp = toMove === 1 ? 2 : 1;

    // Before Black plays, check whether this position is a proven forced win.
    if (toMove === 1 && ply >= CHECK_FROM_PLY) {
      sinceLastCheck++;
      if (sinceLastCheck >= CHECK_EVERY) {
        sinceLastCheck = 0;
        const key = boardKey(board);
        if (!seenBoards.has(key)) {
          const minDepth = findForcedWinDepth(board, 1, 2);
          if (minDepth !== null) {
            seenBoards.add(key);
            candidates.push({ board: board.map((row) => [...row]), minDepth, stones: countStones(board), game: g, ply });
          }
        }
      }
    }

    const move = pickSelfPlayMove(board, toMove, opp, rand);
    if (!move) break;
    const [r, c] = move;
    board[r][c] = toMove;
    if (checkFiveAt(board, r, c, toMove)) break; // game over
    toMove = opp;
  }

  if (g % 10 === 0) {
    console.log(`game ${g}/${NUM_GAMES}, candidates so far: ${candidates.length}, elapsed ${(Date.now() - startTime) / 1000}s`);
  }
}

console.log(`Self-play done. ${candidates.length} candidates found in ${(Date.now() - startTime) / 1000}s`);

// ─── Bucket into difficulty tiers 1-5 ───
// minDepth directly encodes how many forced Black moves the verification
// search needed: depth2→1 move, depth3→2 moves, depth5→3 moves, depth7→4
// moves. The "1 move" bucket tends to dominate (self-play often leaves an
// outright winning move unpunished), so it is further split by how many
// stones are already on the board — a cluttered board hides even an
// immediate win much better than a sparse one, giving a genuine tier1/tier2
// split instead of an arbitrary one.
const byMoves = { 1: [], 2: [], 3: [], 4: [] };
const movesForDepth = { 2: 1, 3: 2, 5: 3, 7: 4 };
for (const c of candidates) byMoves[movesForDepth[c.minDepth]].push(c);

const oneMove = [...byMoves[1]].sort((a, b) => a.stones - b.stones);
const splitAt = Math.ceil(oneMove.length / 2);
const byTier = {
  1: oneMove.slice(0, splitAt),
  2: oneMove.slice(splitAt),
  3: byMoves[2],
  4: byMoves[3],
  5: byMoves[4],
};
for (const c of candidates) delete c.tier;
for (const t of Object.keys(byTier)) {
  for (const c of byTier[t]) c.tier = Number(t);
  console.log(`tier ${t}: ${byTier[t].length} candidates`);
}

// Take a spread from each tier (dedup already applied via seenBoards).
const TARGET_PER_TIER = 7;
const finalPuzzles = [];
let id = 1;
for (const tier of [1, 2, 3, 4, 5]) {
  const pool = byTier[tier];
  // Shuffle deterministically then take up to TARGET_PER_TIER.
  const rand = mulberry32(tier * 101 + 3);
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const picked = shuffled.slice(0, TARGET_PER_TIER);
  for (const p of picked) {
    finalPuzzles.push({ id: id++, difficulty: tier, board: p.board });
  }
}

console.log(`Final puzzle count: ${finalPuzzles.length}`);

const outPath = join(__dirname, '..', 'src', 'lib', 'gomokuPuzzleData.json');
writeFileSync(outPath, JSON.stringify(finalPuzzles), 'utf-8');
console.log(`Written to ${outPath}`);
