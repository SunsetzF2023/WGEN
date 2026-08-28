import { useState, useCallback, useEffect } from 'react';
import { useI18n } from '../lib/i18n';

type Cell = {
  value: number;
  isGiven: boolean;
  notes: Set<number>;
};

type Difficulty = 'easy' | 'medium' | 'hard';

const EMPTY_BOARD: Cell[][] = Array.from({ length: 9 }, () =>
  Array.from({ length: 9 }, () => ({ value: 0, isGiven: false, notes: new Set<number>() }))
);

// ─── Sudoku generator ───

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isValid(board: number[][], row: number, col: number, num: number): boolean {
  for (let i = 0; i < 9; i++) {
    if (board[row][i] === num || board[i][col] === num) return false;
  }
  const br = Math.floor(row / 3) * 3;
  const bc = Math.floor(col / 3) * 3;
  for (let r = br; r < br + 3; r++) {
    for (let c = bc; c < bc + 3; c++) {
      if (board[r][c] === num) return false;
    }
  }
  return true;
}

function fillBoard(board: number[][]): boolean {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board[row][col] === 0) {
        const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        for (const num of nums) {
          if (isValid(board, row, col, num)) {
            board[row][col] = num;
            if (fillBoard(board)) return true;
            board[row][col] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

function generatePuzzle(difficulty: Difficulty): { puzzle: number[][]; solution: number[][] } {
  const solution = Array.from({ length: 9 }, () => Array(9).fill(0));
  fillBoard(solution);

  const puzzle = solution.map((r) => [...r]);
  const removeCount = difficulty === 'easy' ? 35 : difficulty === 'medium' ? 45 : 55;

  const positions = shuffle(Array.from({ length: 81 }, (_, i) => i));
  for (let i = 0; i < removeCount; i++) {
    const row = Math.floor(positions[i] / 9);
    const col = positions[i] % 9;
    puzzle[row][col] = 0;
  }

  return { puzzle, solution };
}

function boardToCells(board: number[][]): Cell[][] {
  return board.map((row) =>
    row.map((v) => ({ value: v, isGiven: v !== 0, notes: new Set<number>() }))
  );
}

// ─── Ranked mode types & helpers ───

type GameMode = 'menu' | 'casual' | 'matching' | 'ranked' | 'result' | 'leaderboard';

type MatchRecord = {
  date: number;
  difficulty: Difficulty;
  playerTime: number;
  aiName: string;
  aiTime: number;
  aiAvatar: string;
  win: boolean;
  starsChange: number;
};

type RankTier = {
  name: string;
  icon: string;
  minStars: number;
  color: string;
};

const RANK_TIERS: RankTier[] = [
  { name: 'bronze',   icon: '🥉', minStars: 0,  color: 'text-amber-600' },
  { name: 'silver',   icon: '🥈', minStars: 10, color: 'text-slate-300' },
  { name: 'gold',     icon: '🥇', minStars: 20, color: 'text-yellow-400' },
  { name: 'platinum', icon: '💎', minStars: 30, color: 'text-cyan-300' },
  { name: 'diamond',  icon: '💠', minStars: 40, color: 'text-fuchsia-400' },
];

function getRankTier(stars: number): RankTier {
  let tier = RANK_TIERS[0];
  for (const t of RANK_TIERS) {
    if (stars >= t.minStars) tier = t;
  }
  return tier;
}

function getNextTier(stars: number): RankTier | null {
  for (const t of RANK_TIERS) {
    if (t.minStars > stars) return t;
  }
  return null;
}

const AI_NAMES = [
  ' SudokuMaster', '数独侠客', 'PuzzleKing', '逻辑之神', 'GridWarrior',
  '数字忍者', 'BrainStorm', '九宫格之主', 'NumberCrunch', '推理大师',
  'ZenSudoku', '棋圣传人', 'LogicFlow', '静心解题', 'QuantumMind',
  '纵横交错', 'ClearMind', '静水流深', 'SwiftSolver', '数字猎手',
];

const AI_AVATARS = ['🤖', '👾', '🦾', '🧠', '⚡', '🎯', '🔮', '🎭', '🦊', '🐉'];

function generateAIOpponent(difficulty: Difficulty): { name: string; avatar: string; time: number } {
  const name = AI_NAMES[Math.floor(Math.random() * AI_NAMES.length)];
  const avatar = AI_AVATARS[Math.floor(Math.random() * AI_AVATARS.length)];
  // AI time ranges by difficulty (in seconds)
  const ranges: Record<Difficulty, [number, number]> = {
    easy: [90, 300],
    medium: [180, 600],
    hard: [360, 1200],
  };
  const [min, max] = ranges[difficulty];
  const time = Math.floor(min + Math.random() * (max - min));
  return { name, avatar, time };
}

function loadRankData(): { stars: number; history: MatchRecord[] } {
  try {
    const raw = localStorage.getItem('sudoku_rank');
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { stars: 0, history: [] };
}

function saveRankData(data: { stars: number; history: MatchRecord[] }) {
  try {
    localStorage.setItem('sudoku_rank', JSON.stringify(data));
  } catch { /* ignore */ }
}

// ─── Component ───

export function Sudoku({ onExit }: { onExit: () => void }) {
  const { t } = useI18n();
  const [cells, setCells] = useState<Cell[][]>(EMPTY_BOARD);
  const [solution, setSolution] = useState<number[][]>([]);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [noteMode, setNoteMode] = useState(false);
  const [errors, setErrors] = useState<Set<string>>(new Set());
  const [completed, setCompleted] = useState(false);
  const [timer, setTimer] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);

  // ─── Ranked mode state ───
  const [mode, setMode] = useState<GameMode>('menu');
  const [rankData] = useState(() => loadRankData());
  const [rankStars, setRankStars] = useState(rankData.stars);
  const [matchHistory, setMatchHistory] = useState<MatchRecord[]>(rankData.history);
  const [aiOpponent, setAiOpponent] = useState<{ name: string; avatar: string; time: number } | null>(null);
  const [matchResult, setMatchResult] = useState<{ win: boolean; playerTime: number; aiTime: number; starsChange: number } | null>(null);
  const [matchDifficulty, setMatchDifficulty] = useState<Difficulty>('easy');

  const newGame = useCallback((diff: Difficulty) => {
    const { puzzle, solution: sol } = generatePuzzle(diff);
    setCells(boardToCells(puzzle));
    setSolution(sol);
    setSelected(null);
    setErrors(new Set());
    setCompleted(false);
    setTimer(0);
    setTimerRunning(true);
  }, []);

  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => setTimer((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [timerRunning]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const checkComplete = (board: Cell[][]) => {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c].value === 0) return false;
      }
    }
    // Verify solution
    for (let r = 0; r < 9; r++) {
      const rowSet = new Set<number>();
      const colSet = new Set<number>();
      const boxSet = new Set<number>();
      for (let c = 0; c < 9; c++) {
        rowSet.add(board[r][c].value);
        colSet.add(board[c][r].value);
        const br = Math.floor(r / 3) * 3 + Math.floor(c / 3);
        const bc = (r % 3) * 3 + (c % 3);
        boxSet.add(board[br][bc].value);
      }
      if (rowSet.size !== 9 || colSet.size !== 9 || boxSet.size !== 9) return false;
    }
    return true;
  };

  const handleInput = useCallback((num: number) => {
    if (!selected || completed) return;
    const [row, col] = selected;
    if (cells[row][col].isGiven) return;

    const newCells = cells.map((r) => r.map((c) => ({ ...c, notes: new Set(c.notes) })));

    if (noteMode) {
      if (newCells[row][col].value !== 0) {
        newCells[row][col].value = 0;
      }
      const notes = newCells[row][col].notes;
      if (notes.has(num)) notes.delete(num);
      else notes.add(num);
    } else {
      newCells[row][col].value = num;
      newCells[row][col].notes.clear();

      // Check for errors
      const newErrors = new Set<string>();
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          const v = newCells[r][c].value;
          if (v === 0) continue;
          // Check row/col
          for (let i = 0; i < 9; i++) {
            if (i !== c && newCells[r][i].value === v) {
              newErrors.add(`${r},${c}`);
              break;
            }
            if (i !== r && newCells[i][c].value === v) {
              newErrors.add(`${r},${c}`);
              break;
            }
          }
          // Check box
          const br = Math.floor(r / 3) * 3;
          const bc = Math.floor(c / 3) * 3;
          for (let rr = br; rr < br + 3; rr++) {
            for (let cc = bc; cc < bc + 3; cc++) {
              if (rr !== r && cc !== c && newCells[rr][cc].value === v) {
                newErrors.add(`${r},${c}`);
              }
            }
          }
        }
      }
      setErrors(newErrors);
    }

    setCells(newCells);

    if (checkComplete(newCells)) {
      setCompleted(true);
      setTimerRunning(false);
      setErrors(new Set());

      // Handle ranked mode completion
      if (mode === 'ranked' && aiOpponent) {
        const playerTime = timer;
        const win = playerTime <= aiOpponent.time;
        const starsChange = win ? 2 : -1;
        const newStars = Math.max(0, rankStars + starsChange);
        const record: MatchRecord = {
          date: Date.now(),
          difficulty: matchDifficulty,
          playerTime,
          aiName: aiOpponent.name,
          aiTime: aiOpponent.time,
          aiAvatar: aiOpponent.avatar,
          win,
          starsChange,
        };
        const newHistory = [record, ...matchHistory].slice(0, 50);
        setRankStars(newStars);
        setMatchHistory(newHistory);
        saveRankData({ stars: newStars, history: newHistory });
        setMatchResult({ win, playerTime, aiTime: aiOpponent.time, starsChange });
        setMode('result');
      }
    }
  }, [selected, completed, cells, noteMode, mode, aiOpponent, timer, matchDifficulty, rankStars, matchHistory]);

  const startCasual = (diff: Difficulty) => {
    setDifficulty(diff);
    newGame(diff);
    setMode('casual');
  };

  const startMatching = (diff: Difficulty) => {
    setMatchDifficulty(diff);
    setMode('matching');
    // Simulate matchmaking delay
    setTimeout(() => {
      const ai = generateAIOpponent(diff);
      setAiOpponent(ai);
      setDifficulty(diff);
      newGame(diff);
      setMode('ranked');
    }, 2000 + Math.random() * 2000);
  };

  const handleErase = useCallback(() => {
    if (!selected || completed) return;
    const [row, col] = selected;
    if (cells[row][col].isGiven) return;
    const newCells = cells.map((r) => r.map((c) => ({ ...c, notes: new Set(c.notes) })));
    newCells[row][col].value = 0;
    newCells[row][col].notes.clear();
    setCells(newCells);
    setErrors(new Set());
  }, [selected, completed, cells]);

  const handleHint = () => {
    if (!selected || completed) return;
    const [row, col] = selected;
    if (cells[row][col].isGiven) return;
    const newCells = cells.map((r) => r.map((c) => ({ ...c, notes: new Set(c.notes) })));
    newCells[row][col].value = solution[row][col];
    newCells[row][col].notes.clear();
    setCells(newCells);
    if (checkComplete(newCells)) {
      setCompleted(true);
      setTimerRunning(false);
    }
  };

  // Keyboard input
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (completed) return;
      if (!selected) return;
      const key = e.key;
      if (key >= '1' && key <= '9') {
        handleInput(parseInt(key));
      } else if (key === 'Backspace' || key === 'Delete' || key === '0') {
        handleErase();
      } else if (key === 'ArrowUp' && selected[0] > 0) {
        setSelected([selected[0] - 1, selected[1]]);
      } else if (key === 'ArrowDown' && selected[0] < 8) {
        setSelected([selected[0] + 1, selected[1]]);
      } else if (key === 'ArrowLeft' && selected[1] > 0) {
        setSelected([selected[0], selected[1] - 1]);
      } else if (key === 'ArrowRight' && selected[1] < 8) {
        setSelected([selected[0], selected[1] + 1]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selected, completed, cells, noteMode, solution, handleInput, handleErase]);

  const getRelatedCells = (row: number, col: number): Set<string> => {
    const related = new Set<string>();
    for (let i = 0; i < 9; i++) {
      related.add(`${row},${i}`);
      related.add(`${i},${col}`);
    }
    const br = Math.floor(row / 3) * 3;
    const bc = Math.floor(col / 3) * 3;
    for (let r = br; r < br + 3; r++) {
      for (let c = bc; c < bc + 3; c++) {
        related.add(`${r},${c}`);
      }
    }
    return related;
  };

  const relatedCells = selected ? getRelatedCells(selected[0], selected[1]) : new Set<string>();
  const selectedValue = selected ? cells[selected[0]][selected[1]].value : 0;

  const tier = getRankTier(rankStars);
  const nextTier = getNextTier(rankStars);

  // ─── Menu screen ───
  if (mode === 'menu') {
    return (
      <div className="w-full h-full flex flex-col items-center bg-slate-950 overflow-auto py-4 px-4">
        <div className="w-full max-w-md flex items-center justify-between mb-6">
          <button onClick={onExit} className="text-sm text-slate-400 hover:text-slate-200">
            ← {t('backToApp')}
          </button>
          <h1 className="text-lg font-bold text-slate-200">🔢 {t('sudokuTitle')}</h1>
          <span className="w-16" />
        </div>

        {/* Rank display */}
        <div className="w-full max-w-sm bg-slate-900 rounded-xl border border-slate-700 p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{tier.icon}</span>
              <div>
                <p className={`text-sm font-bold ${tier.color}`}>{t(`sudokuRank_${tier.name}`)}</p>
                <p className="text-xs text-slate-500">⭐ {rankStars} {t('sudokuStars')}</p>
              </div>
            </div>
            {nextTier && (
              <div className="text-right">
                <p className="text-xs text-slate-500">{nextTier.icon} {t(`sudokuRank_${nextTier.name}`)}</p>
                <p className="text-[10px] text-slate-600">{nextTier.minStars - rankStars} ⭐ →</p>
              </div>
            )}
          </div>
          {/* Progress bar */}
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${tier.color.replace('text-', 'bg-')}`}
              style={{
                width: nextTier
                  ? `${((rankStars - tier.minStars) / (nextTier.minStars - tier.minStars)) * 100}%`
                  : '100%',
              }}
            />
          </div>
        </div>

        {/* Mode buttons */}
        <div className="w-full max-w-sm space-y-3">
          <button
            onClick={() => startCasual(difficulty)}
            className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium flex items-center justify-between transition-colors"
          >
            <span>🎮 {t('sudokuCasual')}</span>
            <span className="text-xs text-indigo-200">{t('sudokuCasualDesc')}</span>
          </button>
          <button
            onClick={() => startMatching(difficulty)}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-white font-medium flex items-center justify-between transition-colors"
          >
            <span>⚔️ {t('sudokuRanked')}</span>
            <span className="text-xs text-indigo-200">{t('sudokuRankedDesc')}</span>
          </button>
          <button
            onClick={() => setMode('leaderboard')}
            className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 font-medium flex items-center justify-between transition-colors"
          >
            <span>🏆 {t('sudokuLeaderboard')}</span>
            <span className="text-xs text-slate-500">{matchHistory.length} {t('sudokuMatches')}</span>
          </button>
        </div>

        {/* Difficulty selector for menu */}
        <div className="w-full max-w-sm mt-6">
          <p className="text-xs text-slate-500 mb-2">{t('sudokuSelectDiff')}</p>
          <div className="flex gap-2">
            {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`flex-1 text-xs py-2 rounded-lg transition-colors ${
                  difficulty === d
                    ? 'bg-indigo-600 text-white font-medium'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {t(`sudokuDiff_${d}`)}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Matching screen ───
  if (mode === 'matching') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 px-4">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-pulse">⚔️</div>
          <p className="text-lg font-bold text-slate-200 mb-2">{t('sudokuMatching')}</p>
          <p className="text-sm text-slate-500 mb-6">{t(`sudokuDiff_${matchDifficulty}`)}</p>
          <div className="flex gap-2 justify-center">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-bounce"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
          <p className="text-xs text-slate-600 mt-6">{t('sudokuSearching')}</p>
        </div>
      </div>
    );
  }

  // ─── Match result screen ───
  if (mode === 'result' && matchResult) {
    const win = matchResult.win;
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 px-4">
        <div className="w-full max-w-sm text-center">
          <div className="text-6xl mb-4">{win ? '🎉' : '😅'}</div>
          <p className={`text-2xl font-bold mb-2 ${win ? 'text-yellow-400' : 'text-slate-400'}`}>
            {win ? t('sudokuVictory') : t('sudokuDefeat')}
          </p>
          <p className="text-sm text-slate-500 mb-6">
            {matchResult.starsChange > 0 ? `+${matchResult.starsChange}` : matchResult.starsChange} ⭐
          </p>

          {/* Score comparison */}
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="text-center flex-1">
                <div className="text-2xl mb-1">🧑</div>
                <p className="text-xs text-slate-500 mb-1">{t('sudokuYou')}</p>
                <p className={`text-lg font-bold font-mono ${win ? 'text-yellow-400' : 'text-slate-300'}`}>
                  {formatTime(matchResult.playerTime)}
                </p>
              </div>
              <div className="text-slate-600 text-lg px-2">vs</div>
              <div className="text-center flex-1">
                <div className="text-2xl mb-1">{aiOpponent?.avatar || '🤖'}</div>
                <p className="text-xs text-slate-500 mb-1">{aiOpponent?.name || 'AI'}</p>
                <p className={`text-lg font-bold font-mono ${!win ? 'text-yellow-400' : 'text-slate-300'}`}>
                  {formatTime(matchResult.aiTime)}
                </p>
              </div>
            </div>
            <div className="border-t border-slate-700 pt-3">
              <p className="text-xs text-slate-500">{t('sudokuCurrentRank')}</p>
              <p className={`text-sm font-bold ${tier.color}`}>
                {tier.icon} {t(`sudokuRank_${tier.name}`)} · ⭐ {rankStars}
              </p>
            </div>
          </div>

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => startMatching(matchDifficulty)}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-white text-sm font-medium"
            >
              ⚔️ {t('sudokuPlayAgain')}
            </button>
            <button
              onClick={() => setMode('menu')}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 text-sm font-medium"
            >
              ← {t('sudokuBackMenu')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Leaderboard screen ───
  if (mode === 'leaderboard') {
    const sorted = [...matchHistory].sort((a, b) => a.playerTime - b.playerTime);
    return (
      <div className="w-full h-full flex flex-col items-center bg-slate-950 overflow-auto py-4 px-4">
        <div className="w-full max-w-md flex items-center justify-between mb-4">
          <button onClick={() => setMode('menu')} className="text-sm text-slate-400 hover:text-slate-200">
            ← {t('sudokuBackMenu')}
          </button>
          <h1 className="text-lg font-bold text-slate-200">🏆 {t('sudokuLeaderboard')}</h1>
          <span className="w-16" />
        </div>

        {/* Rank summary */}
        <div className="w-full max-w-md bg-slate-900 rounded-xl border border-slate-700 p-4 mb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{tier.icon}</span>
            <div>
              <p className={`text-sm font-bold ${tier.color}`}>{t(`sudokuRank_${tier.name}`)}</p>
              <p className="text-xs text-slate-500">⭐ {rankStars} {t('sudokuStars')} · {matchHistory.filter(m => m.win).length}W {matchHistory.filter(m => !m.win).length}L</p>
            </div>
          </div>
        </div>

        {/* Match history */}
        {sorted.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-sm text-slate-500">{t('sudokuNoMatches')}</p>
          </div>
        ) : (
          <div className="w-full max-w-md space-y-2">
            <p className="text-xs text-slate-500 mb-2">{t('sudokuBestTimes')}</p>
            {sorted.map((m, i) => (
              <div
                key={m.date}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  m.win
                    ? 'bg-yellow-500/5 border-yellow-500/20'
                    : 'bg-slate-900 border-slate-700'
                }`}
              >
                <span className="text-sm font-bold text-slate-500 w-6">#{i + 1}</span>
                <span className="text-lg">{m.win ? '🏆' : '💀'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-400">
                    {m.aiAvatar} {m.aiName}
                  </p>
                  <p className="text-[10px] text-slate-600">
                    {t(`sudokuDiff_${m.difficulty}`)} · {new Date(m.date).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono font-bold text-slate-200">{formatTime(m.playerTime)}</p>
                  <p className={`text-[10px] ${m.starsChange > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {m.starsChange > 0 ? '+' : ''}{m.starsChange} ⭐
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── Game screen (casual or ranked) ───
  const isRanked = mode === 'ranked';
  return (
    <div className="w-full h-full flex flex-col items-center bg-slate-950 overflow-auto py-4 px-4">
      {/* Header */}
      <div className="w-full max-w-md flex items-center justify-between mb-3">
        <button
          onClick={() => setMode('menu')}
          className="text-sm text-slate-400 hover:text-slate-200"
        >
          ← {t('sudokuBackMenu')}
        </button>
        <h1 className="text-lg font-bold text-slate-200">
          {isRanked ? '⚔️' : '🎮'} {t('sudokuTitle')}
        </h1>
        <span className="text-sm text-slate-400 font-mono">{formatTime(timer)}</span>
      </div>

      {/* Ranked match info bar */}
      {isRanked && aiOpponent && (
        <div className="w-full max-w-md flex items-center justify-between bg-slate-900 rounded-lg border border-slate-700 px-3 py-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🧑</span>
            <div>
              <p className="text-xs text-slate-500">{t('sudokuYou')}</p>
              <p className="text-xs font-mono text-slate-300">{formatTime(timer)}</p>
            </div>
          </div>
          <span className="text-xs text-slate-600">vs</span>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-xs text-slate-500">{aiOpponent.name}</p>
              <p className="text-xs font-mono text-slate-400">{t('sudokuAITime')}: {formatTime(aiOpponent.time)}</p>
            </div>
            <span className="text-lg">{aiOpponent.avatar}</span>
          </div>
        </div>
      )}

      {/* Difficulty selector (casual only) */}
      {!isRanked && (
        <div className="flex gap-2 mb-3">
          {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
            <button
              key={d}
              onClick={() => { setDifficulty(d); newGame(d); }}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                difficulty === d
                  ? 'bg-indigo-600 text-white font-medium'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {t(`sudokuDiff_${d}`)}
            </button>
          ))}
        </div>
      )}

      {/* Sudoku board */}
      <div className="relative">
        <div
          className="grid grid-cols-9 bg-slate-700 rounded-lg overflow-hidden"
          style={{ touchAction: 'manipulation' }}
        >
          {cells.map((row, r) =>
            row.map((cell, c) => {
              const key = `${r},${c}`;
              const isSelected = selected && selected[0] === r && selected[1] === c;
              const isRelated = relatedCells.has(key);
              const isError = errors.has(key);
              const isSameValue = selectedValue !== 0 && cell.value === selectedValue && !isSelected;
              const borderRight = (c + 1) % 3 === 0 && c < 8 ? 'border-r-2 border-r-slate-500' : 'border-r border-r-slate-700/50';
              const borderBottom = (r + 1) % 3 === 0 && r < 8 ? 'border-b-2 border-b-slate-500' : 'border-b border-b-slate-700/50';

              return (
                <button
                  key={key}
                  onClick={() => setSelected([r, c])}
                  className={`w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center text-lg font-medium transition-colors ${borderRight} ${borderBottom} ${
                    isSelected
                      ? 'bg-indigo-600/40'
                      : isSameValue
                      ? 'bg-indigo-500/15'
                      : isRelated
                      ? 'bg-slate-700/50'
                      : 'bg-slate-800'
                  } ${cell.isGiven ? 'text-slate-100' : isError ? 'text-red-400' : 'text-indigo-300'}`}
                >
                  {cell.value !== 0 ? cell.value : cell.notes.size > 0 ? (
                    <div className="grid grid-cols-3 gap-0 w-full h-full p-0.5">
                      {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
                        <span key={n} className="text-[7px] sm:text-[8px] text-slate-500 flex items-center justify-center">
                          {cell.notes.has(n) ? n : ''}
                        </span>
                      ))}
                    </div>
                  ) : ''}
                </button>
              );
            })
          )}
        </div>

        {/* Win overlay (casual only — ranked goes to result screen) */}
        {completed && !isRanked && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 rounded-lg">
            <div className="text-center">
              <div className="text-4xl mb-2">🎉</div>
              <p className="text-lg font-bold text-slate-100 mb-1">{t('sudokuComplete')}</p>
              <p className="text-sm text-slate-400 mb-4">{formatTime(timer)}</p>
              <button
                onClick={() => newGame(difficulty)}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium"
              >
                {t('sudokuNewGame')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Number pad */}
      <div className="flex gap-1.5 mt-4">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button
            key={n}
            onClick={() => handleInput(n)}
            disabled={completed}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-lg font-medium disabled:opacity-30 transition-colors"
          >
            {n}
          </button>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => setNoteMode(!noteMode)}
          className={`text-xs px-3 py-2 rounded-lg border transition-colors ${
            noteMode
              ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300 font-medium'
              : 'border-slate-600 bg-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          ✏️ {t('sudokuNotes')}
        </button>
        <button
          onClick={handleErase}
          disabled={completed}
          className="text-xs px-3 py-2 rounded-lg border border-slate-600 bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-colors"
        >
          🧹 {t('sudokuErase')}
        </button>
        <button
          onClick={handleHint}
          disabled={completed}
          className="text-xs px-3 py-2 rounded-lg border border-slate-600 bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-colors"
        >
          💡 {t('sudokuHint')}
        </button>
        {!isRanked && (
          <button
            onClick={() => newGame(difficulty)}
            className="text-xs px-3 py-2 rounded-lg border border-slate-600 bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            🔄 {t('sudokuNewGame')}
          </button>
        )}
      </div>

      <p className="text-xs text-slate-600 mt-3 text-center max-w-md">
        {t('sudokuHelp')}
      </p>
    </div>
  );
}
