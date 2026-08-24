-- WorldForge Supabase Schema

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

-- RLS for projects
alter table projects enable row level security;

create policy "Users can view own projects"
  on projects for select
  using (auth.uid() = owner_id);

create policy "Anyone can view public projects"
  on projects for select
  using (is_public = true);

create policy "Users can insert own projects"
  on projects for insert
  with check (auth.uid() = owner_id);

create policy "Users can update own projects"
  on projects for update
  using (auth.uid() = owner_id);

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

create policy "Users can view own entities"
  on entities for select
  using (auth.uid() = owner_id);

create policy "Users can view entities in public projects"
  on entities for select
  using (
    exists (
      select 1 from projects
      where projects.id = entities.project_id
      and projects.is_public = true
    )
  );

create policy "Users can insert own entities"
  on entities for insert
  with check (auth.uid() = owner_id);

create policy "Users can update own entities"
  on entities for update
  using (auth.uid() = owner_id);

create policy "Users can delete own entities"
  on entities for delete
  using (auth.uid() = owner_id);

create index if not exists entities_owner_id_idx on entities(owner_id);
create index if not exists entities_project_id_idx on entities(project_id);
