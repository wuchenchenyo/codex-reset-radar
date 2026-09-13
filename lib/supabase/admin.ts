import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv, isSupabaseConfigured } from "@/lib/env/server";

export function createAdminClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  const env = getServerEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
