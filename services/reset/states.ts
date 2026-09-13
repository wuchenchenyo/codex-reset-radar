import type {
  EventStatus,
  PostAnalysis,
  ResetEventType,
  ResetType,
} from "@/types";

export function eventTypeFromAnalysis(analysis: PostAnalysis): ResetEventType | null {
  if (!analysis.relevant || analysis.category === "UNRELATED") return null;
  return analysis.category;
}

export function eventStatusFromAnalysis(analysis: PostAnalysis): EventStatus {
  if (analysis.category === "RESET_COMPLETED" || analysis.resetCompleted) {
    return "COMPLETED";
  }
  if (analysis.category === "GLOBAL_RESET") {
    return analysis.resetCompleted ? "COMPLETED" : "LIVE";
  }
  if (analysis.category === "BANKED_RESET") {
    return "LIVE";
  }
  if (analysis.category === "UPCOMING_RESET") {
    return analysis.estimatedResetTime || analysis.estimatedResetWindowEnd
      ? "INCOMING"
      : "ANNOUNCED";
  }
  return "POSSIBLE";
}

export function resetTypeFromAnalysis(analysis: PostAnalysis): ResetType {
  if (analysis.category === "BANKED_RESET") return "banked";
  if (analysis.resetType !== "unknown") return analysis.resetType;
  if (
    analysis.category === "GLOBAL_RESET" ||
    analysis.category === "RESET_COMPLETED" ||
    analysis.category === "UPCOMING_RESET"
  ) {
    return "automatic";
  }
  return "unknown";
}

export function canMergeTypes(a: ResetEventType, b: ResetEventType): boolean {
  if (a === "BANKED_RESET" || b === "BANKED_RESET") {
    return a === "BANKED_RESET" && b === "BANKED_RESET";
  }
  return true;
}

const STATUS_RANK: Record<EventStatus, number> = {
  POSSIBLE: 1,
  ANNOUNCED: 2,
  INCOMING: 3,
  LIVE: 4,
  COMPLETED: 5,
  EXPIRED: 0,
};

export function strongerStatus(current: EventStatus, incoming: EventStatus): EventStatus {
  if (current === "EXPIRED") return incoming;
  return STATUS_RANK[incoming] >= STATUS_RANK[current] ? incoming : current;
}

export function strongerType(
  current: ResetEventType,
  incoming: ResetEventType,
): ResetEventType {
  const rank: Record<ResetEventType, number> = {
    RESET_TEASER: 1,
    UPCOMING_RESET: 2,
    GLOBAL_RESET: 3,
    BANKED_RESET: 3,
    RESET_COMPLETED: 4,
  };
  return rank[incoming] >= rank[current] ? incoming : current;
}
