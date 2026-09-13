import { isSupabaseConfigured } from "@/lib/env/server";
import { log } from "@/lib/logging";
import { authorizeCron, unauthorizedResponse } from "@/services/monitor/auth";
import { createMonitorStack } from "@/services/monitor/factory";
import { runMonitor } from "@/services/monitor/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return unauthorizedResponse();
  }

  if (!isSupabaseConfigured()) {
    return Response.json(
      { success: false, error: "Supabase is not configured" },
      { status: 503 },
    );
  }

  try {
    const stack = createMonitorStack();
    const summary = await runMonitor(stack);
    return Response.json(summary, { status: summary.success ? 200 : 207 });
  } catch (error) {
    log.error("cron_route_error");
    return Response.json(
      {
        success: false,
        postsFetched: 0,
        newPosts: 0,
        relevantPosts: 0,
        eventsCreated: 0,
        notificationsSent: 0,
        error: error instanceof Error ? error.message : "Cron failed",
      },
      { status: 500 },
    );
  }
}
