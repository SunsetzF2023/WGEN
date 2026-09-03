// Static game content for the 武道挂机对战 (Idle Martial-Dao Battle) mini-game.
// All numbers are tuned for a small "office colleagues" casual idle game,
// not for rigorous game-economy balance.

export type TechniqueType = '拳法' | '腿法' | '掌法' | '指法' | '身法' | '枪法' | '剑法' | '内功';

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
}

export const TECHNIQUES: Technique[] = [
  // ─── 黄阶：坊市常见货色，人人可学 ───
  {
    id: 'basic-strike', name: '黑虎拳', type: '拳法', rarity: '黄阶',
    description: '坊市地摊货，胜在朴实无华，出手迅捷。',
    baseMultiplier: 1.0, multiplierPerLevel: 0.06, learnCost: 0, upgradeCost: 15, maxLevel: 10,
  },
  {
    id: 'iron-cloth', name: '铁布衫', type: '内功', rarity: '黄阶',
    description: '强横外功，卖相不佳但耐揍。',
    baseMultiplier: 0.9, multiplierPerLevel: 0.06, learnCost: 20, upgradeCost: 15, maxLevel: 10,
  },
  {
    id: 'gale-leg', name: '烈风腿', type: '腿法', rarity: '黄阶',
    description: '腿法凌厉，招式简单却很实用。',
    baseMultiplier: 1.05, multiplierPerLevel: 0.07, learnCost: 30, upgradeCost: 18, maxLevel: 10,
  },
  // ─── 人阶：武者境以上开始能压得住场子 ───
  {
    id: 'poxue-spear', name: '破军枪法', type: '枪法', rarity: '人阶',
    description: '军中流传的枪法，一往无前，攻势凌厉。',
    baseMultiplier: 1.3, multiplierPerLevel: 0.10, learnCost: 90, upgradeCost: 35, maxLevel: 10,
  },
  {
    id: 'shadowless-step', name: '无影步', type: '身法', rarity: '人阶',
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
    description: '阴狠毒辣的指法，一旦得手伤势极难恢复。',
    baseMultiplier: 1.55, multiplierPerLevel: 0.13, learnCost: 260, upgradeCost: 80, maxLevel: 10,
  },
  {
    id: 'thousand-hammer-palm', name: '千锤百炼掌', type: '掌法', rarity: '地阶',
    description: '掌力如山，招招砸实，破防极强。',
    baseMultiplier: 1.5, multiplierPerLevel: 0.12, learnCost: 240, upgradeCost: 75, maxLevel: 10,
  },
  {
    id: 'flowing-cloud-sword', name: '流云剑诀', type: '剑法', rarity: '地阶',
    description: '剑意如行云流水，连绵不绝。',
    baseMultiplier: 1.6, multiplierPerLevel: 0.13, learnCost: 280, upgradeCost: 85, maxLevel: 10,
  },
  // ─── 天阶：武宗、大武宗方能驾驭 ───
  {
    id: 'thunder-emperor-fist', name: '雷帝真拳', type: '拳法', rarity: '天阶',
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
    id: 'sovereign-annihilation-fist', name: '帝灭拳', type: '拳法', rarity: '帝阶',
    description: '一拳出，天地失色，唯武帝方可窥其全貌。',
    baseMultiplier: 2.5, multiplierPerLevel: 0.22, learnCost: 1600, upgradeCost: 420, maxLevel: 10,
  },
  {
    id: 'imperial-sun-scripture', name: '帝日经', type: '内功', rarity: '帝阶',
    description: '炼体成日，气血如朝阳生生不息。',
    baseMultiplier: 2.3, multiplierPerLevel: 0.20, learnCost: 1500, upgradeCost: 400, maxLevel: 10,
  },
  {
    id: 'nether-sovereign-blade', name: '幽冥帝刀', type: '剑法', rarity: '帝阶',
    description: '刀出幽冥，斩尽因果，帝阶凶名远扬。',
    baseMultiplier: 2.6, multiplierPerLevel: 0.23, learnCost: 1700, upgradeCost: 450, maxLevel: 10,
  },
  // ─── 神阶：武尊往上才配得上的威能 ───
  {
    id: 'god-slaying-spear', name: '弑神枪', type: '枪法', rarity: '神阶',
    description: '相传曾有武神折戟于此枪之下。',
    baseMultiplier: 3.2, multiplierPerLevel: 0.28, learnCost: 3800, upgradeCost: 900, maxLevel: 10,
  },
  {
    id: 'divine-devour-palm', name: '吞神噬魂掌', type: '掌法', rarity: '神阶',
    description: '掌心吞吐神念，被拍中者魂魄俱伤。',
    baseMultiplier: 3.0, multiplierPerLevel: 0.26, learnCost: 3500, upgradeCost: 850, maxLevel: 10,
  },
  // ─── 仙阶：坊市传说，武皇亦难求 ───
  {
    id: 'immortal-ascension-scripture', name: '仙飞升诀', type: '内功', rarity: '仙阶',
    description: '习之若成，隐有飞升霞光自体表溢出。',
    baseMultiplier: 3.8, multiplierPerLevel: 0.34, learnCost: 8000, upgradeCost: 1800, maxLevel: 10,
  },
  {
    id: 'immortal-severing-sword', name: '斩仙剑诀', type: '剑法', rarity: '仙阶',
    description: '剑指九天，仙神亦不可挡其锋芒。',
    baseMultiplier: 4.0, multiplierPerLevel: 0.36, learnCost: 8500, upgradeCost: 1900, maxLevel: 10,
  },
];

export const TECHNIQUE_MAP: Record<string, Technique> = Object.fromEntries(
  TECHNIQUES.map((t) => [t.id, t])
);

export const MAX_EQUIPPED = 3;

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
    level += 2;
  }
  realms.push({ name: '武师', minLevel: level });
  level += 4;
  realms.push({ name: '大武师', minLevel: level });
  level += 5;
  realms.push({ name: '武宗', minLevel: level });
  level += 6;
  realms.push({ name: '大武宗', minLevel: level });
  level += 7;
  for (const grand of GRAND_REALMS) {
    for (const pin of PIN_NAMES) {
      realms.push({ name: `${grand}${pin}`, minLevel: level });
      level += 5;
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

/** Total lifetime exp required to reach a given level (level 1 = 0 exp). */
export function expForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(100 * Math.pow(level - 1, 1.5));
}

/** Derive current level from total accumulated exp. */
export function levelForExp(exp: number): number {
  if (exp <= 0) return 1;
  let level = Math.max(1, Math.floor(1 + Math.pow(exp / 100, 2 / 3)));
  while (expForLevel(level + 1) <= exp) level++;
  while (level > 1 && expForLevel(level) > exp) level--;
  return level;
}

export interface BaseStats {
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
}

export function statsForLevel(level: number): BaseStats {
  return {
    maxHp: Math.round(120 + level * 18),
    attack: Math.round(12 + level * 3.2),
    defense: Math.round(6 + level * 1.6),
    speed: Math.round(10 + level * 0.6),
  };
}

/** Idle gains per hour of real time, scaling with level. */
export function idleRatesForLevel(level: number): { expPerHour: number; stonesPerHour: number } {
  return {
    expPerHour: Math.round(30 + level * 6),
    stonesPerHour: Math.round(8 + level * 1.8),
  };
}

export const MAX_OFFLINE_HOURS = 24;

// ─── 坊市 (Market) ───

export const MARKET_SLOT_COUNT = 6;
export const MARKET_REFRESH_COST = 30;

/** Weighted-random pick of `count` distinct techniques unlocked at `level`. */
export function rollMarketOffers(level: number, count: number = MARKET_SLOT_COUNT): string[] {
  const pool = TECHNIQUES.filter((t) => isRarityUnlocked(t.rarity, level));
  const picked: string[] = [];
  const available = [...pool];
  for (let i = 0; i < count && available.length > 0; i++) {
    const totalWeight = available.reduce((sum, t) => sum + RARITY_WEIGHT[t.rarity], 0);
    let roll = Math.random() * totalWeight;
    let idx = 0;
    for (; idx < available.length; idx++) {
      roll -= RARITY_WEIGHT[available[idx].rarity];
      if (roll <= 0) break;
    }
    const chosen = available[Math.min(idx, available.length - 1)];
    picked.push(chosen.id);
    available.splice(available.indexOf(chosen), 1);
  }
  return picked;
}
