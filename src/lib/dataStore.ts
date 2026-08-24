import type { Entity } from '../types';
import { supabase } from './supabase';

const TABLE = 'entities';
const LOCAL_KEY = 'wgen_entities_v1';

/** Load entities from localStorage (for unauthenticated users) */
export function loadLocalEntities(): Entity[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Entity[];
  } catch {
    return [];
  }
}

export function saveLocalEntities(entities: Entity[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(entities));
}

/** Load entities from Supabase for the current user */
export async function loadCloudEntities(userId: string): Promise<Entity[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('owner_id', userId);
  if (error) {
    console.error('[supabase] loadCloudEntities:', error);
    return [];
  }
  return (data || []).map(rowToEntity);
}

/** Save a single entity to Supabase (upsert) */
export async function saveCloudEntity(entity: Entity): Promise<boolean> {
  const row = entityToRow(entity);
  const { error } = await supabase.from(TABLE).upsert(row, { onConflict: 'id' });
  if (error) {
    console.error('[supabase] saveCloudEntity:', error);
    return false;
  }
  return true;
}

/** Delete an entity from Supabase */
export async function deleteCloudEntity(id: string): Promise<boolean> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) {
    console.error('[supabase] deleteCloudEntity:', error);
    return false;
  }
  return true;
}

function rowToEntity(row: Record<string, unknown>): Entity {
  return {
    id: row.id as string,
    name: row.name as string,
    type: row.type as Entity['type'],
    customTypeLabel: (row.custom_type_label as string) || undefined,
    icon: row.icon as string,
    summary: (row.summary as string) || '',
    description: (row.description as string) || '',
    imageUrl: (row.image_url as string) || undefined,
    audioUrl: (row.audio_url as string) || undefined,
    fields: (row.fields as Entity['fields']) || [],
    tags: (row.tags as string[]) || [],
    relationIds: (row.relation_ids as string[]) || [],
    position: (row.position as { x: number; y: number }) || undefined,
    owner_id: row.owner_id as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function entityToRow(e: Entity): Record<string, unknown> {
  return {
    id: e.id,
    name: e.name,
    type: e.type,
    custom_type_label: e.customTypeLabel || null,
    icon: e.icon,
    summary: e.summary,
    description: e.description,
    image_url: e.imageUrl || null,
    audio_url: e.audioUrl || null,
    fields: e.fields,
    tags: e.tags,
    relation_ids: e.relationIds,
    position: e.position || null,
    owner_id: e.owner_id,
    updated_at: e.updated_at,
  };
}
