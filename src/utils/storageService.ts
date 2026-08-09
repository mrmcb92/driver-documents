import { supabase } from '../lib/supabaseClient';

const BUCKET = 'document-scans';
const MAX_SCAN_SIZE_MB = 10;

function objectPath(docId: string): string {
  return `scans/${docId}`;
}

export function getScanSizeLimitMb(): number {
  return MAX_SCAN_SIZE_MB;
}

export async function uploadDocumentScan(
  docId: string,
  file: File
): Promise<string> {
  if (file.size > MAX_SCAN_SIZE_MB * 1024 * 1024) {
    throw new Error(`Fișierul depășește limita de ${MAX_SCAN_SIZE_MB} MB.`);
  }

  const path = objectPath(docId);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || 'application/octet-stream' });

  if (error) {
    throw new Error(`Eroare la încărcarea scanului: ${error.message}`);
  }

  return path;
}

export async function removeDocumentScan(docId: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([objectPath(docId)]);
  if (error) {
    throw new Error(`Eroare la ștergerea scanului: ${error.message}`);
  }
}

export async function getSignedScanUrl(docId: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(objectPath(docId), 300);

  if (error || !data) return null;
  return data.signedUrl;
}
