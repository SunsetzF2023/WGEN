import { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import {
  type GameState,
  type PlayerColor,
  type Plane,
  createInitialState,
  rollDice,
  getMovablePlanes,
  movePlane,
  getDisplayCoords,
  generateRoomCode,
  COLOR_EMOJI,
  COLOR_HEX,
  COLOR_NAMES,
  GRID_SIZE,
  MAIN_LOOP_COORDS,
  HOME_STRETCH_COORDS,
  BASE_COORDS,
  ENTRY_POINTS,
} from '../lib/flightChess';

type GameMode = 'menu' | 'local' | 'online-menu' | 'online-create' | 'online-join' | 'online-game';

interface PvPState {
  roomCode: string;
  isHost: boolean;
  myColor: PlayerColor;
  opponentName: string;
  opponentReady: boolean;
}

// ─── Simple AI for local mode ───
function aiPickPlane(state: GameState, color: PlayerColor, dice: number): number {
  const movable = getMovablePlanes(state, color, dice);
  if (movable.length === 0) return -1;

  // Priority: 1) finish a plane, 2) capture opponents, 3) take off, 4) move furthest
  for (const p of movable) {
    if (p.state === 'flying' || p.state === 'home') {
      if (p.position + dice >= 58) return p.id;
    }
  }

  // Check for captures
  for (const p of movable) {
    if (p.state === 'flying') {
      const newPos = p.position + dice;
      if (newPos < 52) {
        const absPos = (ENTRY_POINTS[color] + newPos) % 52;
        for (const other of state.planes) {
          if (other.color !== color && other.state === 'flying') {
            const otherAbs = (ENTRY_POINTS[other.color] + other.position) % 52;
            if (otherAbs === absPos) return p.id;
          }
        }
      }
    }
  }

  // Take off on 6
  if (dice === 6) {
    const inBase = movable.filter((p) => p.state === 'base');
    if (inBase.length > 0) return inBase[0].id;
  }

  // Move furthest
  movable.sort((a, b) => b.position - a.position);
  return movable[0].id;
}

export function FlightChess({ onExit }: { onExit: () => void }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<GameMode>('menu');
  const [gameState, setGameState] = useState<GameState>(createInitialState);
  const [diceValue, setDiceValue] = useState<number | null>(null);
  const [diceRolling, setDiceRolling] = useState(false);
  const [hasRolled, setHasRolled] = useState(false);
  const [message, setMessage] = useState('');
  const [numPlayers, setNumPlayers] = useState(2); // for local mode

  // PvP state
  const [pvp, setPvp] = useState<PvPState | null>(null);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [pvpWaiting, setPvpWaiting] = useState(false);
  const [pvpError, setPvpError] = useState('');
  const [opponentMove, setOpponentMove] = useState<{ color: PlayerColor; planeId: number; dice: number } | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const myColor: PlayerColor = pvp?.myColor ?? 0;
  const isMyTurn = !pvp || gameState.currentPlayer === myColor;
  const movablePlanes = hasRolled && diceValue ? getMovablePlanes(gameState, gameState.currentPlayer, diceValue) : [];

  const resetGame = useCallback(() => {
    setGameState(createInitialState());
    setDiceValue(null);
    setHasRolled(false);
    setMessage('');
  }, []);

  // ─── Dice roll ───
  const handleRollDice = useCallback(() => {
    if (hasRolled || diceRolling || gameState.winner !== null) return;
    if (pvp && !isMyTurn) return;

    setDiceRolling(true);
    let rollCount = 0;
    const interval = setInterval(() => {
      setDiceValue(Math.floor(Math.random() * 6) + 1);
      rollCount++;
      if (rollCount >= 10) {
        clearInterval(interval);
        const finalValue = rollDice();
        setDiceValue(finalValue);
        setDiceRolling(false);
        setHasRolled(true);

        const movable = getMovablePlanes(gameState, gameState.currentPlayer, finalValue);
        if (movable.length === 0) {
          setMessage(`${COLOR_EMOJI[gameState.currentPlayer]} ${t('fcNoMovable')}`);
          // Auto-skip turn after delay
          setTimeout(() => {
            setGameState((prev) => ({
              ...prev,
              currentPlayer: finalValue === 6 ? prev.currentPlayer : ((prev.currentPlayer + 1) % 4) as PlayerColor,
              diceValue: finalValue,
              lastAction: `${COLOR_EMOJI[prev.currentPlayer]} 掷出 ${finalValue}，无飞机可动`,
            }));
            setHasRolled(false);
            setDiceValue(null);
          }, 1500);
        } else if (movable.length === 1) {
          // Auto-move if only one option
          setMessage(`${COLOR_EMOJI[gameState.currentPlayer]} ${t('fcAutoMove')}`);
        } else {
          setMessage(`${COLOR_EMOJI[gameState.currentPlayer]} ${t('fcSelectPlane')}`);
        }
      }
    }, 80);
  }, [hasRolled, diceRolling, gameState, pvp, isMyTurn, t]);

  // ─── Plane selection & movement ───
  const handlePlaneClick = useCallback((color: PlayerColor, planeId: number) => {
    if (diceRolling || !hasRolled || !diceValue) return;
    if (pvp && !isMyTurn) return;
    if (color !== gameState.currentPlayer) return;

    const movable = getMovablePlanes(gameState, gameState.currentPlayer, diceValue);
    if (!movable.some((p) => p.id === planeId)) return;

    const newState = movePlane(gameState, color, planeId, diceValue);
    setGameState(newState);
    setMessage(newState.lastAction);
    setHasRolled(false);
    setDiceValue(null);
    // Send move to opponent
    if (pvp) {
      const ch = channelRef.current;
      if (ch) {
        ch.send({
          type: 'broadcast',
          event: 'move',
          payload: { color, planeId, dice: diceValue },
        });
      }
    }
  }, [diceRolling, hasRolled, diceValue, gameState, pvp, isMyTurn]);

  // ─── Local mode AI turn ───
  useEffect(() => {
    if (mode !== 'local' || gameState.winner !== null || hasRolled || diceRolling) return;
    if (gameState.currentPlayer === 0) return; // human is always red (0) in local

    const timer = setTimeout(() => {
      const dice = rollDice();
      setDiceValue(dice);
      setHasRolled(true);

      const movable = getMovablePlanes(gameState, gameState.currentPlayer, dice);
      if (movable.length === 0) {
        setMessage(`${COLOR_EMOJI[gameState.currentPlayer]} ${t('fcNoMovable')}`);
        setTimeout(() => {
          setGameState((prev) => ({
            ...prev,
            currentPlayer: dice === 6 ? prev.currentPlayer : ((prev.currentPlayer + 1) % numPlayers) as PlayerColor,
            diceValue: dice,
            lastAction: `${COLOR_EMOJI[prev.currentPlayer]} 掷出 ${dice}，无飞机可动`,
          }));
          setHasRolled(false);
          setDiceValue(null);
        }, 1200);
        return;
      }

      const planeId = aiPickPlane(gameState, gameState.currentPlayer, dice);
      if (planeId < 0) {
        setHasRolled(false);
        setDiceValue(null);
        return;
      }

      setTimeout(() => {
        const newState = movePlane(gameState, gameState.currentPlayer, planeId, dice);
        setGameState(newState);
        setMessage(newState.lastAction);
        setHasRolled(false);
        setDiceValue(null);
      }, 800);
    }, 1000);

    return () => clearTimeout(timer);
  }, [mode, gameState, hasRolled, diceRolling, numPlayers, t]);

  // ─── Online: handle opponent moves ───
  useEffect(() => {
    if (!opponentMove || !pvp || gameState.winner !== null) return;
    if (opponentMove.color === myColor) return;

    const newState = movePlane(gameState, opponentMove.color, opponentMove.planeId, opponentMove.dice);
    setGameState(newState);
    setMessage(newState.lastAction);
    setOpponentMove(null);
  }, [opponentMove, pvp, gameState, myColor]);

  // ─── Online room creation ───
  const createRoom = useCallback(() => {
    const code = generateRoomCode();
    const channel = supabase.channel(`flightchess-${code}`, {
      config: { broadcast: { self: false } },
    });

    setPvp({
      roomCode: code,
      isHost: true,
      myColor: 0,
      opponentName: '',
      opponentReady: false,
    });
    setPvpWaiting(true);
    resetGame();
    setMode('online-game');

    channel
      .on('broadcast', { event: 'join' }, (msg: { payload: { name: string } }) => {
        setPvp((prev) => prev ? { ...prev, opponentName: msg.payload.name, opponentReady: true } : prev);
        setPvpWaiting(false);
        channel.send({ type: 'broadcast', event: 'host-info', payload: { name: 'Host' } });
      })
      .on('broadcast', { event: 'move' }, (msg: { payload: { color: PlayerColor; planeId: number; dice: number } }) => {
        setOpponentMove(msg.payload);
      })
      .on('broadcast', { event: 'restart' }, () => {
        resetGame();
      })
      .on('broadcast', { event: 'leave' }, () => {
        setPvpError(t('gomokuOpponentLeft'));
        setPvpWaiting(true);
      })
      .subscribe();

    channelRef.current = channel;
  }, [resetGame, t]);

  const joinRoom = useCallback(() => {
    const code = roomCodeInput.toUpperCase().trim();
    if (code.length !== 6) return;

    const channel = supabase.channel(`flightchess-${code}`, {
      config: { broadcast: { self: false } },
    });

    setPvp({
      roomCode: code,
      isHost: false,
      myColor: 1,
      opponentName: 'Host',
      opponentReady: true,
    });
    resetGame();
    setMode('online-game');

    let hostResponded = false;
    channel
      .on('broadcast', { event: 'host-info' }, (msg: { payload: { name: string } }) => {
        hostResponded = true;
        setPvp((prev) => prev ? { ...prev, opponentName: msg.payload.name } : prev);
      })
      .on('broadcast', { event: 'move' }, (msg: { payload: { color: PlayerColor; planeId: number; dice: number } }) => {
        setOpponentMove(msg.payload);
      })
      .on('broadcast', { event: 'restart' }, () => {
        resetGame();
      })
      .on('broadcast', { event: 'leave' }, () => {
        setPvpError(t('gomokuOpponentLeft'));
        setPvpWaiting(true);
      })
      .subscribe();

    channel.send({ type: 'broadcast', event: 'join', payload: { name: 'Guest' } });

    setTimeout(() => {
      if (!hostResponded) {
        setPvpError(t('gomokuRoomNotFound'));
        channel.unsubscribe();
        setMode('online-join');
      }
    }, 5000);

    channelRef.current = channel;
  }, [roomCodeInput, resetGame, t]);

  const leaveRoom = useCallback(() => {
    const ch = channelRef.current;
    if (ch) {
      ch.send({ type: 'broadcast', event: 'leave', payload: {} });
      ch.unsubscribe();
    }
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
  const cellSize = 36;
  const boardPx = cellSize * GRID_SIZE;

  // Precompute lookup sets for fast checking
  const pathSet = new Set(MAIN_LOOP_COORDS.map((c) => `${c.row},${c.col}`));
  const homeColorMap = new Map<string, number>();
  HOME_STRETCH_COORDS.forEach((stretch, color) => {
    stretch.forEach((c) => homeColorMap.set(`${c.row},${c.col}`, color));
  });
  const baseColorMap = new Map<string, number>();
  BASE_COORDS.forEach((base, color) => {
    base.forEach((c) => baseColorMap.set(`${c.row},${c.col}`, color));
  });
  const entryMap = new Map<string, number>();
  ENTRY_POINTS.forEach((entry, color) => {
    const coord = MAIN_LOOP_COORDS[entry];
    entryMap.set(`${coord.row},${coord.col}`, color);
  });

  // Quadrant background areas
  const QUADRANTS = [
    { color: 0, row: 0, col: 0, rows: 6, cols: 6 },          // Red: top-left
    { color: 1, row: 0, col: 8, rows: 6, cols: 6 },          // Yellow: top-right
    { color: 2, row: 8, col: 8, rows: 6, cols: 6 },          // Blue: bottom-right
    { color: 3, row: 8, col: 0, rows: 6, cols: 6 },          // Green: bottom-left
  ];

  const renderCell = (row: number, col: number) => {
    const key = `${row},${col}`;
    const isPath = pathSet.has(key);
    const homeColor = homeColorMap.get(key);
    const baseColor = baseColorMap.get(key);
    const entryColor = entryMap.get(key);
    const isCenter = row >= 6 && row <= 8 && col >= 6 && col <= 8;

    if (!isPath && homeColor === undefined && baseColor === undefined && !isCenter) return null;

    let bg = 'transparent';
    let border = 'none';
    let borderRadius = 4;

    if (isPath) {
      bg = entryColor !== undefined ? `${COLOR_HEX[entryColor]}55` : 'rgba(240, 240, 240, 0.12)';
      border = '1px solid rgba(255, 255, 255, 0.15)';
    }
    if (homeColor !== undefined) {
      bg = `${COLOR_HEX[homeColor]}66`;
      border = `1px solid ${COLOR_HEX[homeColor]}aa`;
    }
    if (baseColor !== undefined) {
      bg = `${COLOR_HEX[baseColor]}44`;
      border = `2px solid ${COLOR_HEX[baseColor]}88`;
      borderRadius = 50;
    }
    if (isCenter && homeColor === undefined) {
      bg = 'rgba(255, 215, 0, 0.08)';
    }

    return (
      <div
        key={`${row}-${col}`}
        className="absolute"
        style={{
          left: col * cellSize,
          top: row * cellSize,
          width: cellSize,
          height: cellSize,
          background: bg,
          border,
          borderRadius,
        }}
      />
    );
  };

  const renderPlane = (plane: Plane) => {
    const { row, col } = getDisplayCoords(plane.color, plane.id, plane.position);
    const isMovable = movablePlanes.some((p) => p.id === plane.id && p.color === plane.color);
    const isCurrentPlayer = plane.color === gameState.currentPlayer;
    const canClick = isMovable && (!pvp || isMyTurn) && !diceRolling;

    return (
      <button
        key={`${plane.color}-${plane.id}`}
        onClick={() => canClick && handlePlaneClick(plane.color, plane.id)}
        disabled={!canClick}
        className={`absolute flex items-center justify-center rounded-full transition-all ${
          isMovable && isCurrentPlayer ? 'ring-2 ring-white animate-pulse cursor-pointer z-10' : ''
        } ${!canClick && isMovable ? 'cursor-pointer' : 'cursor-default'}`}
        style={{
          left: col * cellSize + 3,
          top: row * cellSize + 3,
          width: cellSize - 6,
          height: cellSize - 6,
          background: `radial-gradient(circle at 30% 30%, ${COLOR_HEX[plane.color]}ee, ${COLOR_HEX[plane.color]}aa)`,
          opacity: plane.state === 'finished' ? 0.3 : 1,
          boxShadow: isMovable && isCurrentPlayer ? `0 0 10px ${COLOR_HEX[plane.color]}, 0 0 4px white` : `0 1px 3px rgba(0,0,0,0.4)`,
          border: '2px solid rgba(255,255,255,0.4)',
        }}
      >
        <span className="text-sm" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.5))' }}>
          {plane.state === 'finished' ? '★' : '✈'}
        </span>
      </button>
    );
  };

  const renderDice = () => {
    const dots: Record<number, [number, number][]> = {
      1: [[1, 1]],
      2: [[0, 0], [2, 2]],
      3: [[0, 0], [1, 1], [2, 2]],
      4: [[0, 0], [0, 2], [2, 0], [2, 2]],
      5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
      6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
    };

    const value = diceValue ?? 0;
    const positions = dots[value] || [];

    return (
      <div
        className={`relative rounded-xl bg-white shadow-lg ${diceRolling ? 'animate-spin' : ''}`}
        style={{ width: 56, height: 56 }}
      >
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 p-2">
          {Array.from({ length: 9 }, (_, i) => {
            const r = Math.floor(i / 3);
            const c = i % 3;
            const hasDot = positions.some(([pr, pc]) => pr === r && pc === c);
            return (
              <div key={i} className="flex items-center justify-center">
                {hasDot && <div className="w-2.5 h-2.5 rounded-full bg-slate-800" />}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ─── Win overlay ───
  if (gameState.winner !== null) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
        <div className="bg-slate-800 rounded-2xl p-8 text-center shadow-2xl border border-slate-700">
          <div className="text-6xl mb-4">{COLOR_EMOJI[gameState.winner]}</div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {COLOR_NAMES[gameState.winner]} {t('fcWins')}
          </h2>
          <p className="text-slate-400 mb-6">{t('fcGameOver')}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => { resetGame(); }}
              className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
            >
              {t('gomokuPlayAgain')}
            </button>
            <button
              onClick={() => { resetGame(); setMode('menu'); }}
              className="px-6 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors"
            >
              {t('gomokuBackMenu')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Menu screen ───
  if (mode === 'menu') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900 overflow-auto">
        <div className="max-w-md w-full p-8">
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">✈️</div>
            <h1 className="text-3xl font-bold text-white mb-1">{t('fcTitle')}</h1>
            <p className="text-slate-400 text-sm">{t('fcSubtitle')}</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => { resetGame(); setNumPlayers(2); setMode('local'); }}
              className="w-full p-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎮</span>
                <div>
                  <div className="text-white font-medium">{t('fcLocal')}</div>
                  <div className="text-slate-400 text-xs">{t('fcLocalDesc')}</div>
                </div>
              </div>
            </button>

            <button
              onClick={() => setMode('online-menu')}
              className="w-full p-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">🌐</span>
                <div>
                  <div className="text-white font-medium">{t('fcOnline')}</div>
                  <div className="text-slate-400 text-xs">{t('fcOnlineDesc')}</div>
                </div>
              </div>
            </button>
          </div>

          <button
            onClick={onExit}
            className="mt-6 w-full text-center text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            ← {t('gomokuBackMenu')}
          </button>
        </div>
      </div>
    );
  }

  // ─── Online menu ───
  if (mode === 'online-menu') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900 overflow-auto">
        <div className="max-w-md w-full p-8">
          <h2 className="text-xl font-bold text-white mb-6 text-center">{t('fcOnline')}</h2>
          <div className="space-y-3">
            <button
              onClick={createRoom}
              className="w-full p-4 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-600/40 transition-colors text-left"
            >
              <div className="text-white font-medium">{t('gomokuCreateRoom')}</div>
              <div className="text-slate-400 text-xs">{t('gomokuCreateRoomDesc')}</div>
            </button>

            <div className="p-4 rounded-xl bg-slate-800 border border-slate-700">
              <div className="text-white font-medium mb-2">{t('gomokuJoinRoom')}</div>
              <div className="flex gap-2">
                <input
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                  placeholder={t('gomokuRoomCode')}
                  maxLength={6}
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm uppercase tracking-wider focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={joinRoom}
                  disabled={roomCodeInput.length !== 6}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-medium transition-colors"
                >
                  {t('gomokuJoin')}
                </button>
              </div>
              {pvpError && <div className="text-red-400 text-xs mt-2">{pvpError}</div>}
            </div>
          </div>

          <button
            onClick={() => setMode('menu')}
            className="mt-6 w-full text-center text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            ← {t('gomokuBackMenu')}
          </button>
        </div>
      </div>
    );
  }

  // ─── Game screen ───
  const currentPlayerColor = gameState.currentPlayer;

  return (
    <div className="w-full h-full flex flex-col items-center bg-slate-900 overflow-auto py-4">
      {/* Header */}
      <div className="flex items-center justify-between w-full max-w-2xl px-4 mb-3">
        <button
          onClick={() => {
            if (pvp) { leaveRoom(); }
            else { resetGame(); setMode('menu'); }
          }}
          className="text-sm text-slate-400 hover:text-white transition-colors"
        >
          ← {t('gomokuBackMenu')}
        </button>
        <h2 className="text-lg font-bold text-white">✈️ {t('fcTitle')}</h2>
        <div className="w-20" />
      </div>

      {/* Player info bar */}
      <div className="flex gap-2 mb-3">
        {Array.from({ length: pvp ? 2 : numPlayers }, (_, i) => i as PlayerColor).map((c) => (
          <div
            key={c}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all ${
              currentPlayerColor === c ? 'ring-2 ring-white' : 'opacity-50'
            }`}
            style={{ background: `${COLOR_HEX[c]}33` }}
          >
            <span className="text-lg">{COLOR_EMOJI[c]}</span>
            <span className="text-sm font-medium" style={{ color: COLOR_HEX[c] }}>
              {pvp && c === myColor ? t('gomokuYou') : pvp ? t('gomokuOpponent') : `P${c + 1}`}
            </span>
            <span className="text-xs text-slate-400">
              {gameState.planes.filter((p) => p.color === c && p.state === 'finished').length}/4
            </span>
          </div>
        ))}
      </div>

      {/* Board */}
      <div className="relative rounded-2xl overflow-hidden shadow-2xl" style={{ width: boardPx, height: boardPx, background: '#1e293b' }}>
        {/* Quadrant backgrounds */}
        {QUADRANTS.map((q) => (
          <div
            key={`quad-${q.color}`}
            className="absolute"
            style={{
              left: q.col * cellSize,
              top: q.row * cellSize,
              width: q.cols * cellSize,
              height: q.rows * cellSize,
              background: `${COLOR_HEX[q.color]}1a`,
              border: `2px solid ${COLOR_HEX[q.color]}33`,
              borderRadius: 8,
            }}
          />
        ))}

        {/* Quadrant labels */}
        {QUADRANTS.map((q) => {
          const labelRow = q.row + (q.rows / 2) - 0.5;
          const labelCol = q.col + (q.cols / 2) - 0.5;
          // Offset label to avoid overlapping with base circles
          const isTop = q.row === 0;
          const isLeft = q.col === 0;
          const labelR = labelRow + (isTop ? -1.5 : 1.5);
          const labelC = labelCol + (isLeft ? -1.5 : 1.5);
          return (
            <div
              key={`label-${q.color}`}
              className="absolute flex items-center justify-center text-lg font-bold"
              style={{
                left: labelC * cellSize,
                top: labelR * cellSize,
                width: cellSize * 2,
                height: cellSize * 2,
                color: `${COLOR_HEX[q.color]}44`,
              }}
            >
              {COLOR_EMOJI[q.color]}
            </div>
          );
        })}

        {/* Path cells */}
        {Array.from({ length: GRID_SIZE }, (_, row) =>
          Array.from({ length: GRID_SIZE }, (_, col) => renderCell(row, col))
        )}

        {/* Center area with 4 colored triangles */}
        <svg
          className="absolute"
          style={{ left: 6 * cellSize, top: 6 * cellSize, width: 3 * cellSize, height: 3 * cellSize }}
        >
          {/* Red triangle (top-left) */}
          <polygon points={`0,0 ${3 * cellSize},0 0,${3 * cellSize}`} fill={`${COLOR_HEX[0]}66`} stroke={COLOR_HEX[0]} strokeWidth={1} />
          {/* Yellow triangle (top-right) */}
          <polygon points={`${3 * cellSize},0 ${3 * cellSize},${3 * cellSize} 0,0`} fill="none" />
          <polygon points={`${3 * cellSize},0 ${3 * cellSize},${3 * cellSize} 0,0`} fill={`${COLOR_HEX[1]}66`} stroke={COLOR_HEX[1]} strokeWidth={1} opacity={0.5} />
          {/* Blue triangle (bottom-right) */}
          <polygon points={`${3 * cellSize},${3 * cellSize} 0,${3 * cellSize} ${3 * cellSize},0`} fill={`${COLOR_HEX[2]}66`} stroke={COLOR_HEX[2]} strokeWidth={1} />
          {/* Green triangle (bottom-left) */}
          <polygon points={`0,${3 * cellSize} 0,0 ${3 * cellSize},${3 * cellSize}`} fill={`${COLOR_HEX[3]}66`} stroke={COLOR_HEX[3]} strokeWidth={1} />
          {/* Center flag */}
          <text x={1.5 * cellSize} y={1.6 * cellSize} textAnchor="middle" fontSize={20} opacity={0.5}>🏁</text>
        </svg>

        {/* Entry point arrows */}
        {ENTRY_POINTS.map((entry, color) => {
          const coord = MAIN_LOOP_COORDS[entry];
          return (
            <div
              key={`entry-${color}`}
              className="absolute flex items-center justify-center text-sm font-bold"
              style={{
                left: coord.col * cellSize + 2,
                top: coord.row * cellSize + 2,
                width: cellSize - 4,
                height: cellSize - 4,
                color: COLOR_HEX[color],
                textShadow: `0 0 4px ${COLOR_HEX[color]}`,
              }}
            >
              ●
            </div>
          );
        })}

        {/* Planes */}
        {gameState.planes.map((plane) => renderPlane(plane))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 mt-4">
        {renderDice()}
        <button
          onClick={handleRollDice}
          disabled={hasRolled || diceRolling || (pvp && !isMyTurn) || gameState.winner !== null}
          className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold transition-colors"
        >
          {diceRolling ? '...' : t('fcRollDice')}
        </button>
      </div>

      {/* Status message */}
      <div className="mt-3 text-sm text-slate-300 min-h-[24px] text-center max-w-md">
        {pvpWaiting ? (
          <span className="text-amber-400">
            {t('gomokuWaiting')} ({pvp?.roomCode})
          </span>
        ) : pvp && !isMyTurn ? (
          <span className="text-slate-500">{COLOR_EMOJI[currentPlayerColor]} {t('gomokuOpponentTurn')}</span>
        ) : message ? (
          message
        ) : isMyTurn || !pvp ? (
          <span className="text-slate-400">
            {COLOR_EMOJI[currentPlayerColor]} {t('fcYourTurn')} — {t('fcRollDice')}
          </span>
        ) : null}
      </div>

      {/* Rules hint */}
      <div className="mt-2 text-xs text-slate-500 max-w-md text-center">
        {t('fcRulesHint')}
      </div>
    </div>
  );
}
