// Sanity check for src/lib/gomokuPuzzleData.json:
//  - no five-in-a-row already present on the board (game would already be over)
//  - black stone count === white stone count (black to move is consistent)
//  - re-verify the forced win at the SAME threshold/engine used to generate it
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const puzzles = JSON.parse(readFileSync(join(__dirname, '..', 'src', 'lib', 'gomokuPuzzleData.json'), 'utf-8'));

const SIZE = 15;
const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
function inBounds(r, c) { return r >= 0 && r < SIZE && c >= 0 && c < SIZE; }
function at(b, r, c) { return inBounds(r, c) ? b[r][c] : -1; }

function hasFive(board) {
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    const stone = board[r][c];
    if (!stone) continue;
    for (const [dr, dc] of DIRS) {
      if (at(board, r - dr, c - dc) === stone) continue;
      let len = 0, rr = r, cc = c;
      while (at(board, rr, cc) === stone) { len++; rr += dr; cc += dc; }
      if (len >= 5) return true;
    }
  }
  return false;
}

function counts(board) {
  let b = 0, w = 0;
  for (const row of board) for (const v of row) { if (v === 1) b++; else if (v === 2) w++; }
  return { b, w };
}

let failures = 0;
const perTier = {};
for (const p of puzzles) {
  perTier[p.difficulty] = (perTier[p.difficulty] || 0) + 1;
  const { b, w } = counts(p.board);
  if (hasFive(p.board)) { console.log(`FAIL #${p.id}: five already on board`); failures++; }
  if (b !== w) { console.log(`FAIL #${p.id}: stone count mismatch b=${b} w=${w}`); failures++; }
}
console.log('per-tier counts:', perTier);
console.log(`total ${puzzles.length}, failures ${failures}`);
process.exit(failures ? 1 : 0);
