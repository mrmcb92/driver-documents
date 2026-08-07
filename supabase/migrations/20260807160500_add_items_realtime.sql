create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

alter table public.items enable row level security;

create policy "Users can only access their own items"
  on public.items
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists items_user_id_updated_at_idx
  on public.items (user_id, updated_at desc);

-- Enable Realtime
alter publication supabase_realtime add table public.items;
