-- Atribuie automat user_id = utilizatorul autentificat la insert,
-- indiferent ce trimite clientul (pattern standard Supabase).
create or replace function public.set_document_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.user_id := auth.uid();
  return new;
end;
$$;

drop trigger if exists documents_set_user_id on public.documents;
create trigger documents_set_user_id
before insert on public.documents
for each row execute function public.set_document_user_id();
