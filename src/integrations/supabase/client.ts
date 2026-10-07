import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Small wrapper around createClient so the rest of the app can just do
// `import { supabase } from "@/integrations/supabase/client"` and get a
// ready-to-use, typed client. URL + publishable (anon) key come from Vite
// env vars, so they're only embedded at build time.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
