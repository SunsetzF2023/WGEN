// Core data model for WorldForge

export type EntityType =
  | 'character'
  | 'faction'
  | 'location'
  | 'technique'
  | 'event'
  | 'item'
  | 'realm'
  | 'custom';

export interface EntityField {
  key: string;
  label: string;
  value: string;
  /** If this field links to another entity, store the entity id here */
  linkedEntityId?: string;
}

export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  icon: string; // emoji
  summary: string;
  description: string;
  imageUrl?: string;
  audioUrl?: string;
  /** Structured fields — age, faction, bloodline, etc. */
  fields: EntityField[];
  /** Tags for grouping/filtering */
  tags: string[];
  /** IDs of related entities (for graph edges) */
  relationIds: string[];
  /** User who created this entity */
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export const ENTITY_TYPE_META: Record<EntityType, { label: string; icon: string; color: string }> = {
  character: { label: '人物', icon: '🧙', color: '#818cf8' },
  faction: { label: '势力', icon: '🏰', color: '#f97316' },
  location: { label: '地点', icon: '🗺️', color: '#22c55e' },
  technique: { label: '功法', icon: '⚡', color: '#eab308' },
  event: { label: '事件', icon: '📜', color: '#ec4899' },
  item: { label: '物品', icon: '💎', color: '#06b6d4' },
  realm: { label: '境界', icon: '🔮', color: '#a855f7' },
  custom: { label: '自定义', icon: '📌', color: '#94a3b8' },
};

/** Field templates per entity type — shown when creating a new entity */
export const FIELD_TEMPLATES: Record<EntityType, { key: string; label: string }[]> = {
  character: [
    { key: 'age', label: '年龄' },
    { key: 'gender', label: '性别' },
    { key: 'faction', label: '所属势力' },
    { key: 'realm', label: '境界修为' },
    { key: 'bloodline', label: '血脉' },
    { key: 'physique', label: '体质' },
    { key: 'talent', label: '天赋' },
    { key: 'technique', label: '功法/神通' },
    { key: 'family', label: '家族' },
    { key: 'friends', label: '朋友' },
    { key: 'spouse', label: '道侣' },
    { key: 'enemies', label: '仇人' },
    { key: 'equipment', label: '装备' },
    { key: 'treasure', label: '宝物' },
    { key: 'background', label: '重大背景故事' },
  ],
  faction: [
    { key: 'origin', label: '起源' },
    { key: 'leader', label: '宗主/领袖' },
    { key: 'industry', label: '产业' },
    { key: 'territory', label: '领地' },
    { key: 'ideology', label: '理念' },
    { key: 'allies', label: '盟友' },
    { key: 'enemies', label: '敌对势力' },
    { key: 'members', label: '核心成员' },
  ],
  location: [
    { key: 'region', label: '所属区域' },
    { key: 'ruler', label: '统治者' },
    { key: 'climate', label: '气候' },
    { key: 'resources', label: '资源' },
    { key: 'danger', label: '危险等级' },
    { key: 'history', label: '历史' },
  ],
  technique: [
    { key: 'type', label: '类型' },
    { key: 'rank', label: '品阶' },
    { key: 'origin', label: '来源' },
    { key: 'effect', label: '效果' },
    { key: 'prerequisite', label: '修炼条件' },
    { key: 'previousOwner', label: '上一任拥有者' },
  ],
  event: [
    { key: 'date', label: '时间' },
    { key: 'location', label: '地点' },
    { key: 'participants', label: '参与者' },
    { key: 'cause', label: '起因' },
    { key: 'result', label: '结果' },
    { key: 'impact', label: '影响' },
  ],
  item: [
    { key: 'type', label: '类型' },
    { key: 'rank', label: '品阶' },
    { key: 'effect', label: '效果' },
    { key: 'origin', label: '来源' },
    { key: 'owner', label: '持有者' },
  ],
  realm: [
    { key: 'order', label: '排序' },
    { key: 'requirement', label: '突破条件' },
    { key: 'ability', label: '能力变化' },
    { key: 'lifespan', label: '寿命' },
  ],
  custom: [],
};
