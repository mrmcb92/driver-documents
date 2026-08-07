-- Tabele pentru motorul de sincronizare (identice ca logică cu server/index.js)

create table if not exists public.documents (
  id text primary key,
  type text not null,
  title text not null,
  issue_date text not null,
  expiry_date text not null,
  notes text,
  created_at bigint not null, -- epoch ms
  updated_at bigint not null  -- epoch ms
);

create table if not exists public.tombstones (
  id text primary key,
  deleted_at bigint not null -- epoch ms
);

create index if not exists idx_documents_updated_at
  on public.documents (updated_at);
create index if not exists idx_tombstones_deleted_at
  on public.tombstones (deleted_at);

-- Acces doar prin Edge Function (service_role). Fără politici RLS,
-- clienții nu pot citi/scrie direct prin PostgREST.
alter table public.documents enable row level security;
alter table public.tombstones enable row level security;
