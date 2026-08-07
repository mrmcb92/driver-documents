import { supabase } from '../lib/supabase';
import type { Document } from '../types/document';

type ItemRow = {
  id: string;
  user_id: string;
  data: Document;
  updated_at: string;
  created_at: string;
};

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('User not authenticated');
  return data.user.id;
}

function itemToDoc(row: ItemRow): Document {
  return row.data;
}

export function subscribeToItems(
  onChange: (documents: Document[]) => void
): () => void {
  const channel = supabase
    .channel('items-changes')
    .on<ItemRow>(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'items' },
      async () => {
        const { data } = await supabase.from('items').select('*');
        onChange((data ?? []).map(itemToDoc));
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function loadItems(): Promise<Document[]> {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(itemToDoc);
}

export async function upsertItem(doc: Document): Promise<Document> {
  const { data: existing } = await supabase
    .from('items')
    .select('updated_at')
    .eq('id', doc.id)
    .single();

  if (existing && new Date(existing.updated_at).getTime() > doc.updatedAt) {
    throw new Error('Conflict: server version is newer');
  }

  const updatedDoc: Document = { ...doc, updatedAt: Date.now() };

  const { data, error } = await supabase
    .from('items')
    .upsert({
      id: updatedDoc.id,
      user_id: await currentUserId(),
      data: updatedDoc as unknown as Record<string, unknown>,
      updated_at: new Date(updatedDoc.updatedAt).toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return itemToDoc(data as ItemRow);
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase.from('items').delete().eq('id', id);
  if (error) throw error;
}
