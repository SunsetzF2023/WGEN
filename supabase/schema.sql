-- WorldForge Supabase Schema

create table if not exists entities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
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

-- RLS: users can only see and modify their own entities
alter table entities enable row level security;

create policy "Users can view own entities"
  on entities for select
  using (auth.uid() = owner_id);

create policy "Users can insert own entities"
  on entities for insert
  with check (auth.uid() = owner_id);

create policy "Users can update own entities"
  on entities for update
  using (auth.uid() = owner_id);

create policy "Users can delete own entities"
  on entities for delete
  using (auth.uid() = owner_id);

-- Index for faster queries
create index if not exists entities_owner_id_idx on entities(owner_id);
