import { supabase } from './supabase';
import {
  levelForExp, expForLevel, statsForLevel, idleRatesForLevel,
  realmForLevel, MAX_OFFLINE_HOURS, TECHNIQUE_MAP,
  rollMarketOffers, MARKET_REFRESH_COST, CODEX_REWARD, sellValueFor,
  type BuildingId, type BuildingLevels, DEFAULT_BUILDING_LEVELS,
  buildingCost, buildingRateMultiplier, SKY_WORKSHOP_WEIGHT_PER_LEVEL,
  type StatKey,
  guardianNameForLevel, guardianStatsForLevel, guardianTechniqueForLevel,
  isBreakthroughLevel, rollAuctionItem, nextNpcBid, type AuctionItem,
} from './cultivationData';
import type { OwnedTechnique, BattleFighter, BattleResult } from './cultivationBattle';
import { simulateBattle } from './cultivationBattle';

const CULTIVATORS_TABLE = 'cultivators';
const BATTLE_LOGS_TABLE = 'battle_logs';

export interface MarketState {
  offers: string[]; // technique ids currently purchasable in the 坊市
  refreshedAt: string;
  auction: AuctionItem | null; // rare technique auction, occasionally available
}

export interface Cultivator {
  ownerId: string;
  name: string;
  exp: number;
  spiritStones: number;
  techniques: OwnedTechnique[];
  equipped: string[]; // technique ids, max MAX_EQUIPPED
  market: MarketState;
  buildings: BuildingLevels;
  /** Technique ids ever learned (persists even after selling) — drives the 功法图鉴. */
  codex: string[];
  lastCollectedAt: string; // ISO timestamp
  updatedAt: string;
}

function marketBonusFor(buildings: BuildingLevels): number {
  return (buildings['sky-workshop'] || 0) * SKY_WORKSHOP_WEIGHT_PER_LEVEL;
}

function rowToCultivator(row: Record<string, unknown>): Cultivator {
  const market = (row.market as MarketState | null) || null;
  const exp = Number(row.exp) || 0;
  const buildings: BuildingLevels = { ...DEFAULT_BUILDING_LEVELS, ...((row.buildings as Partial<BuildingLevels>) || {}) };
  return {
    ownerId: row.owner_id as string,
    name: (row.name as string) || '无名武者',
    exp,
    spiritStones: Number(row.spirit_stones) || 0,
    techniques: (row.techniques as OwnedTechnique[]) || [],
    equipped: (row.equipped as string[]) || [],
    market: market && market.offers ? { ...market, auction: (market as MarketState).auction ?? null } : { offers: rollMarketOffers(levelForExp(exp), undefined, marketBonusFor(buildings)), refreshedAt: new Date().toISOString(), auction: null },
    buildings,
    codex: (row.codex as string[]) || [],
    lastCollectedAt: (row.last_collected_at as string) || new Date().toISOString(),
    updatedAt: (row.updated_at as string) || new Date().toISOString(),
  };
}

function cultivatorToRow(c: Cultivator): Record<string, unknown> {
  return {
    owner_id: c.ownerId,
    name: c.name,
    exp: c.exp,
    spirit_stones: c.spiritStones,
    techniques: c.techniques,
    equipped: c.equipped,
    market: c.market,
    buildings: c.buildings,
    codex: c.codex,
    last_collected_at: c.lastCollectedAt,
    updated_at: new Date().toISOString(),
  };
}

function freshCultivator(ownerId: string, name: string): Cultivator {
  const now = new Date().toISOString();
  return {
    ownerId,
    name,
    exp: 0,
    spiritStones: 50,
    techniques: [{ id: 'basic-strike', level: 1 }],
    equipped: ['basic-strike'],
    market: { offers: rollMarketOffers(1), refreshedAt: now, auction: null },
    buildings: { ...DEFAULT_BUILDING_LEVELS },
    codex: ['basic-strike'],
    lastCollectedAt: now,
    updatedAt: now,
  };
}

/** Load (or create) the current user's cultivator record. */
export async function loadOrCreateMyCultivator(userId: string, displayName: string): Promise<Cultivator> {
  const { data, error } = await supabase.from(CULTIVATORS_TABLE).select('*').eq('owner_id', userId).maybeSingle();
  if (error) console.error('[cultivation] loadMyCultivator:', error);
  if (data) return rowToCultivator(data);

  const fresh = freshCultivator(userId, displayName);
  const { error: insertErr } = await supabase.from(CULTIVATORS_TABLE).insert(cultivatorToRow(fresh));
  if (insertErr) console.error('[cultivation] createCultivator:', insertErr);
  return fresh;
}

export async function saveCultivator(c: Cultivator): Promise<boolean> {
  const { error } = await supabase.from(CULTIVATORS_TABLE).upsert(cultivatorToRow(c), { onConflict: 'owner_id' });
  if (error) {
    console.error('[cultivation] saveCultivator:', error);
    return false;
  }
  return true;
}

/** Public roster of all cultivators (for the challenge list), excluding self.
 *  Idle gains are computed on-the-fly for each cultivator so that offline players'
 *  stats (exp, level, spirit stones) appear up-to-date even if they haven't logged in. */
export async function loadRoster(excludeUserId: string): Promise<Cultivator[]> {
  const { data, error } = await supabase.from(CULTIVATORS_TABLE).select('*').neq('owner_id', excludeUserId);
  if (error) {
    console.error('[cultivation] loadRoster:', error);
    return [];
  }
  return (data || []).map(rowToCultivator).map((c) => {
    const gains = computeIdleGains(c);
    return gains.exp > 0 || gains.spiritStones > 0 ? applyIdleGains(c, gains) : c;
  });
}

// ─── Offline idle gains ───

export interface IdleGains {
  exp: number;
  spiritStones: number;
  hours: number;
}

export function computeIdleGains(c: Cultivator): IdleGains {
  const level = levelForExp(c.exp);
  const { expPerHour, stonesPerHour } = idleRatesForLevel(level);
  const elapsedMs = Date.now() - new Date(c.lastCollectedAt).getTime();
  const hours = Math.min(MAX_OFFLINE_HOURS, Math.max(0, elapsedMs / (1000 * 60 * 60)));
  const expMultiplier = buildingRateMultiplier(c.buildings['scripture-pavilion'] || 0);
  const stoneMultiplier = buildingRateMultiplier(c.buildings['spirit-hall'] || 0);
  return {
    exp: Math.floor(expPerHour * expMultiplier * hours),
    spiritStones: Math.floor(stonesPerHour * stoneMultiplier * hours),
    hours,
  };
}

/** Fractional per-second gain rates (building multipliers applied), used to animate live progress while the page stays open. */
export function liveRatesFor(c: Cultivator): { expPerSecond: number; stonesPerSecond: number } {
  const level = levelForExp(c.exp);
  const { expPerHour, stonesPerHour } = idleRatesForLevel(level);
  const expMultiplier = buildingRateMultiplier(c.buildings['scripture-pavilion'] || 0);
  const stoneMultiplier = buildingRateMultiplier(c.buildings['spirit-hall'] || 0);
  return {
    expPerSecond: (expPerHour * expMultiplier) / 3600,
    stonesPerSecond: (stonesPerHour * stoneMultiplier) / 3600,
  };
}

export function applyIdleGains(c: Cultivator, gains: IdleGains): Cultivator {
  return {
    ...c,
    exp: c.exp + gains.exp,
    spiritStones: c.spiritStones + gains.spiritStones,
    lastCollectedAt: new Date().toISOString(),
  };
}

// ─── Derived view helpers ───

export function cultivatorLevel(c: Cultivator): number {
  return levelForExp(c.exp);
}

export function cultivatorRealmName(c: Cultivator): string {
  return realmForLevel(cultivatorLevel(c)).name;
}

/**
 * Passive stat bonuses from ALL owned techniques — not just equipped ones.
 * For each technique type (拳法/剑法/内功 etc.), only the highest-rarity owned technique
 * contributes its bonus. This prevents infinite stacking while still rewarding collection
 * and progression to higher-rarity techniques.
 *   拳/腿/掌/枪法 (power strikes)  → attack, crit damage
 *   指/剑法 (precision strikes)   → attack, crit rate
 *   内功 (internal power)         → max HP, defense
 *   身法 (footwork)               → speed, dodge rate, hit rate
 */
const PASSIVE_STAT_SCALE = 0.12;
const PASSIVE_RATE_SCALE = 0.03;

interface StatBonuses {
  attackMult: number;
  defenseMult: number;
  maxHpMult: number;
  speedMult: number;
  critRateAdd: number;
  critDamageAdd: number;
  dodgeRateAdd: number;
  hitRateAdd: number;
}

function applyStatDelta(bonus: StatBonuses, stat: StatKey, amount: number): void {
  switch (stat) {
    case 'attack': bonus.attackMult += amount; break;
    case 'defense': bonus.defenseMult += amount; break;
    case 'maxHp': bonus.maxHpMult += amount; break;
    case 'speed': bonus.speedMult += amount; break;
    case 'critRate': bonus.critRateAdd += amount; break;
    case 'critDamage': bonus.critDamageAdd += amount; break;
    case 'dodgeRate': bonus.dodgeRateAdd += amount; break;
    case 'hitRate': bonus.hitRateAdd += amount; break;
  }
}

const RATE_STATS: ReadonlySet<StatKey> = new Set(['critRate', 'critDamage', 'dodgeRate', 'hitRate']);

export function equippedStatBonuses(c: Cultivator): StatBonuses {
  const bonus: StatBonuses = {
    attackMult: 1, defenseMult: 1, maxHpMult: 1, speedMult: 1,
    critRateAdd: 0, critDamageAdd: 0, dodgeRateAdd: 0, hitRateAdd: 0,
  };
  for (const owned of c.techniques) {
    const tqDef = TECHNIQUE_MAP[owned.id];
    if (!tqDef) continue;
    const power = tqDef.baseMultiplier + tqDef.multiplierPerLevel * (owned.level - 1);
    const statPower = power * PASSIVE_STAT_SCALE;
    const ratePower = power * PASSIVE_RATE_SCALE;
    switch (tqDef.type) {
      case '内功':
        bonus.maxHpMult += statPower;
        bonus.defenseMult += statPower;
        break;
      case '身法':
        bonus.speedMult += statPower;
        bonus.dodgeRateAdd += ratePower;
        bonus.hitRateAdd += ratePower * 0.5;
        break;
      case '指法':
      case '剑法':
        bonus.attackMult += statPower;
        bonus.critRateAdd += ratePower;
        break;
      default:
        bonus.attackMult += statPower;
        bonus.critDamageAdd += ratePower * 1.5;
    }
    if (tqDef.drawback) {
      const magnitude = (RATE_STATS.has(tqDef.drawback.stat) ? ratePower : statPower) * tqDef.drawback.strength;
      applyStatDelta(bonus, tqDef.drawback.stat, -magnitude);
    }
  }
  return bonus;
}

export interface TechniqueStatEntry {
  label: string;
  value: string;
  positive: boolean;
}

const STAT_LABELS: Record<StatKey, string> = {
  attack: '攻击', defense: '防御', maxHp: '气血', speed: '速度',
  critRate: '暴击率', critDamage: '暴击伤害', dodgeRate: '闪避率', hitRate: '命中率',
};

/**
 * Human-readable breakdown of the passive stat swing a technique grants (and any drawback it
 * carries) while equipped at the given level — used to show "究竟提升了什么数值" in the UI,
 * independent of whether it's actually equipped or even learned yet.
 */
export function techniqueStatPreview(techniqueId: string, level: number): TechniqueStatEntry[] {
  const tqDef = TECHNIQUE_MAP[techniqueId];
  if (!tqDef) return [];
  const power = tqDef.baseMultiplier + tqDef.multiplierPerLevel * (level - 1);
  const statPower = power * PASSIVE_STAT_SCALE;
  const ratePower = power * PASSIVE_RATE_SCALE;
  const bonus: Partial<Record<StatKey, number>> = {};
  const add = (stat: StatKey, amount: number) => { bonus[stat] = (bonus[stat] ?? 0) + amount; };

  switch (tqDef.type) {
    case '内功':
      add('maxHp', statPower);
      add('defense', statPower);
      break;
    case '身法':
      add('speed', statPower);
      add('dodgeRate', ratePower);
      add('hitRate', ratePower * 0.5);
      break;
    case '指法':
    case '剑法':
      add('attack', statPower);
      add('critRate', ratePower);
      break;
    default:
      add('attack', statPower);
      add('critDamage', ratePower * 1.5);
  }
  if (tqDef.drawback) {
    const magnitude = (RATE_STATS.has(tqDef.drawback.stat) ? ratePower : statPower) * tqDef.drawback.strength;
    add(tqDef.drawback.stat, -magnitude);
  }

  return (Object.entries(bonus) as [StatKey, number][])
    .filter(([, amount]) => Math.abs(amount) > 1e-9)
    .map(([stat, amount]) => ({
      label: STAT_LABELS[stat],
      value: `${amount > 0 ? '+' : ''}${(amount * 100).toFixed(1)}%`,
      positive: amount > 0,
    }));
}

export function cultivatorStats(c: Cultivator) {
  const base = statsForLevel(cultivatorLevel(c));
  const bonus = equippedStatBonuses(c);
  return {
    maxHp: Math.round(base.maxHp * bonus.maxHpMult),
    attack: Math.round(base.attack * bonus.attackMult),
    defense: Math.round(base.defense * bonus.defenseMult),
    speed: Math.round(base.speed * bonus.speedMult),
    critRate: Math.min(0.75, base.critRate + bonus.critRateAdd),
    critDamage: base.critDamage + bonus.critDamageAdd,
    dodgeRate: Math.min(0.6, base.dodgeRate + bonus.dodgeRateAdd),
    hitRate: Math.min(0.99, base.hitRate + bonus.hitRateAdd),
  };
}

export function expProgress(c: Cultivator): { current: number; needed: number; pct: number } {
  const level = cultivatorLevel(c);
  const floor = expForLevel(level);
  const ceil = expForLevel(level + 1);
  const current = c.exp - floor;
  const needed = ceil - floor;
  return { current, needed, pct: needed > 0 ? Math.min(100, Math.round((current / needed) * 100)) : 100 };
}

export function toBattleFighter(c: Cultivator): BattleFighter {
  const level = cultivatorLevel(c);
  const equipped: OwnedTechnique[] = c.equipped
    .map((id) => c.techniques.find((t) => t.id === id))
    .filter((t): t is OwnedTechnique => !!t);
  return {
    userId: c.ownerId,
    name: c.name,
    level,
    stats: cultivatorStats(c),
    equipped,
  };
}

// ─── 坊市 (Market): buy / refresh ───

export function learnCostFor(techniqueId: string): number {
  return TECHNIQUE_MAP[techniqueId]?.learnCost ?? 0;
}

export function upgradeCostFor(techniqueId: string, currentLevel: number): number {
  const def = TECHNIQUE_MAP[techniqueId];
  if (!def) return Infinity;
  return def.upgradeCost * currentLevel;
}

/** Buy (learn) a technique that is currently listed in the cultivator's 坊市 offers.
 *  First-time learning of a technique also grants a one-time 图鉴解锁 spirit stone reward.
 *  No limit on how many techniques a cultivator can own — all learned techniques contribute
 *  passive bonuses (highest rarity per type counts) and persist forever. */
export function buyTechnique(c: Cultivator, techniqueId: string): { cultivator: Cultivator; codexReward: number } | null {
  const def = TECHNIQUE_MAP[techniqueId];
  if (!def) return null;
  if (!c.market.offers.includes(techniqueId)) return null;
  if (c.techniques.some((t) => t.id === techniqueId)) return null;
  const cost = learnCostFor(techniqueId);
  if (c.spiritStones < cost) return null;
  const alreadyInCodex = c.codex.includes(techniqueId);
  const codexReward = alreadyInCodex ? 0 : CODEX_REWARD[def.rarity];
  return {
    cultivator: {
      ...c,
      spiritStones: c.spiritStones - cost + codexReward,
      techniques: [...c.techniques, { id: techniqueId, level: 1 }],
      codex: alreadyInCodex ? c.codex : [...c.codex, techniqueId],
      market: { ...c.market, offers: c.market.offers.filter((id) => id !== techniqueId) },
    },
    codexReward,
  };
}

/** Sell an owned technique back for 50% of cumulative investment (learn cost + all upgrade costs). */
export function sellTechnique(c: Cultivator, techniqueId: string): Cultivator | null {
  const owned = c.techniques.find((t) => t.id === techniqueId);
  if (!owned) return null;
  const refund = sellValueFor(techniqueId, owned.level);
  return {
    ...c,
    spiritStones: c.spiritStones + refund,
    techniques: c.techniques.filter((t) => t.id !== techniqueId),
    equipped: c.equipped.filter((id) => id !== techniqueId),
  };
}

/** Re-roll the 坊市 offers (costs spirit stones, unlocked rarities scale with current level, 天工阁 boosts the top tier). */
export function refreshMarket(c: Cultivator): Cultivator | null {
  if (c.spiritStones < MARKET_REFRESH_COST) return null;
  return {
    ...c,
    spiritStones: c.spiritStones - MARKET_REFRESH_COST,
    market: { offers: rollMarketOffers(cultivatorLevel(c), undefined, marketBonusFor(c.buildings)), refreshedAt: new Date().toISOString(), auction: rollAuctionItem(cultivatorLevel(c)) },
  };
}

// ─── 建筑 (Buildings) ───

export function buildingLevel(c: Cultivator, id: BuildingId): number {
  return c.buildings[id] || 0;
}

export function buildingUpgradeCost(c: Cultivator, id: BuildingId): number {
  return buildingCost(id, buildingLevel(c, id));
}

export function upgradeBuilding(c: Cultivator, id: BuildingId): Cultivator | null {
  const cost = buildingUpgradeCost(c, id);
  if (c.spiritStones < cost) return null;
  return {
    ...c,
    spiritStones: c.spiritStones - cost,
    buildings: { ...c.buildings, [id]: buildingLevel(c, id) + 1 },
  };
}

export function upgradeTechnique(c: Cultivator, techniqueId: string): Cultivator | null {
  const def = TECHNIQUE_MAP[techniqueId];
  const owned = c.techniques.find((t) => t.id === techniqueId);
  if (!def || !owned) return null;
  if (owned.level >= def.maxLevel) return null;
  const cost = upgradeCostFor(techniqueId, owned.level);
  if (c.spiritStones < cost) return null;
  return {
    ...c,
    spiritStones: c.spiritStones - cost,
    techniques: c.techniques.map((t) => (t.id === techniqueId ? { ...t, level: t.level + 1 } : t)),
  };
}

export function toggleEquipped(c: Cultivator, techniqueId: string): Cultivator {
  const isEquipped = c.equipped.includes(techniqueId);
  if (isEquipped) {
    return { ...c, equipped: c.equipped.filter((id) => id !== techniqueId) };
  }
  return { ...c, equipped: [...c.equipped, techniqueId] };
}

// ─── 境界突破守关 (Breakthrough Guardian Challenge) ───

export interface BreakthroughChallenge {
  guardianName: string;
  guardianLevel: number;
  result: BattleResult;
  success: boolean;
}

/**
 * Attempt a breakthrough challenge. If the player's next level crosses into a breakthrough realm,
 * they must defeat an NPC guardian. On success, exp is set to the threshold for the next level.
 * On failure, 10% of current exp (above the current level floor) is lost.
 */
export function attemptBreakthrough(c: Cultivator): BreakthroughChallenge | null {
  const level = cultivatorLevel(c);
  const nextLevel = level + 1;
  if (!isBreakthroughLevel(nextLevel)) return null;

  const expNeeded = expForLevel(nextLevel);
  if (c.exp < expNeeded) return null; // not enough exp to attempt

  const guardianName = guardianNameForLevel(nextLevel);
  const guardianStats = guardianStatsForLevel(nextLevel);
  const guardianTechId = guardianTechniqueForLevel(nextLevel);

  const playerFighter = toBattleFighter(c);
  const guardianFighter: BattleFighter = {
    userId: 'guardian',
    name: guardianName,
    level: nextLevel,
    stats: guardianStats,
    equipped: [{ id: guardianTechId, level: 1 }],
  };

  const result = simulateBattle(playerFighter, guardianFighter);
  const success = result.winnerId === c.ownerId;

  return {
    guardianName,
    guardianLevel: nextLevel,
    result,
    success,
  };
}

/** Apply the result of a successful breakthrough — sets exp to the next level threshold. */
export function applyBreakthroughSuccess(c: Cultivator, challenge: BreakthroughChallenge): Cultivator {
  const nextLevel = challenge.guardianLevel;
  return {
    ...c,
    exp: expForLevel(nextLevel),
  };
}

/** Apply the result of a failed breakthrough — lose 10% of progress toward next level. */
export function applyBreakthroughFailure(c: Cultivator): Cultivator {
  const level = cultivatorLevel(c);
  const floor = expForLevel(level);
  const progress = c.exp - floor;
  const loss = Math.round(progress * 0.1);
  return {
    ...c,
    exp: Math.max(floor, c.exp - loss),
  };
}

// ─── 坊市拍卖 (Auction Bidding) ───

/**
 * Player places a bid on the auction item. The bid must be higher than currentBid.
 * After the player bids, an NPC may counter-bid (raising the price further).
 * Returns the updated cultivator (with new auction state) or null if bid fails.
 */
export function placeAuctionBid(c: Cultivator, amount: number): { cultivator: Cultivator; npcBid: { name: string; amount: number } | null } | null {
  if (!c.market.auction) return null;
  const auction = c.market.auction;
  if (amount <= auction.currentBid) return null;
  if (c.spiritStones < amount) return null;

  // NPC may counter-bid
  const npcBid = nextNpcBid(amount, auction.basePrice);

  if (npcBid) {
    // NPC outbids the player — auction continues with higher price
    const newAuction: AuctionItem = {
      ...auction,
      currentBid: npcBid.amount,
      bidHistory: [...auction.bidHistory, { name: '你', amount }, npcBid],
    };
    return {
      cultivator: { ...c, market: { ...c.market, auction: newAuction } },
      npcBid,
    };
  }

  // Player wins the auction — buy the technique
  const def = TECHNIQUE_MAP[auction.techniqueId];
  if (!def) return null;
  const alreadyOwned = c.techniques.some((t) => t.id === auction.techniqueId);
  const alreadyInCodex = c.codex.includes(auction.techniqueId);
  const codexReward = alreadyInCodex ? 0 : CODEX_REWARD[def.rarity];

  const newTechniques = alreadyOwned
    ? c.techniques
    : [...c.techniques, { id: auction.techniqueId, level: 1 }];
  const newCodex = alreadyInCodex ? c.codex : [...c.codex, auction.techniqueId];

  return {
    cultivator: {
      ...c,
      spiritStones: c.spiritStones - amount + codexReward,
      techniques: newTechniques,
      codex: newCodex,
      market: { ...c.market, auction: null },
    },
    npcBid: null,
  };
}

// ─── Battle logs ───

export interface BattleLogRow {
  id: string;
  attackerId: string;
  attackerName: string;
  defenderId: string;
  defenderName: string;
  winnerId: string;
  log: BattleResult['log'];
  createdAt: string;
}

function rowToBattleLog(row: Record<string, unknown>): BattleLogRow {
  return {
    id: row.id as string,
    attackerId: row.attacker_id as string,
    attackerName: (row.attacker_name as string) || '',
    defenderId: row.defender_id as string,
    defenderName: (row.defender_name as string) || '',
    winnerId: row.winner_id as string,
    log: (row.log as BattleResult['log']) || [],
    createdAt: row.created_at as string,
  };
}

export async function challengeCultivator(attacker: Cultivator, defender: Cultivator): Promise<BattleLogRow | null> {
  const result = simulateBattle(toBattleFighter(attacker), toBattleFighter(defender));
  const row = {
    attacker_id: attacker.ownerId,
    attacker_name: attacker.name,
    defender_id: defender.ownerId,
    defender_name: defender.name,
    winner_id: result.winnerId,
    log: result.log,
  };
  const { data, error } = await supabase.from(BATTLE_LOGS_TABLE).insert(row).select().single();
  if (error) {
    console.error('[cultivation] challengeCultivator:', error);
    return null;
  }
  return rowToBattleLog(data);
}

export async function loadMyBattleLogs(userId: string): Promise<BattleLogRow[]> {
  const { data, error } = await supabase
    .from(BATTLE_LOGS_TABLE)
    .select('*')
    .or(`attacker_id.eq.${userId},defender_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) {
    console.error('[cultivation] loadMyBattleLogs:', error);
    return [];
  }
  return (data || []).map(rowToBattleLog);
}
