import type { NotificationLevel, ResetEvent } from "@/types";

export interface NotificationPayload {
  event: ResetEvent;
  level: NotificationLevel;
  title: string;
  body: string;
  key: string;
}

export interface NotificationProvider {
  readonly id: string;
  send(payload: NotificationPayload): Promise<void>;
}

export function notificationLevelFor(event: ResetEvent): NotificationLevel | null {
  if (event.type === "RESET_TEASER") {
    return event.confidence >= 0.75 ? "INFO" : null;
  }
  if (event.status === "LIVE" || event.status === "COMPLETED") return "CRITICAL";
  if (event.status === "INCOMING" || event.status === "ANNOUNCED") return "IMPORTANT";
  if (event.type === "BANKED_RESET") return "IMPORTANT";
  return "INFO";
}

export function notificationCopy(event: ResetEvent): { title: string; body: string } {
  if (event.status === "LIVE" || event.status === "COMPLETED") {
    return {
      title: event.type === "BANKED_RESET" ? "Banked reset available" : "Codex reset is live",
      body: event.summary,
    };
  }
  if (event.status === "INCOMING" || event.status === "ANNOUNCED") {
    return {
      title: "Upcoming Codex reset",
      body: event.summary,
    };
  }
  return {
    title: "Possible Codex reset",
    body: event.summary,
  };
}
