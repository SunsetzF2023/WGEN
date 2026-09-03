// Static game content for the 武道挂机对战 (Idle Martial-Dao Battle) mini-game.
// All numbers are tuned for a small "office colleagues" casual idle game,
// not for rigorous game-economy balance.

export type TechniqueType = '拳法' | '腿法' | '掌法' | '指法' | '身法' | '枪法' | '剑法' | '内功';

/** Special battle effects only available on 帝阶 and above techniques when equipped in one of the 3 battle slots. */
export type BattleEffect =
  | { kind: 'combo'; chance: number }       // 连击: chance to attack twice in one turn
  | { kind: 'revive'; chance: number; healPct: number } // 复活: chance to revive with healPct of max HP on death
  | { kind: 'shield'; chance: number; absorbPct: number }; // 替死: chance to absorb a lethal blow as a shield

export type Rarity = '黄阶' | '人阶' | '地阶' | '天阶' | '帝阶' | '神阶' | '仙阶';

export const RARITIES: Rarity[] = ['黄阶', '人阶', '地阶', '天阶', '帝阶', '神阶', '仙阶'];

export const RARITY_COLOR: Record<Rarity, string> = {
  黄阶: 'text-slate-300',
  人阶: 'text-emerald-400',
  地阶: 'text-sky-400',
  天阶: 'text-violet-400',
  帝阶: 'text-amber-400',
  神阶: 'text-rose-400',
  仙阶: 'text-fuchsia-300',
};

/** Roll weight of each rarity when the 坊市 (market) generates new offers. */
export const RARITY_WEIGHT: Record<Rarity, number> = {
  黄阶: 45,
  人阶: 26,
  地阶: 15,
  天阶: 8,
  帝阶: 3.5,
  神阶: 1.5,
  仙阶: 0.5,
};

export type StatKey = 'attack' | 'defense' | 'maxHp' | 'speed' | 'critRate' | 'critDamage' | 'dodgeRate' | 'hitRate';

export interface Technique {
  id: string;
  name: string;
  type: TechniqueType;
  rarity: Rarity;
  description: string;
  /** Damage multiplier applied to attacker's ATK at technique level 1 */
  baseMultiplier: number;
  /** Extra multiplier added per level above 1 */
  multiplierPerLevel: number;
  /** Spirit stones required to learn at level 1 */
  learnCost: number;
  /** Spirit stones required to upgrade from level N to N+1 = upgradeCost * N */
  upgradeCost: number;
  maxLevel: number;
  /**
   * Some aggressive/risky techniques trade part of their power away from a second stat
   * while equipped — e.g. an all-out offense style that leaves your guard open. `strength`
   * is relative to the technique's own passive bonus scale (1.0 = as strong as the gain).
   */
  drawback?: { stat: StatKey; strength: number };
  /** Special battle effect (only 帝阶 and above). Only active when equipped in a battle slot. */
  battleEffect?: BattleEffect;
}

const RAW_TECHNIQUES: Technique[] = [
  // ─── 黄阶：坊市常见货色，人人可学 ───
  {
    id: 'basic-strike', name: '黑虎掏心拳', type: '拳法', rarity: '黄阶',
    description: '坊市地摊货，胜在朴实无华，出手迅捷。',
    baseMultiplier: 1.0, multiplierPerLevel: 0.06, learnCost: 0, upgradeCost: 15, maxLevel: 10,
  },
  {
    id: 'iron-cloth', name: '铁布衫', type: '内功', rarity: '黄阶',
    description: '强横外功，卖相不佳但耐揍。',
    baseMultiplier: 0.9, multiplierPerLevel: 0.06, learnCost: 20, upgradeCost: 15, maxLevel: 10,
  },
  {
    id: 'gale-leg', name: '烈风扫叶腿', type: '腿法', rarity: '黄阶',
    description: '腿法凌厉，招式简单却很实用。',
    baseMultiplier: 1.05, multiplierPerLevel: 0.07, learnCost: 30, upgradeCost: 18, maxLevel: 10,
  },
  // ─── 人阶：武者境以上开始能压得住场子 ───
  {
    id: 'poxue-spear', name: '破军七杀枪', type: '枪法', rarity: '人阶',
    description: '军中流传的枪法，一往无前，攻势凌厉。',
    baseMultiplier: 1.3, multiplierPerLevel: 0.10, learnCost: 90, upgradeCost: 35, maxLevel: 10,
  },
  {
    id: 'shadowless-step', name: '无影迷踪步', type: '身法', rarity: '人阶',
    description: '身法诡异难测，出手前先隐没身形。',
    baseMultiplier: 1.15, multiplierPerLevel: 0.09, learnCost: 110, upgradeCost: 40, maxLevel: 10,
  },
  {
    id: 'dragon-elephant', name: '龙象般若功', type: '内功', rarity: '人阶',
    description: '力大如龙象，一拳一脚皆有千钧之力。',
    baseMultiplier: 1.35, multiplierPerLevel: 0.11, learnCost: 130, upgradeCost: 45, maxLevel: 10,
  },
  // ─── 地阶：武师、大武师才压得住 ───
  {
    id: 'nine-yin-claw', name: '九阴白骨爪', type: '指法', rarity: '地阶',
    description: '阴狠毒辣的指法，一旦得手伤势极难恢复，然专攻不守，防御略有下降。',
    baseMultiplier: 1.55, multiplierPerLevel: 0.13, learnCost: 260, upgradeCost: 80, maxLevel: 10,
    drawback: { stat: 'defense', strength: 0.6 },
  },
  {
    id: 'thousand-hammer-palm', name: '千锤百炼掌', type: '掌法', rarity: '地阶',
    description: '掌力如山，招招砸实，破防极强。',
    baseMultiplier: 1.5, multiplierPerLevel: 0.12, learnCost: 240, upgradeCost: 75, maxLevel: 10,
  },
  {
    id: 'flowing-cloud-sword', name: '流云无痕剑诀', type: '剑法', rarity: '地阶',
    description: '剑意如行云流水，连绵不绝。',
    baseMultiplier: 1.6, multiplierPerLevel: 0.13, learnCost: 280, upgradeCost: 85, maxLevel: 10,
  },
  // ─── 天阶：武宗、大武宗方能驾驭 ───
  {
    id: 'thunder-emperor-fist', name: '九霄雷帝真拳', type: '拳法', rarity: '天阶',
    description: '拳意与天雷共鸣，出拳伴随滚滚雷鸣。',
    baseMultiplier: 1.9, multiplierPerLevel: 0.16, learnCost: 620, upgradeCost: 180, maxLevel: 10,
  },
  {
    id: 'nine-heavens-step', name: '九霄凌云步', type: '身法', rarity: '天阶',
    description: '身法通玄，一步可踏碎虚空涟漪。',
    baseMultiplier: 1.75, multiplierPerLevel: 0.15, learnCost: 580, upgradeCost: 170, maxLevel: 10,
  },
  {
    id: 'heaven-swallow-spear', name: '吞天枪诀', type: '枪法', rarity: '天阶',
    description: '枪势如欲吞天，锐不可当。',
    baseMultiplier: 2.0, multiplierPerLevel: 0.17, learnCost: 700, upgradeCost: 200, maxLevel: 10,
  },
  // ─── 帝阶：唯有武王及以上、且需晋入武帝才会现于坊市 ───
  {
    id: 'sovereign-annihilation-fist', name: '大帝灭世拳', type: '拳法', rarity: '帝阶',
    description: '一拳出，天地失色，唯武帝方可窥其全貌，然全力一击后门户大开，防御大幅下降。',
    baseMultiplier: 2.5, multiplierPerLevel: 0.22, learnCost: 1600, upgradeCost: 420, maxLevel: 10,
    drawback: { stat: 'defense', strength: 0.8 },
    battleEffect: { kind: 'combo', chance: 0.25 },
  },
  {
    id: 'imperial-sun-scripture', name: '帝曜太阳真经', type: '内功', rarity: '帝阶',
    description: '炼体成日，气血如朝阳生生不息。',
    baseMultiplier: 2.3, multiplierPerLevel: 0.20, learnCost: 1500, upgradeCost: 400, maxLevel: 10,
    battleEffect: { kind: 'revive', chance: 0.3, healPct: 0.3 },
  },
  {
    id: 'nether-sovereign-blade', name: '幽冥帝刀', type: '剑法', rarity: '帝阶',
    description: '刀出幽冥，斩尽因果，帝阶凶名远扬。',
    baseMultiplier: 2.6, multiplierPerLevel: 0.23, learnCost: 1700, upgradeCost: 450, maxLevel: 10,
    battleEffect: { kind: 'shield', chance: 0.25, absorbPct: 0.4 },
  },
  // ─── 神阶：武尊往上才配得上的威能 ───
  {
    id: 'god-slaying-spear', name: '弑神枪', type: '枪法', rarity: '神阶',
    description: '相传曾有武神折戟于此枪之下，然出枪讲究孤注一掷，身形因此滞涩，速度下降。',
    baseMultiplier: 3.2, multiplierPerLevel: 0.28, learnCost: 3800, upgradeCost: 900, maxLevel: 10,
    drawback: { stat: 'speed', strength: 0.7 },
    battleEffect: { kind: 'combo', chance: 0.35 },
  },
  {
    id: 'divine-devour-palm', name: '吞神噬魂掌', type: '掌法', rarity: '神阶',
    description: '掌心吞吐神念，被拍中者魂魄俱伤，然逆运神念亦反噬己身气血。',
    baseMultiplier: 3.0, multiplierPerLevel: 0.26, learnCost: 3500, upgradeCost: 850, maxLevel: 10,
    drawback: { stat: 'maxHp', strength: 0.5 },
    battleEffect: { kind: 'shield', chance: 0.3, absorbPct: 0.5 },
  },
  // ─── 仙阶：坊市传说，武皇亦难求 ───
  {
    id: 'immortal-ascension-scripture', name: '太清飞升仙诀', type: '内功', rarity: '仙阶',
    description: '习之若成，隐有飞升霞光自体表溢出。',
    baseMultiplier: 3.8, multiplierPerLevel: 0.34, learnCost: 8000, upgradeCost: 1800, maxLevel: 10,
    battleEffect: { kind: 'revive', chance: 0.5, healPct: 0.5 },
  },
  {
    id: 'immortal-severing-sword', name: '太虚斩仙剑诀', type: '剑法', rarity: '仙阶',
    description: '剑指九天，仙神亦不可挡其锋芒。',
    baseMultiplier: 4.0, multiplierPerLevel: 0.36, learnCost: 8500, upgradeCost: 1900, maxLevel: 10,
    battleEffect: { kind: 'combo', chance: 0.45 },
  },
  // ─── 补充：坊市里更常见的"凑数"功法，威力平平，多半是留着卖钱的 ───
  {
    id: 'sparrow-kick', name: '燕雀还巢腿', type: '腿法', rarity: '黄阶',
    description: '坊市摊位随手能买到，聊胜于无。',
    baseMultiplier: 0.85, multiplierPerLevel: 0.05, learnCost: 10, upgradeCost: 12, maxLevel: 10,
  },
  {
    id: 'stone-skin', name: '顽石淬体功', type: '内功', rarity: '黄阶',
    description: '练之全身如顽石，就是没什么灵性。',
    baseMultiplier: 0.8, multiplierPerLevel: 0.05, learnCost: 15, upgradeCost: 12, maxLevel: 10,
  },
  {
    id: 'copper-fist', name: '铜锤开山拳', type: '拳法', rarity: '黄阶',
    description: '坊市滞销款，威力平平但便宜量大。',
    baseMultiplier: 0.95, multiplierPerLevel: 0.06, learnCost: 5, upgradeCost: 12, maxLevel: 10,
  },
  {
    id: 'twin-blade-style', name: '迎风斩月剑', type: '剑法', rarity: '人阶',
    description: '略有章法的剑招，勉强算是登堂入室。',
    baseMultiplier: 1.1, multiplierPerLevel: 0.08, learnCost: 70, upgradeCost: 32, maxLevel: 10,
  },
  {
    id: 'iron-sand-palm', name: '铁砂掌', type: '掌法', rarity: '人阶',
    description: '练家子常备功法，物美价廉。',
    baseMultiplier: 1.2, multiplierPerLevel: 0.09, learnCost: 85, upgradeCost: 34, maxLevel: 10,
  },
  {
    id: 'swift-wind-step', name: '疾风迅影步', type: '身法', rarity: '人阶',
    description: '身法尚可，唬人有余，真打起来稍显花哨。',
    baseMultiplier: 1.1, multiplierPerLevel: 0.08, learnCost: 95, upgradeCost: 36, maxLevel: 10,
  },
  {
    id: 'black-tortoise-guard', name: '玄龟镇海功', type: '内功', rarity: '地阶',
    description: '以守代攻，寻常武师近身不得。',
    baseMultiplier: 1.4, multiplierPerLevel: 0.11, learnCost: 220, upgradeCost: 70, maxLevel: 10,
  },
  {
    id: 'crimson-blade-slash', name: '赤血饮魂斩', type: '剑法', rarity: '地阶',
    description: '一斩带三分血气，看着就凶，以血养剑，气血因此略有损耗。',
    baseMultiplier: 1.55, multiplierPerLevel: 0.12, learnCost: 250, upgradeCost: 78, maxLevel: 10,
    drawback: { stat: 'maxHp', strength: 0.4 },
  },
  {
    id: 'void-piercing-finger', name: '破空碎虚指', type: '指法', rarity: '天阶',
    description: '指劲可破空鸣响，宗师之姿初现。',
    baseMultiplier: 1.85, multiplierPerLevel: 0.15, learnCost: 640, upgradeCost: 185, maxLevel: 10,
  },
];

// Prices are scaled up from the raw table so they stay balanced against the
// boosted idle production rates below (see idleRatesForLevel). Kept in lockstep
// with the 8x income boost so affordability pace is unchanged — only the raw
// numbers (income AND price tags) read bigger.
const PRICE_MULTIPLIER = 16;

export const TECHNIQUES: Technique[] = RAW_TECHNIQUES.map((t) => ({
  ...t,
  learnCost: Math.round(t.learnCost * PRICE_MULTIPLIER),
  upgradeCost: Math.round(t.upgradeCost * PRICE_MULTIPLIER),
}));

export const TECHNIQUE_MAP: Record<string, Technique> = Object.fromEntries(
  TECHNIQUES.map((t) => [t.id, t])
);

/** One-time spirit stone reward granted the first time a technique of each rarity is learned (图鉴解锁奖励).
 *  Scaled to roughly 30-50% of the average technique price in each tier, so the first unlock feels like a meaningful rebate. */
export const CODEX_REWARD: Record<Rarity, number> = {
  黄阶: 100,
  人阶: 600,
  地阶: 1600,
  天阶: 4000,
  帝阶: 10000,
  神阶: 24000,
  仙阶: 60000,
};

/** Spirit stones refunded for selling an owned technique (50% of cumulative investment). */
export function sellValueFor(techniqueId: string, currentLevel: number): number {
  const def = TECHNIQUE_MAP[techniqueId];
  if (!def) return 0;
  let invested = def.learnCost;
  for (let lvl = 1; lvl < currentLevel; lvl++) invested += def.upgradeCost * lvl;
  return Math.round(invested * 0.5);
}

export interface Realm {
  name: string;
  minLevel: number;
}

// 境界体系（武道流）：武仆 → 武者(一至九星) → 武师 → 大武师 → 武宗 → 大武宗
// → 武王/武君/武圣/武帝/武尊/武皇 (各分下品/中品/上品/巅峰) → 武神
const STAR_NAMES = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const PIN_NAMES = ['下品', '中品', '上品', '巅峰'];
const GRAND_REALMS = ['武王', '武君', '武圣', '武帝', '武尊', '武皇'];

function buildRealms(): Realm[] {
  const realms: Realm[] = [];
  let level = 1;
  realms.push({ name: '武仆', minLevel: level });
  level += 1;
  for (const star of STAR_NAMES) {
    realms.push({ name: `武者${star}星`, minLevel: level });
    level += 1;
  }
  realms.push({ name: '武师', minLevel: level });
  level += 3;
  realms.push({ name: '大武师', minLevel: level });
  level += 3;
  realms.push({ name: '武宗', minLevel: level });
  level += 4;
  realms.push({ name: '大武宗', minLevel: level });
  level += 4;
  for (const grand of GRAND_REALMS) {
    for (const pin of PIN_NAMES) {
      realms.push({ name: `${grand}${pin}`, minLevel: level });
      level += 4;
    }
  }
  realms.push({ name: '武神', minLevel: level });
  return realms;
}

export const REALMS: Realm[] = buildRealms();

export function realmForLevel(level: number): Realm {
  let current = REALMS[0];
  for (const r of REALMS) {
    if (level >= r.minLevel) current = r;
  }
  return current;
}

function realmMinLevel(name: string): number {
  return REALMS.find((r) => r.name === name)?.minLevel ?? 0;
}

/** Realm required before a given rarity can appear in the 坊市 (market). */
const RARITY_UNLOCK_REALM: Record<Rarity, string> = {
  黄阶: '武仆',
  人阶: '武者一星',
  地阶: '武师',
  天阶: '武宗',
  // 帝阶及以上功法只有晋入武帝境界后才会在坊市刷新出现
  帝阶: '武帝下品',
  神阶: '武帝下品',
  仙阶: '武帝下品',
};

export function rarityUnlockLevel(rarity: Rarity): number {
  return realmMinLevel(RARITY_UNLOCK_REALM[rarity]);
}

export function isRarityUnlocked(rarity: Rarity, level: number): boolean {
  return level >= rarityUnlockLevel(rarity);
}

// 修为槽曲线设计：分段函数——前 10 级（武仆+武者）用较平缓的 level^1.3 曲线，
// 让前期升级飞快、反馈密集；从武师开始切换到 level^1.5 主曲线（带偏移衔接），
// 配合境界瓶颈系数（EXP_TIER_STEP），后期突破有明显的"瓶颈感"但不至于离谱。
const EARLY_BASE = 3000;
const EARLY_EXP = 1.3;
const LATE_BASE = 12000;
const LATE_EXP = 1.5;
/** Offset so the late curve picks up where the early curve left off at Lv10 (tier-0 baseline). */
const LATE_CURVE_OFFSET = LATE_BASE * Math.pow(9, LATE_EXP) - EARLY_BASE * Math.pow(9, EARLY_EXP);

const TIER_GROUPS: Array<(name: string) => boolean> = [
  (n) => n === '武仆' || n.startsWith('武者'),
  (n) => n === '武师' || n === '大武师',
  (n) => n === '武宗' || n === '大武宗',
  (n) => n.startsWith('武王'),
  (n) => n.startsWith('武君'),
  (n) => n.startsWith('武圣'),
  (n) => n.startsWith('武帝'),
  (n) => n.startsWith('武尊'),
  (n) => n.startsWith('武皇'),
  (n) => n === '武神',
];

/** 0-based coarse realm tier index (武仆/武者 = 0 ... 武神 = 9), used for the breakthrough multiplier. */
export function realmTierIndex(level: number): number {
  const name = realmForLevel(level).name;
  for (let i = 0; i < TIER_GROUPS.length; i++) {
    if (TIER_GROUPS[i](name)) return i;
  }
  return 0;
}

const EXP_TIER_STEP = 0.25;

/** Total lifetime exp required to reach a given level (level 1 = 0 exp). */
export function expForLevel(level: number): number {
  if (level <= 1) return 0;
  const tierMultiplier = 1 + EXP_TIER_STEP * realmTierIndex(level);
  if (level <= 10) {
    return Math.floor(EARLY_BASE * Math.pow(level - 1, EARLY_EXP) * tierMultiplier);
  }
  return Math.floor((LATE_BASE * Math.pow(level - 1, LATE_EXP) - LATE_CURVE_OFFSET) * tierMultiplier);
}

/** Derive current level from total accumulated exp. */
export function levelForExp(exp: number): number {
  if (exp <= 0) return 1;
  // Use the late curve for initial estimate (conservative for low levels), then correct.
  let level = Math.max(1, Math.floor(1 + Math.pow((exp + LATE_CURVE_OFFSET) / LATE_BASE, 2 / 3)));
  while (expForLevel(level + 1) <= exp) level++;
  while (level > 1 && expForLevel(level) > exp) level--;
  return level;
}

export interface BaseStats {
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  /** 0..1 chance to land a critical hit. */
  critRate: number;
  /** Damage multiplier applied on a critical hit, e.g. 1.5 = +50% damage. */
  critDamage: number;
  /** 0..1 chance to fully evade an incoming attack. */
  dodgeRate: number;
  /** 0..1 base chance to land an attack before the target's dodge is subtracted. */
  hitRate: number;
}

export function statsForLevel(level: number): BaseStats {
  return {
    maxHp: Math.round(100 + level * 12),
    attack: Math.round(12 + level * 4),
    defense: Math.round(6 + level * 1.2),
    speed: Math.round(10 + level * 0.6),
    critRate: Math.min(0.45, 0.05 + level * 0.002),
    critDamage: Math.min(3.0, 1.5 + level * 0.006),
    dodgeRate: Math.min(0.35, 0.05 + level * 0.001),
    hitRate: Math.min(0.99, 0.9 + level * 0.0006),
  };
}

// Idle rates scale with level AND with realm tier (same breakthrough tiers used by
// expForLevel), so production keeps pace with the ever-steeper exp/price curve instead
// of grinding to a crawl in the later realms.
const IDLE_TIER_STEP = 0.35;

/** Idle gains per hour of real time, scaling with level and realm tier. */
export function idleRatesForLevel(level: number): { expPerHour: number; stonesPerHour: number } {
  const tierBoost = 1 + IDLE_TIER_STEP * realmTierIndex(level);
  return {
    expPerHour: Math.round((7200 + level * 1800) * tierBoost),
    stonesPerHour: Math.round((5400 + level * 1200) * tierBoost),
  };
}

export const MAX_OFFLINE_HOURS = 24;

// ─── 坊市 (Market) ───

export const MARKET_SLOT_COUNT = 6;
export const MARKET_REFRESH_COST = 480;

/** Highest rarity currently obtainable in the 坊市 for this level (i.e. this realm's "best available" tier). */
export function topUnlockedRarity(level: number): Rarity | null {
  for (let i = RARITIES.length - 1; i >= 0; i--) {
    if (isRarityUnlocked(RARITIES[i], level)) return RARITIES[i];
  }
  return null;
}

/**
 * Weighted-random pick of `count` distinct techniques unlocked at `level`.
 * `topRarityBonus` adds extra weight specifically to whichever rarity is the
 * current realm's best-available tier (this is what 天工阁 boosts).
 */
export function rollMarketOffers(level: number, count: number = MARKET_SLOT_COUNT, topRarityBonus: number = 0): string[] {
  const pool = TECHNIQUES.filter((t) => isRarityUnlocked(t.rarity, level));
  const topRarity = topUnlockedRarity(level);
  const picked: string[] = [];
  const available = [...pool];
  const weightOf = (t: Technique) => RARITY_WEIGHT[t.rarity] + (t.rarity === topRarity ? topRarityBonus : 0);
  for (let i = 0; i < count && available.length > 0; i++) {
    const totalWeight = available.reduce((sum, t) => sum + weightOf(t), 0);
    let roll = Math.random() * totalWeight;
    let idx = 0;
    for (; idx < available.length; idx++) {
      roll -= weightOf(available[idx]);
      if (roll <= 0) break;
    }
    const chosen = available[Math.min(idx, available.length - 1)];
    picked.push(chosen.id);
    available.splice(available.indexOf(chosen), 1);
  }
  return picked;
}

// ─── 建筑 (Buildings): permanent spirit-stone sinks with small compounding boosts ───

export type BuildingId = 'spirit-hall' | 'scripture-pavilion' | 'sky-workshop';

export interface BuildingDef {
  id: BuildingId;
  name: string;
  description: string;
  baseCost: number;
  /** cost(level) = baseCost * costGrowth^level, level = current level before upgrading */
  costGrowth: number;
}

export const BUILDINGS: BuildingDef[] = [
  { id: 'spirit-hall', name: '采灵殿', description: '离线灵石获取速率 +1%/级', baseCost: 640, costGrowth: 1.15 },
  { id: 'scripture-pavilion', name: '藏经阁', description: '离线修为获取速率 +1%/级', baseCost: 640, costGrowth: 1.15 },
  { id: 'sky-workshop', name: '天工阁', description: '坊市刷出「当前境界最高品质功法」的概率提升', baseCost: 960, costGrowth: 1.18 },
];

export const BUILDING_MAP: Record<BuildingId, BuildingDef> = Object.fromEntries(
  BUILDINGS.map((b) => [b.id, b])
) as Record<BuildingId, BuildingDef>;

export type BuildingLevels = Record<BuildingId, number>;

export const DEFAULT_BUILDING_LEVELS: BuildingLevels = {
  'spirit-hall': 0,
  'scripture-pavilion': 0,
  'sky-workshop': 0,
};

/** Spirit stones required to upgrade a building from its current level to the next. */
export function buildingCost(id: BuildingId, currentLevel: number): number {
  const def = BUILDING_MAP[id];
  return Math.round(def.baseCost * Math.pow(def.costGrowth, currentLevel));
}

/** +1% per level multiplier used by 采灵殿 / 藏经阁. */
export function buildingRateMultiplier(level: number): number {
  return 1 + level * 0.01;
}

/** Extra market weight per level granted to the top-unlocked rarity by 天工阁. */
export const SKY_WORKSHOP_WEIGHT_PER_LEVEL = 0.3;

// ─── 境界突破守关者 (Breakthrough Guardian) ───

const GUARDIAN_PREFIXES = [
  '枯骨岭', '断魂桥', '忘川河', '幽兰谷', '霜月崖', '烈火山',
  '碎星谷', '碧波湾', '苍狼原', '桃花渡',
];
const GUARDIAN_TITLES = [
  '守关人', '护道者', '镇关长老', '试炼者', '守门人', '护法',
  '断道人', '截关散人', '镇守使', '试道者',
];

export function guardianNameForLevel(level: number): string {
  const prefix = GUARDIAN_PREFIXES[level % GUARDIAN_PREFIXES.length];
  const title = GUARDIAN_TITLES[Math.floor(level / 3) % GUARDIAN_TITLES.length];
  return `${prefix}·${title}`;
}

/**
 * Generate a guardian fighter whose stats are roughly 85% of a player at the same level.
 * The guardian uses a random technique from the pool unlocked at that level.
 */
export function guardianStatsForLevel(level: number): BaseStats {
  const base = statsForLevel(level);
  const factor = 0.82 + Math.random() * 0.12; // 82%–94% of player base stats
  return {
    maxHp: Math.round(base.maxHp * factor),
    attack: Math.round(base.attack * factor),
    defense: Math.round(base.defense * factor),
    speed: Math.round(base.speed * factor),
    critRate: Math.min(0.4, base.critRate * 0.8),
    critDamage: base.critDamage * 0.9,
    dodgeRate: Math.min(0.25, base.dodgeRate * 0.7),
    hitRate: base.hitRate * 0.95,
  };
}

/** Pick a random technique the guardian "uses" — just for flavor in battle log. */
export function guardianTechniqueForLevel(level: number): string {
  const pool = TECHNIQUES.filter((t) => isRarityUnlocked(t.rarity, level));
  if (pool.length === 0) return 'basic-strike';
  return pool[Math.floor(Math.random() * pool.length)].id;
}

/** Major realm transitions that require a breakthrough challenge. */
export const BREAKTHROUGH_REALMS = new Set([
  '武师', '大武师', '武宗', '大武宗',
  '武王下品', '武君下品', '武圣下品', '武帝下品', '武尊下品', '武皇下品', '武神',
]);

/** Check if leveling up to `newLevel` crosses into a breakthrough realm. */
export function isBreakthroughLevel(newLevel: number): boolean {
  const realm = realmForLevel(newLevel);
  return BREAKTHROUGH_REALMS.has(realm.name);
}

// ─── 坊市拍卖 (Auction) ───

export interface AuctionItem {
  techniqueId: string;
  basePrice: number;
  currentBid: number;
  /** NPC names who have bid, making the price rise. */
  bidHistory: { name: string; amount: number }[];
  expiresAt: string;
}

const AUCTION_NPC_BIDDERS = [
  '鲸鲨帮孙二狗', '青云门张三', '黑虎散人', '落叶游侠',
  '铁骨门赵四', '寒梅山庄李大小姐', '断刀门王五', '听风楼刘六',
  '碎星谷陈七', '碧波岛周八',
];

/**
 * Roll an auction item: a rare technique (帝阶+) with a starting bid.
 * Only available if the player has unlocked 帝阶 rarity.
 */
export function rollAuctionItem(level: number): AuctionItem | null {
  if (!isRarityUnlocked('帝阶', level)) return null;
  // 25% chance to have an auction item on each refresh
  if (Math.random() > 0.25) return null;

  const rarePool = TECHNIQUES.filter((t) =>
    isRarityUnlocked(t.rarity, level) &&
    (t.rarity === '帝阶' || t.rarity === '神阶' || t.rarity === '仙阶')
  );
  if (rarePool.length === 0) return null;

  const tech = rarePool[Math.floor(Math.random() * rarePool.length)];
  const basePrice = tech.learnCost * 2; // auction items cost 2x normal learn cost

  // 1-3 NPC bids already placed
  const numBids = Math.floor(Math.random() * 3) + 1;
  const bidHistory: { name: string; amount: number }[] = [];
  let currentBid = basePrice;
  for (let i = 0; i < numBids; i++) {
    const bidder = AUCTION_NPC_BIDDERS[Math.floor(Math.random() * AUCTION_NPC_BIDDERS.length)];
    currentBid = Math.round(currentBid * (1.1 + Math.random() * 0.15));
    bidHistory.push({ name: bidder, amount: currentBid });
  }

  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2 hours

  return { techniqueId: tech.id, basePrice, currentBid, bidHistory, expiresAt };
}

/** Player outbids the current price; returns new bid amount and a random NPC counter-bid (or null if NPC gives up). */
export function nextNpcBid(currentBid: number, basePrice: number): { name: string; amount: number } | null {
  // NPC has 60% chance to counter-bid, up to 3x base price
  if (currentBid >= basePrice * 3) return null;
  if (Math.random() > 0.6) return null;
  const bidder = AUCTION_NPC_BIDDERS[Math.floor(Math.random() * AUCTION_NPC_BIDDERS.length)];
  const amount = Math.round(currentBid * (1.08 + Math.random() * 0.12));
  return { name: bidder, amount };
}
