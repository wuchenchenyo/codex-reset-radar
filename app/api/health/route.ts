import { isAiConfigured, isSupabaseConfigured, isXConfigured } from "@/lib/env/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    supabase: isSupabaseConfigured(),
    x: isXConfigured(),
    ai: isAiConfigured(),
  });
}
