import { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { GOMOKU_PUZZLES, type Puzzle } from '../lib/gomokuPuzzles';
import { findBestMove } from '../lib/gomokuAI';

const BOARD_SIZE = 15;
type Stone = 0 | 1 | 2; // 0=empty, 1=black, 2=white
type GameMode = 'menu' | 'puzzles' | 'puzzle-game' | 'local' | 'online-menu' | 'online-create' | 'online-join' | 'online-game';
type PvPState = {
  roomCode: string;
  isHost: boolean;
  myColor: Stone; // 1=black, 2=white
  opponentName: string;
  opponentReady: boolean;
  roundIndex: number; // increments each rematch; color is derived from this, not toggled
};

// Derived (not toggled) so it's idempotent no matter how restart messages are
// ordered or duplicated: round 0 = host black, round 1 = host white, etc.
function colorForRound(isHost: boolean, roundIndex: number): Stone {
  const hostIsBlack = roundIndex % 2 === 0;
  return hostIsBlack === isHost ? 1 : 2;
}

function emptyBoard(): Stone[][] {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0) as Stone[]);
}

function checkWin(board: Stone[][], row: number, col: number): boolean {
  const stone = board[row][col];
  if (stone === 0) return false;
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const [dr, dc] of dirs) {
    let count = 1;
    for (let i = 1; i < 5; i++) {
      const r = row + dr * i, c = col + dc * i;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE || board[r][c] !== stone) break;
      count++;
    }
    for (let i = 1; i < 5; i++) {
      const r = row - dr * i, c = col - dc * i;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE || board[r][c] !== stone) break;
      count++;
    }
    if (count >= 5) return true;
  }
  return false;
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export function Gomoku({ onExit }: { onExit: () => void }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<GameMode>('menu');
  const [board, setBoard] = useState<Stone[][]>(emptyBoard());
  const [currentPlayer, setCurrentPlayer] = useState<Stone>(1);
  const [winner, setWinner] = useState<Stone | null>(null);
  const [winLine, setWinLine] = useState<[number, number][] | null>(null);
  const [lastMove, setLastMove] = useState<[number, number] | null>(null);
  const [moveHistory, setMoveHistory] = useState<[number, number][]>([]);

  // Puzzle state
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [puzzleSolved, setPuzzleSolved] = useState(false);
  const [puzzleDraw, setPuzzleDraw] = useState(false);
  const [solvedPuzzles, setSolvedPuzzles] = useState<Set<number>>(() => {
    try {
      const raw = localStorage.getItem('gomoku_solved');
      if (raw) return new Set(JSON.parse(raw));
    } catch { /* ignore */ }
    return new Set();
  });
  const [aiThinking, setAiThinking] = useState(false);
  const [puzzleFailed, setPuzzleFailed] = useState(false);
  const [hintMove, setHintMove] = useState<[number, number] | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const currentPuzzle: Puzzle | null = GOMOKU_PUZZLES[puzzleIndex] || null;

  // PvP state
  const [pvp, setPvp] = useState<PvPState | null>(null);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [pvpWaiting, setPvpWaiting] = useState(false);
  const [pvpError, setPvpError] = useState('');
  const [opponentMove, setOpponentMove] = useState<[number, number] | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const saveSolved = useCallback((solved: Set<number>) => {
    try {
      localStorage.setItem('gomoku_solved', JSON.stringify([...solved]));
    } catch { /* ignore */ }
  }, []);

  const resetGame = useCallback(() => {
    setBoard(emptyBoard());
    setCurrentPlayer(1);
    setWinner(null);
    setWinLine(null);
    setLastMove(null);
    setMoveHistory([]);
    setOpponentMove(null);
  }, []);

  const findWinLine = (b: Stone[][], row: number, col: number): [number, number][] => {
    const stone = b[row][col];
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (const [dr, dc] of dirs) {
      const line: [number, number][] = [[row, col]];
      for (let i = 1; i < 5; i++) {
        const r = row + dr * i, c = col + dc * i;
        if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE || b[r][c] !== stone) break;
        line.push([r, c]);
      }
      for (let i = 1; i < 5; i++) {
        const r = row - dr * i, c = col - dc * i;
        if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE || b[r][c] !== stone) break;
        line.unshift([r, c]);
      }
      if (line.length >= 5) return line.slice(0, 5);
    }
    return [];
  };

  // ─── Puzzle mode ───
  const startPuzzle = useCallback((index: number) => {
    const p = GOMOKU_PUZZLES[index];
    if (!p) return;
    setPuzzleIndex(index);
    setBoard(p.board.map(r => [...r]) as Stone[][]);
    setCurrentPlayer(1); // player is always black in puzzles
    setWinner(null);
    setWinLine(null);
    setLastMove(null);
    setMoveHistory([]);
    setPuzzleSolved(false);
    setPuzzleDraw(false);
    setPuzzleFailed(false);
    setAiThinking(false);
    setHintMove(null);
    setMode('puzzle-game');
  }, []);

  const isBoardFull = (b: Stone[][]) => b.every(row => row.every(cell => cell !== 0));

  const handlePuzzleClick = (row: number, col: number) => {
    if (winner || puzzleSolved || puzzleDraw || puzzleFailed || aiThinking) return;
    if (board[row][col] !== 0) return;

    const p = currentPuzzle;
    if (!p) return;
    setHintMove(null);

    // Free play: any empty cell is a legal move. There is no designated
    // "solution" — the player is free to try any idea, and only what
    // actually happens on the board (a real 5-in-a-row, a real loss, or a
    // full board) decides the outcome, exactly like a real game record.
    const afterBlack = board.map(r => [...r]) as Stone[][];
    afterBlack[row][col] = 1;
    setBoard(afterBlack);
    setLastMove([row, col]);

    if (checkWin(afterBlack, row, col)) {
      setWinner(1);
      setWinLine(findWinLine(afterBlack, row, col));
      setPuzzleSolved(true);
      const newSolved = new Set(solvedPuzzles);
      newSolved.add(p.id);
      setSolvedPuzzles(newSolved);
      saveSolved(newSolved);
      return;
    }
    if (isBoardFull(afterBlack)) {
      setPuzzleDraw(true);
      return;
    }

    // White's turn: let the real minimax/alpha-beta engine respond — the
    // exact same engine used to verify the puzzle offline, so if the player
    // strays off a genuine forced-win line, this opponent can and will
    // punish it for a real loss, not a scripted one.
    setAiThinking(true);
    setTimeout(() => {
      const move = findBestMove(afterBlack, 2, 1, { timeBudgetMs: 1000, maxDepth: 6 });
      if (!move) { setAiThinking(false); return; }
      const [ar, ac] = move;
      const afterWhite = afterBlack.map(r => [...r]) as Stone[][];
      afterWhite[ar][ac] = 2;
      setBoard(afterWhite);
      setLastMove([ar, ac]);
      setAiThinking(false);
      if (checkWin(afterWhite, ar, ac)) {
        setWinner(2);
        setWinLine(findWinLine(afterWhite, ar, ac));
        setPuzzleFailed(true);
        return;
      }
      if (isBoardFull(afterWhite)) {
        setPuzzleDraw(true);
      }
    }, 30);
  };

  // Live "求助": ask the real engine what IT would play here, rather than
  // revealing a pre-baked answer — since there is no single correct answer,
  // this is only a suggestion the player is free to ignore.
  const requestHint = () => {
    if (winner || puzzleSolved || puzzleDraw || puzzleFailed || aiThinking || hintLoading) return;
    setHintLoading(true);
    setTimeout(() => {
      const move = findBestMove(board, 1, 2, { timeBudgetMs: 600, maxDepth: 4 });
      setHintMove(move);
      setHintLoading(false);
    }, 20);
  };

  // ─── Local PvP ───
  const handleLocalClick = (row: number, col: number) => {
    if (winner || board[row][col] !== 0) return;
    const newBoard = board.map(r => [...r]) as Stone[][];
    newBoard[row][col] = currentPlayer;
    setBoard(newBoard);
    setLastMove([row, col]);
    setMoveHistory([...moveHistory, [row, col]]);
    if (checkWin(newBoard, row, col)) {
      setWinner(currentPlayer);
      setWinLine(findWinLine(newBoard, row, col));
    } else {
      setCurrentPlayer(currentPlayer === 1 ? 2 : 1);
    }
  };

  // ─── Online PvP via Supabase Realtime ───
  const createRoom = useCallback(async () => {
    const code = generateRoomCode();
    const channel = supabase.channel(`gomoku-${code}`, {
      config: { broadcast: { self: false } },
    });

    setPvp({
      roomCode: code,
      isHost: true,
      myColor: 1, // host plays black
      opponentName: '',
      opponentReady: false,
      roundIndex: 0,
    });
    setPvpWaiting(true);
    resetGame();
    setMode('online-game');

    channel
      .on('broadcast', { event: 'join' }, (msg: { payload: { name: string } }) => {
        setPvp(prev => prev ? { ...prev, opponentName: msg.payload.name, opponentReady: true } : prev);
        setPvpWaiting(false);
        channel.send({ type: 'broadcast', event: 'host-info', payload: { name: 'Host' } });
      })
      .on('broadcast', { event: 'move' }, (msg: { payload: { row: number; col: number } }) => {
        setOpponentMove([msg.payload.row, msg.payload.col]);
      })
      .on('broadcast', { event: 'restart' }, (msg: { payload: { roundIndex: number } }) => {
        resetGame();
        setPvp(prev => {
          if (!prev) return prev;
          const roundIndex = Math.max(prev.roundIndex, msg.payload.roundIndex);
          return { ...prev, roundIndex, myColor: colorForRound(prev.isHost, roundIndex) };
        });
      })
      .on('broadcast', { event: 'leave' }, () => {
        setPvpError(t('gomokuOpponentLeft'));
        setPvpWaiting(true);
      })
      .subscribe();

    channelRef.current = channel;
  }, [resetGame, t]);

  const joinRoom = useCallback(async () => {
    const code = roomCodeInput.toUpperCase().trim();
    if (code.length !== 6) return;

    const channel = supabase.channel(`gomoku-${code}`, {
      config: { broadcast: { self: false } },
    });

    setPvp({
      roomCode: code,
      isHost: false,
      myColor: 2, // guest plays white
      opponentName: 'Host',
      opponentReady: true,
      roundIndex: 0,
    });
    resetGame();
    setMode('online-game');

    let hostResponded = false;
    channel
      .on('broadcast', { event: 'host-info' }, (msg: { payload: { name: string } }) => {
        hostResponded = true;
        setPvp(prev => prev ? { ...prev, opponentName: msg.payload.name } : prev);
        setPvpWaiting(false);
      })
      .on('broadcast', { event: 'move' }, (msg: { payload: { row: number; col: number } }) => {
        setOpponentMove([msg.payload.row, msg.payload.col]);
      })
      .on('broadcast', { event: 'restart' }, (msg: { payload: { roundIndex: number } }) => {
        resetGame();
        setPvp(prev => {
          if (!prev) return prev;
          const roundIndex = Math.max(prev.roundIndex, msg.payload.roundIndex);
          return { ...prev, roundIndex, myColor: colorForRound(prev.isHost, roundIndex) };
        });
      })
      .on('broadcast', { event: 'leave' }, () => {
        setPvpError(t('gomokuOpponentLeft'));
        setPvpWaiting(true);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({ type: 'broadcast', event: 'join', payload: { name: 'Guest' } });
          // Timeout if host doesn't respond
          setTimeout(() => {
            if (!hostResponded) {
              setPvpError(t('gomokuRoomNotFound'));
              setMode('online-join');
              channel.unsubscribe();
            }
          }, 5000);
        }
      });

    channelRef.current = channel;
  }, [roomCodeInput, resetGame, t]);

  const sendMove = useCallback((row: number, col: number) => {
    const ch = channelRef.current;
    if (ch) ch.send({ type: 'broadcast', event: 'move', payload: { row, col } });
  }, []);

  const handleOnlineClick = useCallback((row: number, col: number) => {
    if (winner || board[row][col] !== 0 || !pvp) return;
    if (currentPlayer !== pvp.myColor) return;

    const newBoard = board.map(r => [...r]) as Stone[][];
    newBoard[row][col] = currentPlayer;
    setBoard(newBoard);
    setLastMove([row, col]);
    setMoveHistory([...moveHistory, [row, col]]);

    if (checkWin(newBoard, row, col)) {
      setWinner(currentPlayer);
      setWinLine(findWinLine(newBoard, row, col));
    } else {
      setCurrentPlayer(currentPlayer === 1 ? 2 : 1);
    }

    sendMove(row, col);
  }, [winner, board, pvp, currentPlayer, moveHistory, sendMove]);

  // Handle opponent's move
  useEffect(() => {
    if (!opponentMove || !pvp || winner) return;
    const [row, col] = opponentMove;
    if (board[row][col] !== 0) return;

    const opponentColor = pvp.myColor === 1 ? 2 : 1;
    const newBoard = board.map(r => [...r]) as Stone[][];
    newBoard[row][col] = opponentColor;
    setBoard(newBoard);
    setLastMove([row, col]);
    setMoveHistory(prev => [...prev, [row, col]]);

    if (checkWin(newBoard, row, col)) {
      setWinner(opponentColor);
      setWinLine(findWinLine(newBoard, row, col));
    } else {
      setCurrentPlayer(pvp.myColor);
    }
    setOpponentMove(null);
  }, [opponentMove, pvp, board, winner]);

  const handleOnlineRestart = useCallback(() => {
    resetGame();
    setCurrentPlayer(1);
    if (!pvp) return;
    const roundIndex = pvp.roundIndex + 1;
    setPvp(prev => prev ? { ...prev, roundIndex, myColor: colorForRound(prev.isHost, roundIndex) } : prev);
    channelRef.current?.send({ type: 'broadcast', event: 'restart', payload: { roundIndex } });
  }, [resetGame, pvp]);

  const leaveRoom = useCallback(() => {
    channelRef.current?.send({ type: 'broadcast', event: 'leave', payload: {} });
    channelRef.current?.unsubscribe();
    channelRef.current = null;
    setPvp(null);
    setPvpWaiting(false);
    setPvpError('');
    resetGame();
    setMode('online-menu');
  }, [resetGame]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      channelRef.current?.unsubscribe();
    };
  }, []);

  // ─── Board rendering ───
  const renderBoard = (onCellClick: (r: number, c: number) => void, interactive: boolean, hintCell?: [number, number] | null) => {
    const cellSize = 28;
    const padding = 16;
    const totalSize = cellSize * (BOARD_SIZE - 1) + padding * 2;

    return (
      <div className="relative" style={{ width: totalSize + 24, height: totalSize + 24 }}>
        {/* Wooden board background */}
        <div
          className="absolute inset-0 rounded-lg shadow-xl"
          style={{
            background: 'linear-gradient(135deg, #d4a574 0%, #c4956a 50%, #b8855a 100%)',
            width: totalSize + 24,
            height: totalSize + 24,
          }}
        >
          {/* Grid lines */}
          <svg className="absolute" style={{ left: padding + 6, top: padding + 6, width: totalSize, height: totalSize }}>
            {Array.from({ length: BOARD_SIZE }, (_, i) => (
              <g key={i}>
                <line x1={0} y1={i * cellSize} x2={(BOARD_SIZE - 1) * cellSize} y2={i * cellSize} stroke="#5a3a1a" strokeWidth={i === 0 || i === BOARD_SIZE - 1 ? 1.5 : 0.8} />
                <line x1={i * cellSize} y1={0} x2={i * cellSize} y2={(BOARD_SIZE - 1) * cellSize} stroke="#5a3a1a" strokeWidth={i === 0 || i === BOARD_SIZE - 1 ? 1.5 : 0.8} />
              </g>
            ))}
            {/* Star points */}
            {[[3, 3], [3, 11], [7, 7], [11, 3], [11, 11]].map(([r, c]) => (
              <circle key={`${r}-${c}`} cx={c * cellSize} cy={r * cellSize} r={3} fill="#5a3a1a" />
            ))}
          </svg>

          {/* Stones */}
          {board.map((row, r) =>
            row.map((cell, c) => {
              if (cell === 0) {
                const isHint = hintCell && hintCell[0] === r && hintCell[1] === c;
                return interactive ? (
                  <button
                    key={`${r}-${c}`}
                    onClick={() => onCellClick(r, c)}
                    className="absolute rounded-full hover:bg-black/10 transition-colors flex items-center justify-center"
                    style={{
                      left: padding + 6 + c * cellSize - cellSize / 2 + 2,
                      top: padding + 6 + r * cellSize - cellSize / 2 + 2,
                      width: cellSize - 4,
                      height: cellSize - 4,
                    }}
                  >
                    {isHint && (
                      <span
                        className="block rounded-full animate-pulse"
                        style={{ width: '60%', height: '60%', background: 'rgba(245,158,11,0.75)', boxShadow: '0 0 6px 2px rgba(245,158,11,0.6)' }}
                      />
                    )}
                  </button>
                ) : null;
              }
              const isLast = lastMove && lastMove[0] === r && lastMove[1] === c;
              const isWin = winLine?.some(([wr, wc]) => wr === r && wc === c);
              return (
                <div
                  key={`${r}-${c}`}
                  className="absolute rounded-full transition-all"
                  style={{
                    left: padding + 6 + c * cellSize - cellSize / 2 + 2,
                    top: padding + 6 + r * cellSize - cellSize / 2 + 2,
                    width: cellSize - 4,
                    height: cellSize - 4,
                    background: cell === 1
                      ? 'radial-gradient(circle at 35% 35%, #4a4a4a, #1a1a1a)'
                      : 'radial-gradient(circle at 35% 35%, #ffffff, #d0d0d0)',
                    boxShadow: isWin
                      ? '0 0 8px 2px rgba(255,215,0,0.8)'
                      : '1px 1px 3px rgba(0,0,0,0.4)',
                    border: isLast ? '2px solid #f59e0b' : 'none',
                  }}
                />
              );
            })
          )}
        </div>
      </div>
    );
  };

  // ─── Menu screen ───
  if (mode === 'menu') {
    return (
      <div className="w-full h-full flex flex-col items-center bg-slate-950 overflow-auto py-4 px-4">
        <div className="w-full max-w-md flex items-center justify-between mb-6">
          <button onClick={onExit} className="text-sm text-slate-400 hover:text-slate-200">
            ← {t('backToApp')}
          </button>
          <h1 className="text-lg font-bold text-slate-200">⚫ {t('gomokuTitle')}</h1>
          <span className="w-16" />
        </div>

        <div className="w-full max-w-sm space-y-3">
          <button
            onClick={() => setMode('puzzles')}
            className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium flex items-center justify-between transition-colors"
          >
            <span>🧩 {t('gomokuPuzzles')}</span>
            <span className="text-xs text-indigo-200">{solvedPuzzles.size}/{GOMOKU_PUZZLES.length}</span>
          </button>
          <button
            onClick={() => { resetGame(); setMode('local'); }}
            className="w-full py-3 px-4 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium flex items-center justify-between transition-colors"
          >
            <span>👥 {t('gomokuLocal')}</span>
            <span className="text-xs text-slate-300">{t('gomokuLocalDesc')}</span>
          </button>
          <button
            onClick={() => setMode('online-menu')}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium flex items-center justify-between transition-colors"
          >
            <span>🌐 {t('gomokuOnline')}</span>
            <span className="text-xs text-emerald-200">{t('gomokuOnlineDesc')}</span>
          </button>
        </div>
      </div>
    );
  }

  // ─── Puzzle list screen ───
  if (mode === 'puzzles') {
    return (
      <div className="w-full h-full flex flex-col items-center bg-slate-950 overflow-auto py-4 px-4">
        <div className="w-full max-w-md flex items-center justify-between mb-4">
          <button onClick={() => setMode('menu')} className="text-sm text-slate-400 hover:text-slate-200">
            ← {t('gomokuBackMenu')}
          </button>
          <h1 className="text-lg font-bold text-slate-200">🧩 {t('gomokuPuzzles')}</h1>
          <span className="text-xs text-slate-500">{solvedPuzzles.size}/{GOMOKU_PUZZLES.length}</span>
        </div>

        {/* Difficulty tabs */}
        {[1, 2, 3, 4, 5].map((diff) => {
          const diffPuzzles = GOMOKU_PUZZLES.filter(p => p.difficulty === diff);
          const diffSolved = diffPuzzles.filter(p => solvedPuzzles.has(p.id)).length;
          return (
            <div key={diff} className="w-full max-w-md mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-bold text-slate-300">
                  {'⭐'.repeat(diff)} {t('gomokuDiff')} {diff}
                </span>
                <span className="text-xs text-slate-500">({diffSolved}/{diffPuzzles.length})</span>
              </div>
              <div className="grid grid-cols-8 gap-1.5">
                {diffPuzzles.map((p) => {
                  const solved = solvedPuzzles.has(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => startPuzzle(GOMOKU_PUZZLES.indexOf(p))}
                      className={`aspect-square rounded-lg text-xs font-medium transition-all ${
                        solved
                          ? 'bg-emerald-600/30 border border-emerald-500/50 text-emerald-300'
                          : 'bg-slate-800 border border-slate-700 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      {solved ? '✓' : p.id}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ─── Puzzle game screen ───
  if (mode === 'puzzle-game' && currentPuzzle) {
    return (
      <div className="w-full h-full flex flex-col items-center bg-slate-950 overflow-auto py-4 px-4">
        <div className="w-full max-w-md flex items-center justify-between mb-3">
          <button onClick={() => setMode('puzzles')} className="text-sm text-slate-400 hover:text-slate-200">
            ← {t('gomokuPuzzles')}
          </button>
          <h1 className="text-sm font-bold text-slate-200">
            {t('gomokuPuzzle')} #{currentPuzzle.id} {'⭐'.repeat(currentPuzzle.difficulty)}
          </h1>
          <span className="w-16" />
        </div>

        <p className={`text-sm mb-3 ${puzzleFailed ? 'text-red-400' : puzzleDraw ? 'text-amber-400' : puzzleSolved ? 'text-emerald-400' : aiThinking ? 'text-amber-400' : 'text-slate-400'}`}>
          {puzzleFailed
            ? '⚠️ AI 找到了反杀，对局失败'
            : puzzleDraw
            ? '🤝 棋盘下满，双方战成和局'
            : puzzleSolved
            ? t('gomokuSolved')
            : aiThinking
            ? '🤔 AI 思考中…'
            : '黑方有必胜下法，自由落子找出来 —— 没有唯一答案，走错真会输'}
        </p>

        {renderBoard(handlePuzzleClick, !puzzleSolved && !puzzleDraw && !puzzleFailed && !aiThinking && !winner, hintMove)}

        {/* Puzzle controls */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={requestHint}
            disabled={aiThinking || hintLoading || puzzleSolved || puzzleDraw || puzzleFailed}
            className="text-xs px-3 py-2 rounded-lg border border-slate-600 bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-colors"
          >
            💡 {hintLoading ? '思考中…' : t('gomokuHint')}
          </button>
          <button
            onClick={() => startPuzzle(puzzleIndex)}
            disabled={aiThinking}
            className="text-xs px-3 py-2 rounded-lg border border-slate-600 bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-colors"
          >
            🔄 {t('gomokuRetry')}
          </button>
          {puzzleSolved && puzzleIndex < GOMOKU_PUZZLES.length - 1 && (
            <button
              onClick={() => startPuzzle(puzzleIndex + 1)}
              className="text-xs px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
            >
              → {t('gomokuNextPuzzle')}
            </button>
          )}
        </div>

        {hintMove && !puzzleSolved && !puzzleDraw && !puzzleFailed && (
          <p className="text-xs text-amber-400 mt-3 max-w-md text-center">
            引擎建议：棋盘上高亮的位置只是它的判断，不代表唯一解，你可以走别的路
          </p>
        )}

        {puzzleSolved && (
          <div className="mt-4 text-center">
            <div className="text-3xl mb-2">🎉</div>
            <p className="text-sm text-emerald-400 font-medium">{t('gomokuSolved')}</p>
          </div>
        )}

        {puzzleDraw && (
          <div className="mt-4 text-center">
            <div className="text-3xl mb-2">🤝</div>
            <p className="text-sm text-amber-400 font-medium">和局，点"重试"再挑战一次这条必胜线</p>
          </div>
        )}

        {puzzleFailed && (
          <div className="mt-4 text-center">
            <div className="text-3xl mb-2">💥</div>
            <p className="text-sm text-red-400 font-medium">AI 找到了反杀，点"重试"再来一次</p>
          </div>
        )}
      </div>
    );
  }

  // ─── Local PvP screen ───
  if (mode === 'local') {
    return (
      <div className="w-full h-full flex flex-col items-center bg-slate-950 overflow-auto py-4 px-4">
        <div className="w-full max-w-md flex items-center justify-between mb-3">
          <button onClick={() => setMode('menu')} className="text-sm text-slate-400 hover:text-slate-200">
            ← {t('gomokuBackMenu')}
          </button>
          <h1 className="text-lg font-bold text-slate-200">👥 {t('gomokuLocal')}</h1>
          <span className="w-16" />
        </div>

        {/* Turn indicator */}
        <div className="flex items-center gap-3 mb-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${currentPlayer === 1 ? 'bg-slate-700' : 'bg-slate-800/50'}`}>
            <div className="w-4 h-4 rounded-full" style={{ background: 'radial-gradient(circle at 35% 35%, #4a4a4a, #1a1a1a)' }} />
            <span className={`text-xs ${currentPlayer === 1 ? 'text-slate-200' : 'text-slate-500'}`}>{t('gomokuBlack')}</span>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${currentPlayer === 2 ? 'bg-slate-700' : 'bg-slate-800/50'}`}>
            <div className="w-4 h-4 rounded-full" style={{ background: 'radial-gradient(circle at 35% 35%, #ffffff, #d0d0d0)' }} />
            <span className={`text-xs ${currentPlayer === 2 ? 'text-slate-200' : 'text-slate-500'}`}>{t('gomokuWhite')}</span>
          </div>
        </div>

        {renderBoard(handleLocalClick, !winner)}

        {winner && (
          <div className="mt-4 text-center">
            <div className="text-3xl mb-2">🎉</div>
            <p className="text-sm text-slate-200 font-medium">
              {winner === 1 ? `⚫ ${t('gomokuBlack')}` : `⚪ ${t('gomokuWhite')}`} {t('gomokuWins')}
            </p>
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <button
            onClick={() => { resetGame(); setCurrentPlayer(1); }}
            className="text-xs px-3 py-2 rounded-lg border border-slate-600 bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            🔄 {t('gomokuRestart')}
          </button>
          <button
            onClick={() => {
              if (moveHistory.length === 0 || winner) return;
              const [r, c] = moveHistory[moveHistory.length - 1];
              const newBoard = board.map(row => [...row]) as Stone[][];
              newBoard[r][c] = 0;
              setBoard(newBoard);
              setMoveHistory(moveHistory.slice(0, -1));
              setCurrentPlayer(currentPlayer === 1 ? 2 : 1);
              setLastMove(moveHistory.length > 1 ? moveHistory[moveHistory.length - 2] : null);
            }}
            disabled={moveHistory.length === 0 || !!winner}
            className="text-xs px-3 py-2 rounded-lg border border-slate-600 bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-colors"
          >
            ↩️ {t('gomokuUndo')}
          </button>
        </div>
      </div>
    );
  }

  // ─── Online menu screen ───
  if (mode === 'online-menu') {
    return (
      <div className="w-full h-full flex flex-col items-center bg-slate-950 overflow-auto py-4 px-4">
        <div className="w-full max-w-md flex items-center justify-between mb-6">
          <button onClick={() => setMode('menu')} className="text-sm text-slate-400 hover:text-slate-200">
            ← {t('gomokuBackMenu')}
          </button>
          <h1 className="text-lg font-bold text-slate-200">🌐 {t('gomokuOnline')}</h1>
          <span className="w-16" />
        </div>

        <div className="w-full max-w-sm space-y-4">
          {/* Create room */}
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
            <h2 className="text-sm font-bold text-slate-200 mb-2">{t('gomokuCreateRoom')}</h2>
            <p className="text-xs text-slate-500 mb-3">{t('gomokuCreateRoomDesc')}</p>
            <button
              onClick={createRoom}
              className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
            >
              🎮 {t('gomokuCreateRoom')}
            </button>
          </div>

          {/* Join room */}
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
            <h2 className="text-sm font-bold text-slate-200 mb-2">{t('gomokuJoinRoom')}</h2>
            <p className="text-xs text-slate-500 mb-3">{t('gomokuJoinRoomDesc')}</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                maxLength={6}
                placeholder="ABCDEF"
                className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-200 text-sm font-mono uppercase tracking-wider focus:border-emerald-500 outline-none"
              />
              <button
                onClick={joinRoom}
                disabled={roomCodeInput.length !== 6}
                className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-30 text-white text-sm font-medium transition-colors"
              >
                →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Online game screen ───
  if (mode === 'online-game' && pvp) {
    const myTurn = currentPlayer === pvp.myColor && !winner && !pvpWaiting;
    return (
      <div className="w-full h-full flex flex-col items-center bg-slate-950 overflow-auto py-4 px-4">
        <div className="w-full max-w-md flex items-center justify-between mb-3">
          <button onClick={leaveRoom} className="text-sm text-slate-400 hover:text-slate-200">
            ← {t('gomokuLeaveRoom')}
          </button>
          <h1 className="text-lg font-bold text-slate-200">🌐 {t('gomokuOnline')}</h1>
          <span className="text-xs text-slate-500 font-mono">{pvp.roomCode}</span>
        </div>

        {/* PvP info bar */}
        <div className="w-full max-w-md flex items-center justify-between bg-slate-900 rounded-lg border border-slate-700 px-3 py-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full" style={{
              background: pvp.myColor === 1
                ? 'radial-gradient(circle at 35% 35%, #4a4a4a, #1a1a1a)'
                : 'radial-gradient(circle at 35% 35%, #ffffff, #d0d0d0)'
            }} />
            <div>
              <p className="text-xs text-slate-300">{t('gomokuYou')}</p>
              <p className="text-[10px] text-slate-500">{pvp.myColor === 1 ? t('gomokuBlack') : t('gomokuWhite')}</p>
            </div>
          </div>
          <span className="text-xs text-slate-600">vs</span>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-xs text-slate-300">{pvp.opponentName || '...'}</p>
              <p className="text-[10px] text-slate-500">{pvp.myColor === 1 ? t('gomokuWhite') : t('gomokuBlack')}</p>
            </div>
            <div className="w-6 h-6 rounded-full" style={{
              background: pvp.myColor === 1
                ? 'radial-gradient(circle at 35% 35%, #ffffff, #d0d0d0)'
                : 'radial-gradient(circle at 35% 35%, #4a4a4a, #1a1a1a)'
            }} />
          </div>
        </div>

        {/* Status */}
        {pvpWaiting ? (
          <div className="text-center py-8">
            <div className="text-3xl mb-3 animate-pulse">⏳</div>
            <p className="text-sm text-slate-400 mb-1">{t('gomokuWaiting')}</p>
            <p className="text-xs text-slate-500">{t('gomokuShareCode')}</p>
            <div className="mt-3 text-2xl font-mono font-bold text-emerald-400 tracking-widest">{pvp.roomCode}</div>
          </div>
        ) : pvpError ? (
          <div className="text-center py-8">
            <div className="text-3xl mb-3">⚠️</div>
            <p className="text-sm text-red-400">{pvpError}</p>
            <button onClick={leaveRoom} className="mt-4 px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm">
              ← {t('gomokuBackMenu')}
            </button>
          </div>
        ) : (
          <>
            <p className={`text-sm mb-3 ${myTurn ? 'text-emerald-400' : 'text-slate-500'}`}>
              {winner
                ? (winner === pvp.myColor ? `🎉 ${t('gomokuYouWin')}` : `😅 ${t('gomokuYouLose')}`)
                : myTurn ? t('gomokuYourTurn') : t('gomokuOpponentTurn')}
            </p>
            {renderBoard(handleOnlineClick, myTurn)}

            {winner && (
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleOnlineRestart}
                  className="text-xs px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
                >
                  🔄 {t('gomokuPlayAgain')}
                </button>
                <button
                  onClick={leaveRoom}
                  className="text-xs px-3 py-2 rounded-lg border border-slate-600 bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  ← {t('gomokuLeaveRoom')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // Fallback
  return null;
}
