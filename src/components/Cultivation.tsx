import { useState, useEffect, useCallback, useRef } from 'react';
import { signInWithGitHub } from '../lib/supabase';
import { TECHNIQUE_MAP, MAX_EQUIPPED, realmForLevel, RARITY_COLOR, MARKET_REFRESH_COST, BUILDINGS, sellValueFor, TECHNIQUES, RARITIES, CODEX_REWARD } from '../lib/cultivationData';
import {
  type Cultivator, type BattleLogRow,
  loadOrCreateMyCultivator, saveCultivator, loadRoster,
  computeIdleGains, applyIdleGains, cultivatorLevel, cultivatorRealmName,
  cultivatorStats, expProgress, learnCostFor, upgradeCostFor,
  buyTechnique, sellTechnique, refreshMarket, upgradeTechnique, toggleEquipped,
  buildingLevel, buildingUpgradeCost, upgradeBuilding, liveRatesFor,
  challengeCultivator, loadMyBattleLogs, techniqueStatPreview,
} from '../lib/cultivationStore';
import type { LogEntry } from '../lib/cultivationBattle';

type View = 'loading' | 'login' | 'dashboard' | 'market' | 'techniques' | 'buildings' | 'roster' | 'history' | 'battle-result' | 'codex';

interface CultivationProps {
  onExit: () => void;
  user: { id: string; name: string } | null;
}

/** Formats a small per-tick gain for the floating popups: more decimals when the number is tiny, so "+0.02" still reads instead of rounding away to "+0". */
function formatLiveGain(n: number): string {
  if (n >= 1) return n.toFixed(1);
  if (n >= 0.01) return n.toFixed(2);
  return n.toFixed(3);
}

/** Renders a technique's passive stat breakdown (and any drawback) as small pills next to its description. */
function TechniqueStatPills({ techniqueId, level }: { techniqueId: string; level: number }) {
  const entries = techniqueStatPreview(techniqueId, level);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mb-2.5">
      {entries.map((e) => (
        <span
          key={e.label}
          className={`text-[10px] px-1.5 py-0.5 rounded ${e.positive ? 'bg-emerald-900/30 text-emerald-300' : 'bg-red-900/30 text-red-300'}`}
        >
          {e.label} {e.value}
        </span>
      ))}
    </div>
  );
}

function CultivationHeader({ title, onBack, onExit }: { title: string; onBack?: () => void; onExit: () => void }) {
  return (
    <div className="w-full max-w-md flex items-center justify-between mb-4">
      <button onClick={onBack ?? onExit} className="text-sm text-slate-400 hover:text-slate-200">
        ← {onBack ? '返回' : '退出小游戏'}
      </button>
      <h1 className="text-lg font-bold text-slate-200">{title}</h1>
      <span className="w-16" />
    </div>
  );
}

export function Cultivation({ onExit, user }: CultivationProps) {
  const [view, setView] = useState<View>('loading');
  const [me, setMe] = useState<Cultivator | null>(null);
  const [roster, setRoster] = useState<Cultivator[]>([]);
  const [history, setHistory] = useState<BattleLogRow[]>([]);
  const [idleBanner, setIdleBanner] = useState<{ exp: number; spiritStones: number; hours: number } | null>(null);
  const [activeBattle, setActiveBattle] = useState<{ log: LogEntry[]; winnerId: string; winnerName: string; attackerName: string; defenderName: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [popups, setPopups] = useState<{ id: number; text: string; color: string }[]>([]);
  const [liveOffset, setLiveOffset] = useState({ exp: 0, stones: 0 });
  const dirtyRef = useRef(false);
  const meRef = useRef<Cultivator | null>(null);
  const popupIdRef = useRef(0);

  const popFloatingText = useCallback((text: string, color: string) => {
    const id = ++popupIdRef.current;
    setPopups((prev) => [...prev, { id, text, color }]);
    setTimeout(() => setPopups((prev) => prev.filter((p) => p.id !== id)), 1400);
  }, []);

  // ─── Init ───
  useEffect(() => {
    if (!user) {
      setView('login');
      return;
    }
    let cancelled = false;
    (async () => {
      setView('loading');
      const c = await loadOrCreateMyCultivator(user.id, user.name);
      const gains = computeIdleGains(c);
      const updated = gains.exp > 0 || gains.spiritStones > 0 ? applyIdleGains(c, gains) : c;
      if (updated !== c) await saveCultivator(updated);
      if (cancelled) return;
      setMe(updated);
      if (gains.exp > 0 || gains.spiritStones > 0) setIdleBanner(gains);
      setView('dashboard');
    })();
    return () => { cancelled = true; };
  }, [user]);

  const refreshRoster = useCallback(async () => {
    if (!user) return;
    setRosterLoading(true);
    const list = await loadRoster(user.id);
    setRoster(list);
    setRosterLoading(false);
  }, [user]);

  const refreshHistory = useCallback(async () => {
    if (!user) return;
    const logs = await loadMyBattleLogs(user.id);
    setHistory(logs);
  }, [user]);

  const persist = useCallback(async (next: Cultivator) => {
    setMe(next);
    await saveCultivator(next);
  }, []);

  useEffect(() => { meRef.current = me; }, [me]);

  // ─── Live per-second ticking while the page stays open. `liveOffset` is the fractional
  // amount accrued since the last whole-unit crossing — it updates every tick so the
  // progress bar visibly creeps forward continuously; whole units fold into the real
  // integer `me` state (what actually gets saved) and trigger a floating "+N" popup. ───
  useEffect(() => {
    if (!me) return;
    const tick = setInterval(() => {
      const base = meRef.current;
      if (!base) return;
      const { expPerSecond, stonesPerSecond } = liveRatesFor(base);
      // Always pop a tiny "+0.02" style number every second so gains never look frozen,
      // even when the underlying rate is well below 1/sec — separate from the whole-unit
      // fold below, which is what actually gets persisted to `me`/saved.
      if (expPerSecond > 0) popFloatingText(`+${formatLiveGain(expPerSecond)} 修为`, 'text-amber-400');
      if (stonesPerSecond > 0) popFloatingText(`+${formatLiveGain(stonesPerSecond)} 灵石`, 'text-emerald-400');
      setLiveOffset((prev) => {
        const nextExp = prev.exp + expPerSecond;
        const nextStones = prev.stones + stonesPerSecond;
        const wholeExp = Math.floor(nextExp);
        const wholeStones = Math.floor(nextStones);
        if (wholeExp > 0 || wholeStones > 0) {
          dirtyRef.current = true;
          setMe((prevMe) => prevMe ? {
            ...prevMe,
            exp: prevMe.exp + wholeExp,
            spiritStones: prevMe.spiritStones + wholeStones,
            lastCollectedAt: new Date().toISOString(),
          } : prevMe);
        }
        return { exp: nextExp - wholeExp, stones: nextStones - wholeStones };
      });
    }, 1000);
    return () => clearInterval(tick);
    // Intentionally keyed on ownerId only (via meRef for the latest snapshot) so the
    // interval isn't torn down/recreated on every tick's own state update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.ownerId, popFloatingText]);

  // ─── Throttled autosave for the live ticker (avoids a write every second) ───
  useEffect(() => {
    const flush = setInterval(() => {
      if (dirtyRef.current && meRef.current) {
        dirtyRef.current = false;
        saveCultivator(meRef.current);
      }
    }, 10000);
    return () => {
      clearInterval(flush);
      if (dirtyRef.current && meRef.current) saveCultivator(meRef.current);
    };
  }, []);

  // Display-only cultivator with the fractional live offset layered on top, purely for
  // smooth visual progress; all spending/affordance checks below use the real `me`.
  const displayMe = me ? { ...me, exp: me.exp + liveOffset.exp, spiritStones: me.spiritStones + liveOffset.stones } : null;
  const level = displayMe ? cultivatorLevel(displayMe) : 1;
  const realmName = displayMe ? cultivatorRealmName(displayMe) : '';
  const stats = displayMe ? cultivatorStats(displayMe) : null;
  const progress = displayMe ? expProgress(displayMe) : null;
  const displaySpiritStones = displayMe ? Math.floor(displayMe.spiritStones) : 0;

  // ─── Actions ───
  const handleBuy = (id: string) => {
    if (!me || busy) return;
    const result = buyTechnique(me, id);
    if (!result) return;
    setBusy(true);
    persist(result.cultivator).finally(() => setBusy(false));
    if (result.codexReward > 0) {
      popFloatingText(`图鉴解锁 +${result.codexReward} 灵石`, 'text-fuchsia-300');
    }
  };

  const handleRefreshMarket = () => {
    if (!me || busy) return;
    const next = refreshMarket(me);
    if (!next) return;
    setBusy(true);
    persist(next).finally(() => setBusy(false));
  };

  const handleUpgrade = (id: string) => {
    if (!me || busy) return;
    const next = upgradeTechnique(me, id);
    if (!next) return;
    setBusy(true);
    persist(next).finally(() => setBusy(false));
  };

  const handleToggleEquip = (id: string) => {
    if (!me || busy) return;
    const next = toggleEquipped(me, id);
    if (next === me) return;
    setBusy(true);
    persist(next).finally(() => setBusy(false));
  };

  const handleSell = (id: string) => {
    if (!me || busy) return;
    const next = sellTechnique(me, id);
    if (!next) return;
    setBusy(true);
    persist(next).finally(() => setBusy(false));
  };

  const handleUpgradeBuilding = (id: Parameters<typeof upgradeBuilding>[1]) => {
    if (!me || busy) return;
    const next = upgradeBuilding(me, id);
    if (!next) return;
    setBusy(true);
    persist(next).finally(() => setBusy(false));
  };

  const handleChallenge = async (opponent: Cultivator) => {
    if (!me || busy) return;
    setBusy(true);
    const result = await challengeCultivator(me, opponent);
    setBusy(false);
    if (!result) return;
    setActiveBattle({
      log: result.log,
      winnerId: result.winnerId,
      winnerName: result.winnerId === result.attackerId ? result.attackerName : result.defenderName,
      attackerName: result.attackerName,
      defenderName: result.defenderName,
    });
    setView('battle-result');
  };

  const viewHistoryEntry = (row: BattleLogRow) => {
    setActiveBattle({
      log: row.log,
      winnerId: row.winnerId,
      winnerName: row.winnerId === row.attackerId ? row.attackerName : row.defenderName,
      attackerName: row.attackerName,
      defenderName: row.defenderName,
    });
    setView('battle-result');
  };

  // ─── Login required ───
  if (view === 'login') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 px-4 text-center">
        <div className="text-5xl mb-4">☯️</div>
        <h2 className="text-lg text-slate-200 mb-2">修仙挂机对战</h2>
        <p className="text-sm text-slate-500 mb-6 max-w-sm">
          养成角色的数据需要保存到云端，与同事互相挑战，请先使用 GitHub 登录。
        </p>
        <div className="flex gap-3">
          <button
            onClick={signInWithGitHub}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium"
          >
            🔗 GitHub 登录
          </button>
          <button onClick={onExit} className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm">
            返回
          </button>
        </div>
      </div>
    );
  }

  if (view === 'loading' || !me || !stats || !progress) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-950 text-slate-400 text-sm">
        加载中…
      </div>
    );
  }

  // ─── Dashboard ───
  if (view === 'dashboard') {
    return (
      <div className="w-full h-full flex flex-col items-center bg-slate-950 overflow-auto py-4 px-4">
        <CultivationHeader title="☯️ 修仙挂机对战" onExit={onExit} />

        {idleBanner && (idleBanner.exp > 0 || idleBanner.spiritStones > 0) && (
          <div className="w-full max-w-md mb-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 text-sm text-emerald-300 flex items-center justify-between">
            <span>
              🧘 闭关 {idleBanner.hours.toFixed(1)} 小时，获得修为 +{idleBanner.exp}，灵石 +{idleBanner.spiritStones}
            </span>
            <button onClick={() => setIdleBanner(null)} className="text-emerald-400 hover:text-emerald-200 text-xs">✕</button>
          </div>
        )}

        <div className="w-full max-w-md bg-slate-900 rounded-2xl border border-slate-700 p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-lg font-bold text-slate-100">{me.name}</div>
              <div className="text-xs text-amber-400">{realmName} · Lv.{level}</div>
            </div>
            <div className="relative text-right text-sm text-slate-300">
              💎 灵石 <span className="font-bold text-slate-100">{displaySpiritStones}</span>
              {popups.filter((p) => p.color === 'text-emerald-400').map((p) => (
                <span key={p.id} className={`cultivation-float-popup ${p.color}`} style={{ right: 0, left: 'auto' }}>{p.text}</span>
              ))}
            </div>
          </div>

          <div className="relative mb-3">
            <div className="flex justify-between text-[11px] text-slate-500 mb-1">
              <span>修为</span>
              <span>{Math.floor(progress.current)} / {progress.needed}</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-[width] duration-1000 ease-linear"
                style={{ width: `${progress.pct}%` }}
              />
            </div>
            {popups.filter((p) => p.color === 'text-amber-400').map((p) => (
              <span key={p.id} className={`cultivation-float-popup ${p.color}`} style={{ left: '20%' }}>{p.text}</span>
            ))}
          </div>

          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="bg-slate-800/60 rounded-lg py-2">
              <div className="text-slate-500">气血</div>
              <div className="text-slate-200 font-medium">{stats.maxHp}</div>
            </div>
            <div className="bg-slate-800/60 rounded-lg py-2">
              <div className="text-slate-500">攻击</div>
              <div className="text-slate-200 font-medium">{stats.attack}</div>
            </div>
            <div className="bg-slate-800/60 rounded-lg py-2">
              <div className="text-slate-500">防御</div>
              <div className="text-slate-200 font-medium">{stats.defense}</div>
            </div>
            <div className="bg-slate-800/60 rounded-lg py-2">
              <div className="text-slate-500">速度</div>
              <div className="text-slate-200 font-medium">{stats.speed}</div>
            </div>
            <div className="bg-slate-800/60 rounded-lg py-2">
              <div className="text-slate-500">暴击率</div>
              <div className="text-rose-300 font-medium">{(stats.critRate * 100).toFixed(1)}%</div>
            </div>
            <div className="bg-slate-800/60 rounded-lg py-2">
              <div className="text-slate-500">暴击伤害</div>
              <div className="text-rose-300 font-medium">{(stats.critDamage * 100).toFixed(0)}%</div>
            </div>
            <div className="bg-slate-800/60 rounded-lg py-2">
              <div className="text-slate-500">闪避率</div>
              <div className="text-sky-300 font-medium">{(stats.dodgeRate * 100).toFixed(1)}%</div>
            </div>
            <div className="bg-slate-800/60 rounded-lg py-2">
              <div className="text-slate-500">命中率</div>
              <div className="text-sky-300 font-medium">{(stats.hitRate * 100).toFixed(1)}%</div>
            </div>
          </div>
          <p className="text-[10px] text-slate-600 mt-2 text-center">
            速度快的一方先手；命中率减去对方闪避率决定攻击是否命中。装备的功法按类型加成：拳/腿/掌/枪法→攻击+暴击伤害，指/剑法→攻击+暴击率，内功→气血+防御，身法→速度+闪避+命中。
          </p>
        </div>

        <div className="w-full max-w-md space-y-2.5">
          <button
            onClick={() => setView('market')}
            className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium flex items-center justify-between transition-colors"
          >
            <span>🏮 坊市</span>
            <span className="text-xs text-slate-400">在售 {me.market.offers.length} 门功法</span>
          </button>
          <button
            onClick={() => setView('techniques')}
            className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium flex items-center justify-between transition-colors"
          >
            <span>📜 已修功法</span>
            <span className="text-xs text-slate-400">已修 {me.techniques.length} · 已装备 {me.equipped.length}/{MAX_EQUIPPED}</span>
          </button>
          <button
            onClick={() => setView('codex')}
            className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium flex items-center justify-between transition-colors"
          >
            <span>📖 功法图鉴</span>
            <span className="text-xs text-slate-400">已收录 {me.codex.length}/{TECHNIQUES.length}</span>
          </button>
          <button
            onClick={() => setView('buildings')}
            className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium flex items-center justify-between transition-colors"
          >
            <span>🏗️ 建筑</span>
            <span className="text-xs text-slate-400">提升挂机效率</span>
          </button>
          <button
            onClick={() => { setView('roster'); refreshRoster(); }}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white font-medium flex items-center justify-between transition-colors"
          >
            <span>⚔️ 挑战同门</span>
            <span className="text-xs text-rose-100">异步对战</span>
          </button>
          <button
            onClick={() => { setView('history'); refreshHistory(); }}
            className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium flex items-center justify-between transition-colors"
          >
            <span>📖 对战日志</span>
            <span className="text-xs text-slate-400">历史记录</span>
          </button>
        </div>
      </div>
    );
  }

  // ─── 坊市 (Market) ───
  if (view === 'market') {
    return (
      <div className="w-full h-full flex flex-col items-center bg-slate-950 overflow-auto py-4 px-4">
        <CultivationHeader title="🏮 坊市" onBack={() => setView('dashboard')} onExit={onExit} />
        <div className="w-full max-w-md flex items-center justify-between mb-3">
          <p className="text-xs text-slate-500">
            境界越高，坊市刷出的功法品阶越高；帝阶及以上功法唯有晋入「武帝」境才会现世。
          </p>
        </div>
        <button
          onClick={handleRefreshMarket}
          disabled={busy || me.spiritStones < MARKET_REFRESH_COST}
          className="w-full max-w-md mb-3 text-xs px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white font-medium transition-colors"
        >
          🔄 刷新坊市 ({MARKET_REFRESH_COST} 灵石)
        </button>
        {me.market.offers.length === 0 ? (
          <p className="text-sm text-slate-500 mt-8">坊市空空如也，刷新试试运气吧。</p>
        ) : (
          <div className="w-full max-w-md space-y-2.5 pb-4">
            {me.market.offers.map((id) => {
              const tq = TECHNIQUE_MAP[id];
              if (!tq) return null;
              const owned = me.techniques.some((t) => t.id === tq.id);
              const atCap = false;
              const cost = learnCostFor(tq.id);
              return (
                <div key={tq.id} className="rounded-xl border bg-slate-900 border-slate-700 p-3.5">
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <span className="text-sm font-bold text-slate-100">{tq.name}</span>
                      <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-800 ${RARITY_COLOR[tq.rarity]}`}>{tq.rarity}</span>
                      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{tq.type}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mb-2.5">{tq.description}</p>
                  <TechniqueStatPills techniqueId={tq.id} level={1} />
                  <button
                    onClick={() => handleBuy(tq.id)}
                    disabled={busy || owned || atCap || me.spiritStones < cost}
                    className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white transition-colors"
                  >
                    {owned ? '已修习' : atCap ? '修习上限，请先卖出' : `💎 购买习得 (${cost} 灵石)`}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─── 已修功法 (Owned techniques: upgrade/equip) ───
  if (view === 'techniques') {
    return (
      <div className="w-full h-full flex flex-col items-center bg-slate-950 overflow-auto py-4 px-4">
        <CultivationHeader title="📜 已修功法" onBack={() => setView('dashboard')} onExit={onExit} />
        <p className="text-xs text-slate-500 mb-3 max-w-md text-center">
          所有已修功法均提供被动属性加成（同类型只取最高品阶生效）。装备 {MAX_EQUIPPED} 门用于对战，帝阶以上功法附带特殊战斗效果（连击/复活/替死）。
        </p>
        {me.techniques.length === 0 ? (
          <p className="text-sm text-slate-500 mt-8">尚未修习任何功法，去坊市看看吧。</p>
        ) : (
          <div className="w-full max-w-md space-y-2.5 pb-4">
            {me.techniques.map((owned) => {
              const tq = TECHNIQUE_MAP[owned.id];
              if (!tq) return null;
              const isEquipped = me.equipped.includes(tq.id);
              const upgradeCost = upgradeCostFor(tq.id, owned.level);

              return (
                <div key={tq.id} className="rounded-xl border bg-slate-900 border-slate-700 p-3.5">
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <span className="text-sm font-bold text-slate-100">{tq.name}</span>
                      <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-800 ${RARITY_COLOR[tq.rarity]}`}>{tq.rarity}</span>
                      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{tq.type}</span>
                      <span className="ml-2 text-[10px] text-amber-400">Lv.{owned.level}/{tq.maxLevel}</span>
                    </div>
                    {isEquipped && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-600/30 text-emerald-300 border border-emerald-500/40">已装备</span>}
                  </div>
                  <p className="text-xs text-slate-500 mb-2.5">{tq.description}</p>
                  <TechniqueStatPills techniqueId={tq.id} level={owned.level} />

                  <div className="flex gap-2">
                    {owned.level < tq.maxLevel && (
                      <button
                        onClick={() => handleUpgrade(tq.id)}
                        disabled={busy || me.spiritStones < upgradeCost}
                        className="text-xs px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-slate-200 transition-colors"
                      >
                        ⬆️ 升级 ({upgradeCost} 灵石)
                      </button>
                    )}
                    <button
                      onClick={() => handleToggleEquip(tq.id)}
                      disabled={busy || (!isEquipped && me.equipped.length >= MAX_EQUIPPED)}
                      className={`text-xs px-3 py-1.5 rounded-lg disabled:opacity-30 transition-colors ${
                        isEquipped ? 'bg-red-900/40 hover:bg-red-900/60 text-red-300' : 'bg-emerald-700/40 hover:bg-emerald-700/60 text-emerald-300'
                      }`}
                    >
                      {isEquipped ? '卸下' : '装备'}
                    </button>
                    <button
                      onClick={() => handleSell(tq.id)}
                      disabled={busy}
                      className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-400 transition-colors ml-auto"
                    >
                      卖出 (+{sellValueFor(tq.id, owned.level)} 灵石)
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─── 建筑 (Buildings) ───
  if (view === 'buildings') {
    return (
      <div className="w-full h-full flex flex-col items-center bg-slate-950 overflow-auto py-4 px-4">
        <CultivationHeader title="🏗️ 建筑" onBack={() => setView('dashboard')} onExit={onExit} />
        <p className="text-xs text-slate-500 mb-3 max-w-md text-center">
          用灵石升级建筑，永久小幅提升挂机效率；等级越高造价越贵，可以一直投资下去。
        </p>
        <div className="w-full max-w-md space-y-2.5 pb-4">
          {BUILDINGS.map((b) => {
            const lvl = buildingLevel(me, b.id);
            const cost = buildingUpgradeCost(me, b.id);
            return (
              <div key={b.id} className="rounded-xl border bg-slate-900 border-slate-700 p-3.5">
                <div className="flex items-start justify-between mb-1">
                  <span className="text-sm font-bold text-slate-100">{b.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-amber-400">Lv.{lvl}</span>
                </div>
                <p className="text-xs text-slate-500 mb-2.5">{b.description}</p>
                <button
                  onClick={() => handleUpgradeBuilding(b.id)}
                  disabled={busy || me.spiritStones < cost}
                  className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white transition-colors"
                >
                  ⬆️ 升级 ({cost} 灵石)
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Roster ───
  if (view === 'roster') {
    return (
      <div className="w-full h-full flex flex-col items-center bg-slate-950 overflow-auto py-4 px-4">
        <CultivationHeader title="⚔️ 挑战同门" onBack={() => setView('dashboard')} onExit={onExit} />
        {rosterLoading ? (
          <p className="text-sm text-slate-500 mt-8">加载道友列表中…</p>
        ) : roster.length === 0 ? (
          <p className="text-sm text-slate-500 mt-8 text-center max-w-sm">暂无其他道友，邀请同事登录并进入本小游戏后即可在此挑战。</p>
        ) : (
          <div className="w-full max-w-md space-y-2.5 pb-4">
            {roster.map((r) => {
              const rLevel = cultivatorLevel(r);
              const rStats = cultivatorStats(r);
              const rRealm = realmForLevel(rLevel).name;
              return (
                <div key={r.ownerId} className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-sm font-medium text-slate-100">{r.name}</div>
                      <div className="text-xs text-amber-400">{rRealm} · Lv.{rLevel}</div>
                    </div>
                    <button
                      onClick={() => handleChallenge(r)}
                      disabled={busy}
                      className="text-xs px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-medium transition-colors"
                    >
                      {busy ? '对战中…' : '发起挑战'}
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-x-3 gap-y-0.5 text-[10px] text-slate-400">
                    <span>气血 <span className="text-slate-200">{rStats.maxHp}</span></span>
                    <span>攻击 <span className="text-slate-200">{rStats.attack}</span></span>
                    <span>防御 <span className="text-slate-200">{rStats.defense}</span></span>
                    <span>速度 <span className="text-slate-200">{rStats.speed}</span></span>
                    <span>暴击 <span className="text-slate-200">{(rStats.critRate * 100).toFixed(1)}%</span></span>
                    <span>暴伤 <span className="text-slate-200">{(rStats.critDamage * 100).toFixed(0)}%</span></span>
                    <span>闪避 <span className="text-slate-200">{(rStats.dodgeRate * 100).toFixed(1)}%</span></span>
                    <span>命中 <span className="text-slate-200">{(rStats.hitRate * 100).toFixed(0)}%</span></span>
                  </div>
                  {r.equipped.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {r.equipped.map((tid) => {
                        const t = TECHNIQUE_MAP[tid];
                        if (!t) return null;
                        return (
                          <span key={tid} className={`text-[9px] px-1.5 py-0.5 rounded bg-slate-800 ${RARITY_COLOR[t.rarity]}`}>
                            {t.name}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─── History ───
  if (view === 'history') {
    return (
      <div className="w-full h-full flex flex-col items-center bg-slate-950 overflow-auto py-4 px-4">
        <CultivationHeader title="📖 对战日志" onBack={() => setView('dashboard')} onExit={onExit} />
        {history.length === 0 ? (
          <p className="text-sm text-slate-500 mt-8">暂无对战记录</p>
        ) : (
          <div className="w-full max-w-md space-y-2 pb-4">
            {history.map((h) => {
              const won = h.winnerId === user?.id;
              return (
                <button
                  key={h.id}
                  onClick={() => viewHistoryEntry(h)}
                  className="w-full flex items-center justify-between bg-slate-900 hover:bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-left transition-colors"
                >
                  <div className="text-sm text-slate-200">
                    {h.attackerName} <span className="text-slate-500">vs</span> {h.defenderName}
                  </div>
                  <span className={`text-xs font-medium ${won ? 'text-emerald-400' : 'text-red-400'}`}>
                    {won ? '🏆 胜利' : '💀 落败'}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─── Battle result ───
  if (view === 'battle-result' && activeBattle) {
    const iWon = activeBattle.winnerId === user?.id;
    return (
      <div className="w-full h-full flex flex-col items-center bg-slate-950 overflow-auto py-4 px-4">
        <CultivationHeader title="⚔️ 战斗结算" onBack={() => setView('dashboard')} onExit={onExit} />

        <div className="w-full max-w-md text-center mb-4">
          <div className="text-3xl mb-1">{iWon ? '🎉' : '💥'}</div>
          <p className={`text-sm font-medium ${iWon ? 'text-emerald-400' : 'text-red-400'}`}>
            {activeBattle.attackerName} vs {activeBattle.defenderName} —— 胜者：{activeBattle.winnerName}
          </p>
        </div>

        <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-2 max-h-[60vh] overflow-y-auto">
          {activeBattle.log.map((entry, i) => (
            <div key={i} className="text-xs text-slate-300 border-b border-slate-800/60 pb-2 last:border-0">
              <span className="text-slate-600 mr-1">回合{entry.turn}·</span>
              {entry.text}
            </div>
          ))}
        </div>

        <button
          onClick={() => setView('dashboard')}
          className="mt-4 text-xs px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
        >
          返回主界面
        </button>
      </div>
    );
  }

  // ─── 功法图鉴 (Technique Codex) ───
  if (view === 'codex') {
    const codexSet = new Set(me.codex);
    const totalReward = TECHNIQUES.reduce((sum, t) => sum + (codexSet.has(t.id) ? CODEX_REWARD[t.rarity] : 0), 0);
    return (
      <div className="w-full h-full flex flex-col items-center bg-slate-950 overflow-auto py-4 px-4">
        <CultivationHeader title="📖 功法图鉴" onBack={() => setView('dashboard')} onExit={onExit} />
        <div className="w-full max-w-md mb-3 text-center">
          <p className="text-xs text-slate-500">
            首次习得功法可解锁图鉴并获得灵石奖励。已收录 {me.codex.length}/{TECHNIQUES.length} 部，累计获得 {totalReward} 灵石。
          </p>
        </div>
        <div className="w-full max-w-md space-y-4 pb-4">
          {RARITIES.map((rarity) => {
            const tierTechs = TECHNIQUES.filter((t) => t.rarity === rarity);
            if (tierTechs.length === 0) return null;
            const unlockedCount = tierTechs.filter((t) => codexSet.has(t.id)).length;
            return (
              <div key={rarity}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-bold ${RARITY_COLOR[rarity]}`}>{rarity}</span>
                  <span className="text-[10px] text-slate-500">{unlockedCount}/{tierTechs.length} · 解锁奖励 {CODEX_REWARD[rarity]} 灵石/部</span>
                </div>
                <div className="space-y-1.5">
                  {tierTechs.map((t) => {
                    const known = codexSet.has(t.id);
                    return (
                      <div
                        key={t.id}
                        className={`rounded-lg border p-2.5 ${known ? 'bg-slate-900 border-slate-700' : 'bg-slate-900/40 border-slate-800'}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium ${known ? 'text-slate-200' : 'text-slate-600'}`}>
                              {known ? t.name : '？？？'}
                            </span>
                            <span className="text-[9px] px-1 py-0.5 rounded bg-slate-800 text-slate-500">{t.type}</span>
                          </div>
                          <span className={`text-[10px] ${known ? 'text-emerald-400' : 'text-slate-600'}`}>
                            {known ? '✓ 已收录' : '🔒 未收录'}
                          </span>
                        </div>
                        {known && (
                          <p className="text-[10px] text-slate-500 mt-1">{t.description}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}
