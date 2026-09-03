-- WorldForge Supabase Schema
-- Safe to re-run: all policies use drop-if-exists before create

-- ─── Projects ───
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null,
  icon text default '🌐',
  description text default '',
  is_public boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Add project_id column to entities if it doesn't exist (safe for existing tables)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'entities' and column_name = 'project_id'
  ) then
    alter table entities add column project_id uuid references projects(id) on delete cascade;
  end if;
end $$;

-- RLS for projects
alter table projects enable row level security;

drop policy if exists "Users can view own projects" on projects;
create policy "Users can view own projects"
  on projects for select
  using (auth.uid() = owner_id);

drop policy if exists "Anyone can view public projects" on projects;
create policy "Anyone can view public projects"
  on projects for select
  using (is_public = true);

drop policy if exists "Users can insert own projects" on projects;
create policy "Users can insert own projects"
  on projects for insert
  with check (auth.uid() = owner_id);

drop policy if exists "Users can update own projects" on projects;
create policy "Users can update own projects"
  on projects for update
  using (auth.uid() = owner_id);

drop policy if exists "Users can delete own projects" on projects;
create policy "Users can delete own projects"
  on projects for delete
  using (auth.uid() = owner_id);

create index if not exists projects_owner_id_idx on projects(owner_id);
create index if not exists projects_is_public_idx on projects(is_public);

-- ─── Entities ───
create table if not exists entities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  type text not null default 'custom',
  custom_type_label text,
  icon text default '📌',
  summary text default '',
  description text default '',
  image_url text,
  audio_url text,
  fields jsonb default '[]'::jsonb,
  tags text[] default '{}',
  relation_ids text[] default '{}',
  position jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS for entities
alter table entities enable row level security;

drop policy if exists "Users can view own entities" on entities;
create policy "Users can view own entities"
  on entities for select
  using (auth.uid() = owner_id);

drop policy if exists "Users can view entities in public projects" on entities;
create policy "Users can view entities in public projects"
  on entities for select
  using (
    exists (
      select 1 from projects
      where projects.id = entities.project_id
      and projects.is_public = true
    )
  );

drop policy if exists "Users can insert own entities" on entities;
create policy "Users can insert own entities"
  on entities for insert
  with check (auth.uid() = owner_id);

drop policy if exists "Users can update own entities" on entities;
create policy "Users can update own entities"
  on entities for update
  using (auth.uid() = owner_id);

drop policy if exists "Users can delete own entities" on entities;
create policy "Users can delete own entities"
  on entities for delete
  using (auth.uid() = owner_id);

create index if not exists entities_owner_id_idx on entities(owner_id);
create index if not exists entities_project_id_idx on entities(project_id);

-- ─── Cultivation mini-game: cultivators (养成) ───
create table if not exists cultivators (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '无名道友',
  exp bigint not null default 0,
  spirit_stones bigint not null default 50,
  techniques jsonb not null default '[{"id":"basic-strike","level":1}]'::jsonb,
  equipped jsonb not null default '["basic-strike"]'::jsonb,
  market jsonb not null default '{"offers":[],"refreshedAt":null}'::jsonb,
  last_collected_at timestamptz not null default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Idempotent for deployments that already ran an earlier version of this schema.
alter table cultivators add column if not exists market jsonb not null default '{"offers":[],"refreshedAt":null}'::jsonb;

alter table cultivators enable row level security;

-- Roster must be readable by any logged-in user so colleagues can be challenged.
drop policy if exists "Anyone can view cultivators" on cultivators;
create policy "Anyone can view cultivators"
  on cultivators for select
  using (true);

drop policy if exists "Users can insert own cultivator" on cultivators;
create policy "Users can insert own cultivator"
  on cultivators for insert
  with check (auth.uid() = owner_id);

drop policy if exists "Users can update own cultivator" on cultivators;
create policy "Users can update own cultivator"
  on cultivators for update
  using (auth.uid() = owner_id);

-- ─── Cultivation mini-game: battle_logs (对战记录) ───
create table if not exists battle_logs (
  id uuid primary key default gen_random_uuid(),
  attacker_id uuid references auth.users(id) on delete cascade,
  attacker_name text not null default '',
  defender_id uuid references auth.users(id) on delete cascade,
  defender_name text not null default '',
  winner_id uuid,
  log jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);

alter table battle_logs enable row level security;

drop policy if exists "Participants can view battle logs" on battle_logs;
create policy "Participants can view battle logs"
  on battle_logs for select
  using (auth.uid() = attacker_id or auth.uid() = defender_id);

drop policy if exists "Attacker can insert battle logs" on battle_logs;
create policy "Attacker can insert battle logs"
  on battle_logs for insert
  with check (auth.uid() = attacker_id);

create index if not exists battle_logs_attacker_idx on battle_logs(attacker_id);
create index if not exists battle_logs_defender_idx on battle_logs(defender_id);
