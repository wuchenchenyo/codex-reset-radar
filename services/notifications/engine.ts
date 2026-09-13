import { log } from "@/lib/logging";
import type { RadarRepository } from "@/services/data/types";
import {
  notificationCopy,
  notificationLevelFor,
  type NotificationPayload,
  type NotificationProvider,
} from "@/services/notifications/types";
import type { ResetEvent } from "@/types";

export class QueuedBrowserProvider implements NotificationProvider {
  readonly id = "browser";

  constructor(private readonly repo: RadarRepository) {}

  async send(payload: NotificationPayload): Promise<void> {
    await this.repo.recordNotification({
      resetEventId: payload.event.id,
      provider: this.id,
      level: payload.level,
      status: "queued",
      notificationKey: payload.key,
    });
  }
}

export class NotificationEngine {
  constructor(
    private readonly repo: RadarRepository,
    private readonly providers: NotificationProvider[],
  ) {}

  async notify(event: ResetEvent): Promise<number> {
    const level = notificationLevelFor(event);
    if (!level) return 0;

    const key = `${event.status}:${event.type}`;
    const copy = notificationCopy(event);
    const payload: NotificationPayload = {
      event,
      level,
      title: copy.title,
      body: copy.body,
      key,
    };

    let sent = 0;
    for (const provider of this.providers) {
      if (await this.repo.hasNotification(event.id, key, provider.id)) continue;
      try {
        await provider.send(payload);
        sent += 1;
      } catch (error) {
        log.error("notification_error", { provider: provider.id });
        await this.repo.recordNotification({
          resetEventId: event.id,
          provider: provider.id,
          level,
          status: "failed",
          notificationKey: key,
          error: error instanceof Error ? error.message : "Notification failed",
        });
      }
    }
    return sent;
  }
}
