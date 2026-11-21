import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://bfmofulvsqojwuqyhfqq.supabase.co";
// Publishable key: safe to ship in the browser. Access to data is controlled
// by row-level security, not by keeping this value secret. It replaces the
// legacy JWT-based anon key, which Supabase is retiring.
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_A-pVUwUWVRyBVzNjZs64ug_E7EYzctX";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});