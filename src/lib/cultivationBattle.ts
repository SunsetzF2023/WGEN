// Turn-based text battle simulation for the 修仙挂机对战 mini-game.
// Deterministic given the same fighters + rng seed; run entirely client-side
// (whoever initiates the challenge computes the result and stores the log).

import { TECHNIQUE_MAP, RARITIES, type BaseStats } from './cultivationData';

export interface OwnedTechnique {
  id: string;
  level: number;
}

export interface BattleFighter {
  userId: string;
  name: string;
  level: number;
  stats: BaseStats;
  equipped: OwnedTechniques;
}

// Alias kept for readability at call sites.
type OwnedTechniques = OwnedTechnique[];

export interface LogEntry {
  turn: number;
  actorId: string;
  actorName: string;
  targetName: string;
  techniqueName: string;
  rarity: string;
  damage: number;
  crit: boolean;
  dodged: boolean;
  targetHpAfter: number;
  targetMaxHp: number;
  text: string;
}

export interface BattleResult {
  winnerId: string;
  loserId: string;
  log: LogEntry[];
  turns: number;
}

// Simple mulberry32 PRNG so results are reproducible from a numeric seed.
function makeRng(seed: number) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function techniqueMultiplier(owned: OwnedTechnique): number {
  const def = TECHNIQUE_MAP[owned.id];
  if (!def) return 1;
  return def.baseMultiplier + def.multiplierPerLevel * (owned.level - 1);
}

/** Higher-rarity techniques carry a small extra crit chance on top of the fighter's base crit rate stat. */
function rarityCritBonus(rarity: string | undefined): number {
  if (!rarity) return 0;
  const idx = RARITIES.indexOf(rarity as (typeof RARITIES)[number]);
  if (idx < 0) return 0;
  return idx * 0.015;
}

/** Hit vs dodge is a direct stat contest (both explicit character stats), clamped so neither always lands nor always misses. */
const MIN_HIT_CHANCE = 0.5;
const MAX_HIT_CHANCE = 0.98;

function hitChanceFor(attackerHitRate: number, defenderDodgeRate: number): number {
  return Math.max(MIN_HIT_CHANCE, Math.min(MAX_HIT_CHANCE, attackerHitRate - defenderDodgeRate));
}

export function simulateBattle(
  challenger: BattleFighter,
  opponent: BattleFighter,
  seed: number = Date.now()
): BattleResult {
  const rng = makeRng(seed);

  let hpA = challenger.stats.maxHp;
  let hpB = opponent.stats.maxHp;

  const equippedA = challenger.equipped.length > 0 ? challenger.equipped : [{ id: 'basic-strike', level: 1 }];
  const equippedB = opponent.equipped.length > 0 ? opponent.equipped : [{ id: 'basic-strike', level: 1 }];

  // Higher speed acts first each round; ties favor the challenger.
  const challengerFirst = challenger.stats.speed >= opponent.stats.speed;

  const log: LogEntry[] = [];
  const MAX_TURNS = 30;
  let turn = 0;

  function act(
    turnNo: number,
    actor: BattleFighter,
    target: BattleFighter,
    targetHpRef: { hp: number },
    equipped: OwnedTechnique[]
  ) {
    const move = equipped[(turnNo - 1) % equipped.length];
    const def = TECHNIQUE_MAP[move.id];
    const moveName = def?.name || '普通攻击';

    const isDodged = rng() >= hitChanceFor(actor.stats.hitRate, target.stats.dodgeRate);
    if (isDodged) {
      log.push({
        turn: turnNo,
        actorId: actor.userId,
        actorName: actor.name,
        targetName: target.name,
        techniqueName: moveName,
        rarity: def?.rarity || '',
        damage: 0,
        crit: false,
        dodged: true,
        targetHpAfter: targetHpRef.hp,
        targetMaxHp: target.stats.maxHp,
        text: `${actor.name} 施展「${moveName}」，但 ${target.name} 身法轻盈（闪避率 ${(target.stats.dodgeRate * 100).toFixed(0)}%），敏捷避开了这一击！`,
      });
      return;
    }

    const mult = techniqueMultiplier(move);
    const isCrit = rng() < actor.stats.critRate + rarityCritBonus(def?.rarity);
    const variance = 0.92 + rng() * 0.16; // 0.92x ~ 1.08x — tighter than before so real stat gaps decide fights, not luck
    const mitigation = 40 / (40 + target.stats.defense);
    let raw = actor.stats.attack * mult * variance * mitigation;
    if (isCrit) raw *= actor.stats.critDamage;
    const damage = Math.max(1, Math.round(raw));
    targetHpRef.hp = Math.max(0, targetHpRef.hp - damage);

    log.push({
      turn: turnNo,
      actorId: actor.userId,
      actorName: actor.name,
      targetName: target.name,
      techniqueName: moveName,
      rarity: def?.rarity || '',
      damage,
      crit: isCrit,
      dodged: false,
      targetHpAfter: targetHpRef.hp,
      targetMaxHp: target.stats.maxHp,
      text: `${actor.name} 施展「${moveName}」，对 ${target.name} 造成 ${damage} 点伤害${isCrit ? `（会心一击！暴击倍率 ${(actor.stats.critDamage * 100).toFixed(0)}%）` : ''}，${target.name} 剩余生命 ${targetHpRef.hp}/${target.stats.maxHp}`,
    });
  }

  const hpARef = { hp: hpA };
  const hpBRef = { hp: hpB };

  while (turn < MAX_TURNS && hpARef.hp > 0 && hpBRef.hp > 0) {
    turn++;
    if (challengerFirst) {
      act(turn, challenger, opponent, hpBRef, equippedA);
      if (hpBRef.hp <= 0) break;
      act(turn, opponent, challenger, hpARef, equippedB);
      if (hpARef.hp <= 0) break;
    } else {
      act(turn, opponent, challenger, hpARef, equippedB);
      if (hpARef.hp <= 0) break;
      act(turn, challenger, opponent, hpBRef, equippedA);
      if (hpBRef.hp <= 0) break;
    }
  }

  let winnerId: string;
  let loserId: string;
  if (hpARef.hp <= 0 && hpBRef.hp > 0) {
    winnerId = opponent.userId;
    loserId = challenger.userId;
  } else if (hpBRef.hp <= 0 && hpARef.hp > 0) {
    winnerId = challenger.userId;
    loserId = opponent.userId;
  } else {
    // Ran out of turns: whoever has more remaining HP% wins.
    const pctA = hpARef.hp / challenger.stats.maxHp;
    const pctB = hpBRef.hp / opponent.stats.maxHp;
    winnerId = pctA >= pctB ? challenger.userId : opponent.userId;
    loserId = winnerId === challenger.userId ? opponent.userId : challenger.userId;
  }

  return { winnerId, loserId, log, turns: turn };
}
