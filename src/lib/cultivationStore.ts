import { supabase } from './supabase';
import {
  levelForExp, expForLevel, statsForLevel, idleRatesForLevel,
  realmForLevel, MAX_OFFLINE_HOURS, TECHNIQUE_MAP, MAX_EQUIPPED, MAX_OWNED_TECHNIQUES,
  rollMarketOffers, MARKET_REFRESH_COST, sellValueFor,
  type BuildingId, type BuildingLevels, DEFAULT_BUILDING_LEVELS,
  buildingCost, buildingRateMultiplier, SKY_WORKSHOP_WEIGHT_PER_LEVEL,
} from './cultivationData';
import type { OwnedTechnique, BattleFighter, BattleResult } from './cultivationBattle';
import { simulateBattle } from './cultivationBattle';

const CULTIVATORS_TABLE = 'cultivators';
const BATTLE_LOGS_TABLE = 'battle_logs';

export interface MarketState {
  offers: string[]; // technique ids currently purchasable in the 坊市
  refreshedAt: string;
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
    market: market && market.offers ? market : { offers: rollMarketOffers(levelForExp(exp), undefined, marketBonusFor(buildings)), refreshedAt: new Date().toISOString() },
    buildings,
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
    market: { offers: rollMarketOffers(1), refreshedAt: now },
    buildings: { ...DEFAULT_BUILDING_LEVELS },
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

/** Public roster of all cultivators (for the challenge list), excluding self. */
export async function loadRoster(excludeUserId: string): Promise<Cultivator[]> {
  const { data, error } = await supabase.from(CULTIVATORS_TABLE).select('*').neq('owner_id', excludeUserId);
  if (error) {
    console.error('[cultivation] loadRoster:', error);
    return [];
  }
  return (data || []).map(rowToCultivator);
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

export function cultivatorStats(c: Cultivator) {
  return statsForLevel(cultivatorLevel(c));
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
    .filter((t): t is OwnedTechnique => !!t)
    .slice(0, MAX_EQUIPPED);
  return {
    userId: c.ownerId,
    name: c.name,
    level,
    stats: statsForLevel(level),
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

/** Buy (learn) a technique that is currently listed in the cultivator's 坊市 offers. */
export function buyTechnique(c: Cultivator, techniqueId: string): Cultivator | null {
  const def = TECHNIQUE_MAP[techniqueId];
  if (!def) return null;
  if (!c.market.offers.includes(techniqueId)) return null;
  if (c.techniques.some((t) => t.id === techniqueId)) return null;
  if (c.techniques.length >= MAX_OWNED_TECHNIQUES) return null; // 已满，需先卖出一门
  const cost = learnCostFor(techniqueId);
  if (c.spiritStones < cost) return null;
  return {
    ...c,
    spiritStones: c.spiritStones - cost,
    techniques: [...c.techniques, { id: techniqueId, level: 1 }],
    market: { ...c.market, offers: c.market.offers.filter((id) => id !== techniqueId) },
  };
}

/** Sell an owned technique back for half its cumulative investment; frees up a slot under MAX_OWNED_TECHNIQUES. */
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
    market: { offers: rollMarketOffers(cultivatorLevel(c), undefined, marketBonusFor(c.buildings)), refreshedAt: new Date().toISOString() },
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
  if (c.equipped.length >= MAX_EQUIPPED) return c;
  return { ...c, equipped: [...c.equipped, techniqueId] };
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
    .limit(30);
  if (error) {
    console.error('[cultivation] loadMyBattleLogs:', error);
    return [];
  }
  return (data || []).map(rowToBattleLog);
}
