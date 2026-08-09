import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Non-null when the Supabase env vars are missing at build time.
 * The app renders a readable error screen instead of crashing with a
 * white page, because a module-scope throw would kill the whole tree
 * before React even mounts.
 */
export const supabaseConfigError: string | null = isConfigured
  ? null
  : 'Lipsesc variabilele de mediu VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Adaugă-le în setările Vercel (Settings → Environment Variables, apoi Redeploy) sau într-un fișier .env.local pentru dezvoltare locală.';

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;
