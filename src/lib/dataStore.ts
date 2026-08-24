import type { Entity, WorldProject } from '../types';
import { supabase } from './supabase';

const ENTITIES_TABLE = 'entities';
const PROJECTS_TABLE = 'projects';
const LOCAL_ENTITIES_KEY = 'wgen_entities_v1';
const LOCAL_PROJECTS_KEY = 'wgen_projects_v1';

// ─── Projects ───

/** Load projects from localStorage */
export function loadLocalProjects(): WorldProject[] {
  try {
    const raw = localStorage.getItem(LOCAL_PROJECTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as WorldProject[];
  } catch {
    return [];
  }
}

export function saveLocalProjects(projects: WorldProject[]) {
  localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(projects));
}

/** Load projects from Supabase for the current user */
export async function loadCloudProjects(userId: string): Promise<WorldProject[]> {
  const { data, error } = await supabase
    .from(PROJECTS_TABLE)
    .select('*')
    .eq('owner_id', userId);
  if (error) {
    console.error('[supabase] loadCloudProjects:', error);
    return [];
  }
  return (data || []).map(rowToProject);
}

/** Save a single project to Supabase (upsert) */
export async function saveCloudProject(project: WorldProject): Promise<boolean> {
  const { error } = await supabase.from(PROJECTS_TABLE).upsert(projectToRow(project), { onConflict: 'id' });
  if (error) {
    console.error('[supabase] saveCloudProject:', error);
    return false;
  }
  return true;
}

/** Delete a project from Supabase (cascades to entities via FK) */
export async function deleteCloudProject(id: string): Promise<boolean> {
  const { error } = await supabase.from(PROJECTS_TABLE).delete().eq('id', id);
  if (error) {
    console.error('[supabase] deleteCloudProject:', error);
    return false;
  }
  return true;
}

/** Load public projects from all users (for Cloud World browsing) */
export async function loadPublicProjects(excludeUserId?: string): Promise<WorldProject[]> {
  let query = supabase.from(PROJECTS_TABLE).select('*').eq('is_public', true);
  if (excludeUserId) {
    query = query.neq('owner_id', excludeUserId);
  }
  const { data, error } = await query;
  if (error) {
    console.error('[supabase] loadPublicProjects:', error);
    return [];
  }
  return (data || []).map(rowToProject);
}

/** Load all entities for a specific project (read-only, for cloud browsing) */
export async function loadCloudEntitiesByProject(projectId: string): Promise<Entity[]> {
  const { data, error } = await supabase
    .from(ENTITIES_TABLE)
    .select('*')
    .eq('project_id', projectId);
  if (error) {
    console.error('[supabase] loadCloudEntitiesByProject:', error);
    return [];
  }
  return (data || []).map(rowToEntity);
}

function rowToProject(row: Record<string, unknown>): WorldProject {
  return {
    id: row.id as string,
    name: row.name as string,
    icon: (row.icon as string) || '🌐',
    description: (row.description as string) || '',
    isPublic: (row.is_public as boolean) || false,
    owner_id: row.owner_id as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function projectToRow(p: WorldProject): Record<string, unknown> {
  return {
    id: p.id,
    name: p.name,
    icon: p.icon,
    description: p.description,
    is_public: p.isPublic,
    owner_id: p.owner_id,
    created_at: p.created_at,
    updated_at: p.updated_at,
  };
}

// ─── Entities ───

/** Load entities from localStorage (for unauthenticated users) */
export function loadLocalEntities(): Entity[] {
  try {
    const raw = localStorage.getItem(LOCAL_ENTITIES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Entity[];
  } catch {
    return [];
  }
}

export function saveLocalEntities(entities: Entity[]) {
  localStorage.setItem(LOCAL_ENTITIES_KEY, JSON.stringify(entities));
}

/** Load entities from Supabase for the current user */
export async function loadCloudEntities(userId: string): Promise<Entity[]> {
  const { data, error } = await supabase
    .from(ENTITIES_TABLE)
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
  const { error } = await supabase.from(ENTITIES_TABLE).upsert(row, { onConflict: 'id' });
  if (error) {
    console.error('[supabase] saveCloudEntity:', error);
    return false;
  }
  return true;
}

/** Delete an entity from Supabase */
export async function deleteCloudEntity(id: string): Promise<boolean> {
  const { error } = await supabase.from(ENTITIES_TABLE).delete().eq('id', id);
  if (error) {
    console.error('[supabase] deleteCloudEntity:', error);
    return false;
  }
  return true;
}

/** Delete all entities for a project from Supabase */
export async function deleteCloudEntitiesByProject(projectId: string): Promise<boolean> {
  const { error } = await supabase.from(ENTITIES_TABLE).delete().eq('project_id', projectId);
  if (error) {
    console.error('[supabase] deleteCloudEntitiesByProject:', error);
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
    project_id: (row.project_id as string) || '',
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
    project_id: e.project_id,
    updated_at: e.updated_at,
  };
}
