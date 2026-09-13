import { z } from "zod";
import { isManualIngestAllowed, isSupabaseConfigured } from "@/lib/env/server";
import { authorizeCron, unauthorizedResponse } from "@/services/monitor/auth";
import { createMonitorStack } from "@/services/monitor/factory";
import { runMonitor } from "@/services/monitor/pipeline";
import { ManualSource, makeManualPost } from "@/services/social";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  content: z.string().min(1).max(4000),
  publishedAt: z.string().optional(),
  externalId: z.string().min(1).max(120).optional(),
  skipNotifications: z.boolean().optional(),
});

export async function POST(request: Request) {
  if (!isManualIngestAllowed()) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (!authorizeCron(request)) {
    return unauthorizedResponse();
  }
  if (!isSupabaseConfigured()) {
    return Response.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const publishedAt = parsed.data.publishedAt ? new Date(parsed.data.publishedAt) : new Date();
  if (Number.isNaN(publishedAt.getTime())) {
    return Response.json({ error: "Invalid publishedAt" }, { status: 400 });
  }

  const post = makeManualPost({
    content: parsed.data.content,
    publishedAt,
    externalId: parsed.data.externalId,
  });

  const stack = createMonitorStack({ source: new ManualSource([post]) });
  const summary = await runMonitor(stack);
  return Response.json(summary);
}
