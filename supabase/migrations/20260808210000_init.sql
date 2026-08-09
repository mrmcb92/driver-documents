-- ============================================================
-- driver-documents: schema initiala
-- Tabelul documents + RLS + bucket storage document-scans
-- ============================================================

-- ------------------------------------------------------------------
-- 1. Tabelul documents
-- ------------------------------------------------------------------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (
    type in (
      'medical-visit',
      'psychological',
      'itp',
      'rca',
      'conformity-copy',
      'criminal-record',
      'professional-cert',
      'casco',
      'onrc-excerpt',
      'custom'
    )
  ),
  title text not null check (char_length(title) between 1 and 200),
  issue_date date not null,
  expiry_date date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- poza / scan al documentului (cale in storage)
  attachment_path text
);

create index if not exists documents_user_id_idx on public.documents (user_id);
create index if not exists documents_expiry_date_idx on public.documents (expiry_date);

-- ------------------------------------------------------------------
-- 2. Trigger updated_at
-- ------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------
-- 3. Row Level Security
-- ------------------------------------------------------------------
alter table public.documents enable row level security;

drop policy if exists "documents_select_own" on public.documents;
create policy "documents_select_own"
  on public.documents
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "documents_insert_own" on public.documents;
create policy "documents_insert_own"
  on public.documents
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "documents_update_own" on public.documents;
create policy "documents_update_own"
  on public.documents
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "documents_delete_own" on public.documents;
create policy "documents_delete_own"
  on public.documents
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ------------------------------------------------------------------
-- 4. Bucket de storage pentru scanuri (privat - doar proprietarul)
-- ------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('document-scans', 'document-scans', false)
on conflict (id) do nothing;

drop policy if exists "docs_scans_select_own" on storage.objects;
create policy "docs_scans_select_own"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'document-scans' and auth.uid() = owner);

drop policy if exists "docs_scans_insert_own" on storage.objects;
create policy "docs_scans_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'document-scans' and auth.uid() = owner);

drop policy if exists "docs_scans_update_own" on storage.objects;
create policy "docs_scans_update_own"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'document-scans' and auth.uid() = owner);

drop policy if exists "docs_scans_delete_own" on storage.objects;
create policy "docs_scans_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'document-scans' and auth.uid() = owner);
