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
  /** Custom type label when type === 'custom' */
  customTypeLabel?: string;
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
  /** Optional saved position for graph layout */
  position?: { x: number; y: number };
  /** User who created this entity */
  owner_id: string;
  /** Project this entity belongs to */
  project_id: string;
  created_at: string;
  updated_at: string;
}

/** A world-building project — a collection of entities */
export interface WorldProject {
  id: string;
  name: string;
  icon: string; // emoji
  description: string;
  /** Whether this project is publicly visible to other users */
  isPublic: boolean;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export const ENTITY_TYPE_META: Record<EntityType, { labelKey: string; icon: string; color: string }> = {
  character: { labelKey: 'typeCharacter', icon: '🧙', color: '#818cf8' },
  faction: { labelKey: 'typeFaction', icon: '🏰', color: '#f97316' },
  location: { labelKey: 'typeLocation', icon: '🗺️', color: '#22c55e' },
  technique: { labelKey: 'typeTechnique', icon: '⚡', color: '#eab308' },
  event: { labelKey: 'typeEvent', icon: '📜', color: '#ec4899' },
  item: { labelKey: 'typeItem', icon: '💎', color: '#06b6d4' },
  realm: { labelKey: 'typeRealm', icon: '🔮', color: '#a855f7' },
  custom: { labelKey: 'typeCustom', icon: '📌', color: '#94a3b8' },
};

/** Check if an icon string is an image (URL or data URI) rather than an emoji */
export function isImageIcon(icon: string): boolean {
  return icon.startsWith('http://') || icon.startsWith('https://') || icon.startsWith('data:');
}

/** Field templates per entity type — shown when creating a new entity */
export const FIELD_TEMPLATES: Record<EntityType, { key: string; labelKey: string }[]> = {
  character: [
    { key: 'age', labelKey: 'fieldAge' },
    { key: 'gender', labelKey: 'fieldGender' },
    { key: 'faction', labelKey: 'fieldFaction' },
    { key: 'realm', labelKey: 'fieldRealm' },
    { key: 'bloodline', labelKey: 'fieldBloodline' },
    { key: 'physique', labelKey: 'fieldPhysique' },
    { key: 'talent', labelKey: 'fieldTalent' },
    { key: 'technique', labelKey: 'fieldTechnique' },
    { key: 'family', labelKey: 'fieldFamily' },
    { key: 'friends', labelKey: 'fieldFriends' },
    { key: 'spouse', labelKey: 'fieldSpouse' },
    { key: 'enemies', labelKey: 'fieldEnemies' },
    { key: 'equipment', labelKey: 'fieldEquipment' },
    { key: 'treasure', labelKey: 'fieldTreasure' },
    { key: 'background', labelKey: 'fieldBackground' },
  ],
  faction: [
    { key: 'origin', labelKey: 'fieldOrigin' },
    { key: 'leader', labelKey: 'fieldLeader' },
    { key: 'industry', labelKey: 'fieldIndustry' },
    { key: 'territory', labelKey: 'fieldTerritory' },
    { key: 'ideology', labelKey: 'fieldIdeology' },
    { key: 'allies', labelKey: 'fieldAllies' },
    { key: 'enemies', labelKey: 'fieldFactionEnemies' },
    { key: 'members', labelKey: 'fieldMembers' },
  ],
  location: [
    { key: 'region', labelKey: 'fieldRegion' },
    { key: 'ruler', labelKey: 'fieldRuler' },
    { key: 'climate', labelKey: 'fieldClimate' },
    { key: 'resources', labelKey: 'fieldResources' },
    { key: 'danger', labelKey: 'fieldDanger' },
    { key: 'history', labelKey: 'fieldHistory' },
  ],
  technique: [
    { key: 'type', labelKey: 'fieldType' },
    { key: 'rank', labelKey: 'fieldRank' },
    { key: 'origin', labelKey: 'fieldOrigin' },
    { key: 'effect', labelKey: 'fieldEffect' },
    { key: 'prerequisite', labelKey: 'fieldPrerequisite' },
    { key: 'previousOwner', labelKey: 'fieldPreviousOwner' },
  ],
  event: [
    { key: 'date', labelKey: 'fieldDate' },
    { key: 'location', labelKey: 'fieldEventLocation' },
    { key: 'participants', labelKey: 'fieldParticipants' },
    { key: 'cause', labelKey: 'fieldCause' },
    { key: 'result', labelKey: 'fieldResult' },
    { key: 'impact', labelKey: 'fieldImpact' },
  ],
  item: [
    { key: 'type', labelKey: 'fieldType' },
    { key: 'rank', labelKey: 'fieldRank' },
    { key: 'effect', labelKey: 'fieldEffect' },
    { key: 'origin', labelKey: 'fieldOrigin' },
    { key: 'owner', labelKey: 'fieldOwner' },
  ],
  realm: [
    { key: 'order', labelKey: 'fieldOrder' },
    { key: 'requirement', labelKey: 'fieldRequirement' },
    { key: 'ability', labelKey: 'fieldAbility' },
    { key: 'lifespan', labelKey: 'fieldLifespan' },
  ],
  custom: [],
};
