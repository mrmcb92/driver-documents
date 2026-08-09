-- ============================================================
-- driver-documents: activare Realtime pentru tabelul documents
-- Necesar pentru sincronizarea în timp real între dispozitive.
-- ============================================================

-- Adaugă tabelul la publicația supabase_realtime dacă nu e deja acolo
-- (idempotent, ca migrarea să poată fi rulată de mai multe ori fără eroare).
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'documents'
  ) then
    alter publication supabase_realtime add table public.documents;
  end if;
end;
$$;
