import { EVENT_CORRELATION_WINDOW_HOURS, type ResetEvent, type ResetEventType } from "@/types";
import { canMergeTypes } from "@/services/reset/states";

export function findRelatedEvent(
  events: ResetEvent[],
  incomingType: ResetEventType,
  publishedAt: Date,
): ResetEvent | null {
  const windowMs = EVENT_CORRELATION_WINDOW_HOURS * 60 * 60 * 1000;
  const open = events.filter((event) => event.status !== "EXPIRED");
  const candidates = open
    .filter((event) => canMergeTypes(event.type, incomingType))
    .filter((event) => {
      const anchor = event.announcedAt ?? event.createdAt;
      return Math.abs(publishedAt.getTime() - anchor.getTime()) <= windowMs;
    })
    .sort((a, b) => {
      const aTime = (a.announcedAt ?? a.createdAt).getTime();
      const bTime = (b.announcedAt ?? b.createdAt).getTime();
      return Math.abs(publishedAt.getTime() - aTime) - Math.abs(publishedAt.getTime() - bTime);
    });
  return candidates[0] ?? null;
}
