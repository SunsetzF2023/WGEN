// Gomoku puzzle data: real self-play positions, not hand-authored tactics.
//
// Every puzzle board here was produced by scripts/gen-gomoku-puzzles.mjs,
// which (1) plays many randomized self-play games with the same minimax
// engine used as the in-app opponent (src/lib/gomokuAI.ts), and (2) at
// sampled Black-to-move positions, runs an independent deep search to
// PROVE Black has a forced win from that exact position — a real minimax
// search finding an actual line to five-in-a-row against best defense, not
// a single coordinate an author picked in advance. There is no baked
// "solution" field: any move that keeps Black on a forced-win line is
// correct, multiple different winning continuations can exist, and the
// game is played out for real against the same engine (see handlePuzzleClick
// in Gomoku.tsx) until an actual five-in-a-row — or, if the player strays
// off the forced line, a draw or a loss are both genuinely possible
// outcomes, exactly like a real game record.
//
// difficulty (1-5) = how many plies of forced play the verification search
// needed before it could prove the win (deeper combos are harder to spot).

import rawPuzzles from './gomokuPuzzleData.json';

export type Puzzle = {
  id: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  board: number[][]; // 15x15
};

export const GOMOKU_PUZZLES: Puzzle[] = rawPuzzles as Puzzle[];
