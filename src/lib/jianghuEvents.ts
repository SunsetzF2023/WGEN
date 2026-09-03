// 江湖名录 — random martial-world events that happen while you're idle.
// Events involve NPCs (with flavorful names) and sometimes real players.
// Generated client-side on each page load from the last-collected timestamp.

export type EventType = 'duel' | 'ambush' | 'treasure' | 'encounter' | 'rivalry';

/** Concrete effect applied to a player involved in an event. */
export interface EventEffect {
  playerName: string;
  expDelta: number;
  spiritStonesDelta: number;
  label: string;
}

export interface JianghuEvent {
  id: string;
  type: EventType;
  text: string;
  participants: string[];
  createdAt: string;
  effects: EventEffect[];
}

// ─── NPC name generation ───

const SURNAMES = [
  '张', '王', '李', '赵', '刘', '陈', '杨', '黄', '周', '吴',
  '徐', '孙', '马', '朱', '胡', '郭', '何', '高', '林', '罗',
  '郑', '梁', '谢', '宋', '唐', '许', '韩', '冯', '邓', '曹',
  '彭', '曾', '萧', '田', '董', '袁', '潘', '于', '蒋', '蔡',
];

const GIVEN_NAMES = [
  '三', '四', '五', '二狗', '铁柱', '石头', '大壮', '小六', '麻子', '瘸子',
  '青云', '苍海', '玄机', '若虚', '无尘', '忘机', '孤鸿', '断流', '惊鸿', '落英',
  '长风', '破云', '凌霄', '踏雪', '听雨', '寻梅', '问天', '观星', '揽月', '追风',
];

const FACTIONS = [
  '桃花众', '黑虎散人', '落叶游侠', '鲸鲨帮', '黑水城', '青云门',
  '铁骨门', '寒梅山庄', '九黎寨', '苍狼部', '赤焰堂', '碧波岛',
  '断刀门', '听风楼', '碎星谷', '幽兰苑', '烈火宗', '霜月阁',
];

const TITLES = [
  '散人', '游侠', '道人', '居士', '剑客', '刀客', '镖师', '乞丐',
  '樵夫', '渔夫', '猎户', '书生', '郎中', '铁匠', '掌柜', '伙计',
];

const LOCATIONS = [
  '黑水城', '落霞镇', '枯骨岭', '桃花渡', '碧波湾', '苍狼原',
  '碎星谷', '幽兰谷', '烈火山', '霜月崖', '断魂桥', '忘川河',
];

const THUG_NAMES = [
  '路边地痞', '山贼头目', '流窜匪徒', '酒馆恶霸', '街头混混',
  '拦路强人', '黑店掌柜', '水匪头子', '山间野盗', '市井无赖',
];

const TREASURES = [
  '一株千年灵芝', '一枚筑基丹', '一卷残破功法', '一把寒光宝剑',
  '一块玄铁精矿', '一瓶回春丹', '一张古地图', '一枚储物戒',
  '一壶百年灵酒', '一具妖兽骨骸', '一株血参', '一块龙鳞',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomNpcName(): string {
  const r = Math.random();
  if (r < 0.25) {
    // 派门+姓+名，如 青云门张三
    return `${pick(FACTIONS)}${pick(SURNAMES)}${pick(GIVEN_NAMES)}`;
  } else if (r < 0.5) {
    // 地名+姓+称谓，如 黑水城·江家三少爷
    const loc = pick(LOCATIONS);
    const surname = pick(SURNAMES);
    const suffix = pick(['大少爷', '二少爷', '三少爷', '大小姐', '二小姐', '三小姐', '家主', '长老']);
    return `${loc}·${surname}家${suffix}`;
  } else if (r < 0.7) {
    // 称号，如 黑虎散人
    return `${pick(FACTIONS)}${pick(TITLES)}`;
  } else if (r < 0.85) {
    // 纯江湖名号，如 落叶游侠
    return pick(FACTIONS);
  } else {
    // 地痞流氓
    return pick(THUG_NAMES);
  }
}

function randomNpcPair(): [string, string] {
  let a = randomNpcName();
  let b = randomNpcName();
  while (b === a) b = randomNpcName();
  return [a, b];
}

// ─── Event templates ───

interface EventResult {
  text: string;
  participants: string[];
  effects: EventEffect[];
}

interface EventTemplate {
  type: EventType;
  generate: (npcA: string, npcB: string, playerNames: string[]) => EventResult;
}

const TEMPLATES: EventTemplate[] = [
  // 争斗 — winner gains stones+exp, loser loses exp
  {
    type: 'duel',
    generate: (a, b, players) => {
      const r = Math.random();
      if (r < 0.3 && players.length > 0) {
        const p = pick(players);
        const playerWins = Math.random() < 0.55;
        if (playerWins) {
          const stones = randInt(30, 120);
          const exp = randInt(200, 800);
          return {
            text: `${a} 与 ${p} 在 ${pick(LOCATIONS)} 狭路相逢，一言不合大打出手！${a} 不敌，负伤遁走。${p} 缴获灵石 ${stones} 枚，修为精进。`,
            participants: [a, p],
            effects: [{ playerName: p, expDelta: exp, spiritStonesDelta: stones, label: '争斗获胜' }],
          };
        }
        const expLoss = randInt(100, 500);
        return {
          text: `${a} 与 ${p} 在 ${pick(LOCATIONS)} 狭路相逢，一言不合大打出手！${p} 被打落牙齿和血吞，修为受损。`,
          participants: [a, p],
          effects: [{ playerName: p, expDelta: -expLoss, spiritStonesDelta: 0, label: '争斗落败' }],
        };
      }
      return {
        text: `${a} 与 ${b} 在 ${pick(LOCATIONS)} 约斗，${Math.random() < 0.5 ? `${a} 棋高一着，${b} 败北` : `${b} 险胜，${a} 负伤而退`}。`,
        participants: [a, b],
        effects: [],
      };
    },
  },
  // 袭杀 — victim loses exp+stones, or fights back and gains
  {
    type: 'ambush',
    generate: (a, b, players) => {
      const r = Math.random();
      if (r < 0.25 && players.length > 0) {
        const p = pick(players);
        const playerSurvives = Math.random() < 0.5;
        if (playerSurvives) {
          const stones = randInt(20, 80);
          const exp = randInt(100, 400);
          return {
            text: `${a} 埋伏于 ${pick(LOCATIONS)}，趁 ${p} 不备突下杀手！${p} 反应神速，将 ${a} 击退，缴获灵石 ${stones} 枚。`,
            participants: [a, p],
            effects: [{ playerName: p, expDelta: exp, spiritStonesDelta: stones, label: '反杀袭杀者' }],
          };
        }
        const expLoss = randInt(300, 1000);
        const stoneLoss = randInt(20, 100);
        return {
          text: `${a} 埋伏于 ${pick(LOCATIONS)}，趁 ${p} 不备突下杀手！${p} 身受重伤，险些丧命，灵石被夺 ${stoneLoss} 枚，修为大损。`,
          participants: [a, p],
          effects: [{ playerName: p, expDelta: -expLoss, spiritStonesDelta: -stoneLoss, label: '遭遇袭杀' }],
        };
      }
      return {
        text: `${a} 于 ${pick(LOCATIONS)} 暗伏杀招，${b} 猝不及防！${Math.random() < 0.5 ? `${b} 被夺去${pick(TREASURES)}，含恨而逃` : `${b} 以伤换命，拼死杀出重围`}。`,
        participants: [a, b],
        effects: [],
      };
    },
  },
  // 寻宝 — winner gains exp+stones
  {
    type: 'treasure',
    generate: (a, b, players) => {
      const treasure = pick(TREASURES);
      const r = Math.random();
      if (r < 0.3 && players.length > 0) {
        const p = pick(players);
        const playerWins = Math.random() < 0.55;
        if (playerWins) {
          const stones = randInt(50, 200);
          const exp = randInt(300, 1200);
          return {
            text: `${p} 在 ${pick(LOCATIONS)} 意外发现${treasure}！${a} 贪心大起，欲行抢夺，却被 ${p} 一掌震退。${p} 得宝而归，收获灵石 ${stones} 枚。`,
            participants: [p, a],
            effects: [{ playerName: p, expDelta: exp, spiritStonesDelta: stones, label: '寻宝得手' }],
          };
        }
        const stoneLoss = randInt(30, 100);
        return {
          text: `${p} 在 ${pick(LOCATIONS)} 意外发现${treasure}！${a} 贪心大起，欲行抢夺，${p} 寡不敌众，宝物被夺，还赔上灵石 ${stoneLoss} 枚。`,
          participants: [p, a],
          effects: [{ playerName: p, expDelta: 0, spiritStonesDelta: -stoneLoss, label: '宝物被夺' }],
        };
      }
      return {
        text: `${a} 与 ${b} 在 ${pick(LOCATIONS)} 同时发现${treasure}，双方互不相让，${Math.random() < 0.5 ? `${a} 抢先得手，${b} 怒极而去` : `${b} 趁乱夺宝，${a} 空手而归`}。`,
        participants: [a, b],
        effects: [],
      };
    },
  },
  // 奇遇 — player gets exp+stones bonus
  {
    type: 'encounter',
    generate: (a, _b, players) => {
      const r = Math.random();
      if (r < 0.4 && players.length > 0) {
        const p = pick(players);
        const stones = randInt(50, 150);
        const exp = randInt(200, 600);
        return {
          text: `${p} 途经 ${pick(LOCATIONS)}，偶遇 ${a}。${a} 慨赠${pick(TREASURES)}，${p} 喜出望外，收获灵石 ${stones} 枚。`,
          participants: [p, a],
          effects: [{ playerName: p, expDelta: exp, spiritStonesDelta: stones, label: '奇遇获赠' }],
        };
      }
      return {
        text: `${a} 在 ${pick(LOCATIONS)} 偶得${pick(TREASURES)}，一时传为佳话。`,
        participants: [a],
        effects: [],
      };
    },
  },
  // 恩怨 — no immediate effect, just flavor
  {
    type: 'rivalry',
    generate: (a, b, players) => {
      const r = Math.random();
      if (r < 0.2 && players.length > 0) {
        const p = pick(players);
        return {
          text: `${a} 扬言要找 ${p} 了结旧怨，${p} 闻讯冷笑：${pick(['"正合我意。"', '"来便来，谁怕谁？"', '"哼，不自量力。"', '"且看他有何本事。"'])}`,
          participants: [a, p],
          effects: [],
        };
      }
      return {
        text: `${a} 与 ${b} 宿怨再起，${pick(LOCATIONS)} 一带风声鹤唳，江湖中人纷纷避道。`,
        participants: [a, b],
        effects: [],
      };
    },
  },
];

// ─── Event generation ───

/**
 * Generate a batch of random jianghu events.
 * @param count Number of events to generate
 * @param playerNames Names of real players who might appear in events
 */
export function generateEvents(count: number, playerNames: string[]): JianghuEvent[] {
  const events: JianghuEvent[] = [];
  for (let i = 0; i < count; i++) {
    const template = pick(TEMPLATES);
    const [a, b] = randomNpcPair();
    const result = template.generate(a, b, playerNames);
    events.push({
      id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
      type: template.type,
      text: result.text,
      participants: result.participants,
      effects: result.effects,
      createdAt: new Date(Date.now() - Math.floor(Math.random() * 3600 * 1000 * 6)).toISOString(),
    });
  }
  events.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return events;
}

/** Extract effects that apply to a specific player from a list of events. */
export function collectPlayerEffects(events: JianghuEvent[], playerName: string): EventEffect[] {
  const effects: EventEffect[] = [];
  for (const ev of events) {
    for (const eff of ev.effects) {
      if (eff.playerName === playerName) {
        effects.push(eff);
        break;
      }
    }
  }
  return effects;
}

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  duel: '⚔️ 争斗',
  ambush: '🗡️ 袭杀',
  treasure: '💎 寻宝',
  encounter: '🌟 奇遇',
  rivalry: '😤 恩怨',
};

export const EVENT_TYPE_COLOR: Record<EventType, string> = {
  duel: 'text-rose-400',
  ambush: 'text-red-500',
  treasure: 'text-amber-400',
  encounter: 'text-sky-400',
  rivalry: 'text-orange-400',
};
