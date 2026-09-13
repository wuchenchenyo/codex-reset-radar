import { isSupabaseConfigured } from "@/lib/env/server";
import { createRepository } from "@/services/monitor/factory";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return Response.json({ notifications: [] });
  }
  try {
    const repo = createRepository();
    const queued = await repo.listQueuedNotifications();
    const notifications = [];
    for (const item of queued) {
      const event = await repo.getEventById(item.resetEventId);
      if (!event) continue;
      notifications.push({
        id: item.id,
        key: item.notificationKey,
        level: item.level,
        title:
          event.status === "LIVE" || event.status === "COMPLETED"
            ? "Codex reset is live"
            : event.status === "INCOMING"
              ? "Upcoming Codex reset"
              : "Possible Codex reset",
        body: event.summary,
      });
      await repo.recordNotification({
        resetEventId: item.resetEventId,
        provider: item.provider,
        level: item.level,
        status: "sent",
        notificationKey: item.notificationKey,
      });
    }
    return Response.json({ notifications });
  } catch {
    return Response.json({ notifications: [] });
  }
}
