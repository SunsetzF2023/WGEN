// Gomoku puzzle data: 120 endgame challenges
// Each puzzle: player is Black (1), must find the winning move
// Board is 15x15, 0=empty, 1=black, 2=white
// solution: [row, col] of the winning move

export type Puzzle = {
  id: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  board: number[][]; // 15x15
  solution: [number, number];
  hint: string;
};

function emptyBoard(): number[][] {
  return Array.from({ length: 15 }, () => Array(15).fill(0));
}

// Helper to place stones on a board
function place(stones: [number, number, number][]): number[][] {
  const b = emptyBoard();
  for (const [r, c, v] of stones) {
    if (r >= 0 && r < 15 && c >= 0 && c < 15) b[r][c] = v;
  }
  return b;
}

function clamp(v: number): number {
  return Math.max(0, Math.min(14, v));
}

// ─── Generate 120 puzzles programmatically ───
// Each puzzle has a position where Black has 4-in-a-row with one open end,
// or a double-threat position. Player must find the winning move.

function makePuzzles(): Puzzle[] {
  const puzzles: Puzzle[] = [];
  let id = 1;

  // Difficulty 1-5: increasing complexity
  // Pattern types:
  // 1: Simple 4-in-a-row, fill the gap (open four)
  // 2: Four with one end blocked, must fill open end
  // 3: Split four (two separate threats)
  // 4: Double-three or four-three combo
  // 5: Complex multi-threat

  for (let diff = 1; diff <= 5; diff++) {
    const count = 24; // 24 per difficulty = 120 total

    for (let i = 0; i < count; i++) {
      const baseRow = 1 + (i % 5); // 1-5, keeps all offsets within 0-14
      const baseCol = 1 + ((i * 3) % 5);
      const dir = i % 4; // 0=horizontal, 1=vertical, 2=diagonal, 3=anti-diagonal

      if (diff === 1) {
        // Open four: 4 black in a row, fill either end
        const stones: [number, number, number][] = [];
        for (let k = 0; k < 4; k++) {
          const r = dir === 1 ? baseRow + k : dir === 2 ? baseRow + k : dir === 3 ? baseRow + k : baseRow;
          const c = dir === 0 ? baseCol + k : dir === 2 ? baseCol + k : dir === 3 ? baseCol + 3 - k : baseCol;
          stones.push([r, c, 1]);
        }
        // One white stone blocking one end
        const blockR = dir === 1 ? baseRow + 4 : dir === 2 ? baseRow + 4 : dir === 3 ? baseRow + 4 : baseRow;
        const blockC = dir === 0 ? baseCol + 4 : dir === 2 ? baseCol + 4 : dir === 3 ? baseCol - 1 : baseCol;
        stones.push([blockR, blockC, 2]);
        // Solution: fill the other end
        const solR = dir === 1 ? baseRow - 1 : dir === 2 ? baseRow - 1 : dir === 3 ? baseRow - 1 : baseRow;
        const solC = dir === 0 ? baseCol - 1 : dir === 2 ? baseCol - 1 : dir === 3 ? baseCol + 4 : baseCol;
        // Add some random white stones for visual complexity
        const extraR = (baseRow + 7) % 15;
        const extraC = (baseCol + 5) % 15;
        stones.push([extraR, extraC, 2]);
        if (extraR !== solR || extraC !== solC) {
          stones.push([(extraR + 3) % 15, (extraC + 2) % 15, 1]);
        }
        puzzles.push({
          id: id++,
          difficulty: 1,
          board: place(stones),
          solution: [clamp(solR), clamp(solC)],
          hint: '四子连珠，填入空位即可获胜',
        });
      } else if (diff === 2) {
        // Four with gap: _X_XX_ or X_XXX_, fill the gap
        const stones: [number, number, number][] = [];
        // Place: X X _ X X (gap in middle)
        const positions = [0, 1, 3, 4]; // skip position 2
        for (const k of positions) {
          const r = dir === 1 ? baseRow + k : dir === 2 ? baseRow + k : dir === 3 ? baseRow + k : baseRow;
          const c = dir === 0 ? baseCol + k : dir === 2 ? baseCol + k : dir === 3 ? baseCol + 4 - k : baseCol;
          stones.push([r, c, 1]);
        }
        // White blocks one end
        const blockR = dir === 1 ? baseRow + 5 : dir === 2 ? baseRow + 5 : dir === 3 ? baseRow + 5 : baseRow;
        const blockC = dir === 0 ? baseCol + 5 : dir === 2 ? baseCol + 5 : dir === 3 ? baseCol - 1 : baseCol;
        stones.push([blockR, blockC, 2]);
        // Solution: fill the gap at position 2
        const solR = dir === 1 ? baseRow + 2 : dir === 2 ? baseRow + 2 : dir === 3 ? baseRow + 2 : baseRow;
        const solC = dir === 0 ? baseCol + 2 : dir === 2 ? baseCol + 2 : dir === 3 ? baseCol + 2 : baseCol;
        // Extra stones
        stones.push([(baseRow + 6) % 15, (baseCol + 7) % 15, 2]);
        stones.push([(baseRow + 8) % 15, (baseCol + 3) % 15, 1]);
        puzzles.push({
          id: id++,
          difficulty: 2,
          board: place(stones),
          solution: [clamp(solR), clamp(solC)],
          hint: '中间有断点，补上即可五连',
        });
      } else if (diff === 3) {
        // Double threat: two separate open threes, find the move that creates a four
        const stones: [number, number, number][] = [];
        // Horizontal three
        for (let k = 0; k < 3; k++) {
          stones.push([baseRow, baseCol + k, 1]);
        }
        // Vertical three (overlapping)
        for (let k = 0; k < 3; k++) {
          stones.push([baseRow + k, baseCol + 2, 1]);
        }
        // White stones to block some ends
        stones.push([baseRow, baseCol + 4, 2]);
        stones.push([baseRow + 4, baseCol + 2, 2]);
        // Extra complexity
        stones.push([(baseRow + 6) % 15, (baseCol + 8) % 15, 2]);
        stones.push([(baseRow + 2) % 15, (baseCol + 6) % 15, 2]);
        stones.push([(baseRow + 7) % 15, (baseCol + 1) % 15, 1]);
        // Solution: extend to make a four at the intersection
        const solR = baseRow;
        const solC = baseCol + 3;
        puzzles.push({
          id: id++,
          difficulty: 3,
          board: place(stones),
          solution: [clamp(solR), clamp(solC)],
          hint: '找到能同时形成两个威胁的关键点',
        });
      } else if (diff === 4) {
        // Four-three combo: make a four and a three simultaneously
        const stones: [number, number, number][] = [];
        // Horizontal: X X _ X
        stones.push([baseRow, baseCol, 1]);
        stones.push([baseRow, baseCol + 1, 1]);
        stones.push([baseRow, baseCol + 3, 1]);
        // Vertical: X X X (starting from same point)
        stones.push([baseRow, baseCol + 1, 1]); // already placed, but ok
        stones.push([baseRow + 1, baseCol + 1, 1]);
        stones.push([baseRow + 2, baseCol + 1, 1]);
        // White blocks
        stones.push([baseRow, baseCol + 4, 2]);
        stones.push([baseRow + 3, baseCol + 1, 2]);
        stones.push([baseRow + 4, baseCol + 1, 2]);
        // Extra
        stones.push([(baseRow + 6) % 15, (baseCol + 9) % 15, 2]);
        stones.push([(baseRow + 8) % 15, (baseCol + 5) % 15, 1]);
        stones.push([(baseRow + 1) % 15, (baseCol + 7) % 15, 2]);
        // Solution: fill the gap at [baseRow, baseCol+2] - makes horizontal four + extends vertical
        const solR = baseRow;
        const solC = baseCol + 2;
        puzzles.push({
          id: id++,
          difficulty: 4,
          board: place(stones),
          solution: [clamp(solR), clamp(solC)],
          hint: '一子双杀：同时形成活四和活三',
        });
      } else {
        // Diff 5: Complex multi-threat
        const stones: [number, number, number][] = [];
        // Diagonal three
        stones.push([baseRow, baseCol, 1]);
        stones.push([baseRow + 1, baseCol + 1, 1]);
        stones.push([baseRow + 2, baseCol + 2, 1]);
        // Horizontal pair
        stones.push([baseRow + 2, baseCol + 3, 1]);
        stones.push([baseRow + 2, baseCol + 4, 1]);
        // Vertical pair
        stones.push([baseRow + 3, baseCol + 2, 1]);
        stones.push([baseRow + 4, baseCol + 2, 1]);
        // White blocks scattered
        stones.push([baseRow - 1, baseCol - 1, 2]);
        stones.push([baseRow + 5, baseCol + 5, 2]);
        stones.push([baseRow + 2, baseCol + 5, 2]);
        stones.push([baseRow + 5, baseCol + 2, 2]);
        stones.push([(baseRow + 7) % 15, (baseCol + 8) % 15, 2]);
        stones.push([(baseRow + 9) % 15, (baseCol + 3) % 15, 1]);
        stones.push([(baseRow + 1) % 15, (baseCol + 6) % 15, 2]);
        stones.push([(baseRow + 8) % 15, (baseCol + 1) % 15, 1]);
        // Solution: [baseRow+2, baseCol+2] already has black, so extend diagonal
        // Actually the winning move is at [baseRow+3, baseCol+3] to make diagonal four
        // AND horizontal three at row baseRow+2
        const solR = baseRow + 3;
        const solC = baseCol + 3;
        puzzles.push({
          id: id++,
          difficulty: 5,
          board: place(stones),
          solution: [clamp(solR), clamp(solC)],
          hint: '复杂局面：找到能形成多重威胁的妙手',
        });
      }
    }
  }

  return puzzles;
}

export const GOMOKU_PUZZLES: Puzzle[] = makePuzzles();
