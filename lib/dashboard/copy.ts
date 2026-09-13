import type { EventStatus, ResetEvent, ResetEventType } from "@/types";

export interface HeroState {
  kicker: string;
  title: string;
  detail: string;
  tone: "idle" | "possible" | "incoming" | "live" | "banked";
}

export function heroForEvent(event: ResetEvent | null): HeroState {
  if (!event) {
    return {
      kicker: "Codex reset status",
      title: "No reset announced",
      detail: "No confirmed Codex reset signals detected.",
      tone: "idle",
    };
  }

  if (event.type === "BANKED_RESET") {
    return {
      kicker: "Codex reset status",
      title: "Banked reset available",
      detail: "Check ChatGPT → Settings → Usage to redeem it. This app never spends a reset for you.",
      tone: "banked",
    };
  }

  if (event.status === "LIVE" || event.status === "COMPLETED") {
    return {
      kicker: "Codex reset status",
      title: event.type === "GLOBAL_RESET" ? "Global reset live" : "Reset completed",
      detail: "Codex usage limits appear to have been reset. Check your Codex usage now.",
      tone: "live",
    };
  }

  if (event.status === "INCOMING" || event.status === "ANNOUNCED") {
    return {
      kicker: "Codex reset status",
      title: "Reset incoming",
      detail: event.summary,
      tone: "incoming",
    };
  }

  return {
    kicker: "Codex reset status",
    title: "Possible reset",
    detail: "Tibo hinted at a possible Codex event. Not confirmed.",
    tone: "possible",
  };
}

export function categoryLabel(type: ResetEventType | string): string {
  switch (type) {
    case "GLOBAL_RESET":
      return "Global reset";
    case "BANKED_RESET":
      return "Banked reset";
    case "UPCOMING_RESET":
      return "Upcoming reset";
    case "RESET_TEASER":
      return "Possible reset";
    case "RESET_COMPLETED":
      return "Reset completed";
    default:
      return "Unrelated";
  }
}

export function statusLabel(status: EventStatus): string {
  switch (status) {
    case "POSSIBLE":
      return "Possible";
    case "ANNOUNCED":
      return "Announced";
    case "INCOMING":
      return "Incoming";
    case "LIVE":
      return "Live";
    case "COMPLETED":
      return "Completed";
    case "EXPIRED":
      return "Expired";
  }
}
