export const RESET_CATEGORIES = [
  "GLOBAL_RESET",
  "BANKED_RESET",
  "UPCOMING_RESET",
  "RESET_TEASER",
  "RESET_COMPLETED",
  "UNRELATED",
] as const;

export type ResetCategory = (typeof RESET_CATEGORIES)[number];

export const RESET_EVENT_TYPES = [
  "GLOBAL_RESET",
  "BANKED_RESET",
  "UPCOMING_RESET",
  "RESET_TEASER",
  "RESET_COMPLETED",
] as const;

export type ResetEventType = (typeof RESET_EVENT_TYPES)[number];

export const EVENT_STATUSES = [
  "POSSIBLE",
  "ANNOUNCED",
  "INCOMING",
  "LIVE",
  "COMPLETED",
  "EXPIRED",
] as const;

export type EventStatus = (typeof EVENT_STATUSES)[number];

export const RESET_TYPES = ["automatic", "banked", "unknown"] as const;
export type ResetType = (typeof RESET_TYPES)[number];

export const CERTAINTY_LEVELS = [
  "confirmed",
  "estimated",
  "speculative",
] as const;
export type CertaintyLevel = (typeof CERTAINTY_LEVELS)[number];

export const ANALYSIS_STATUSES = ["pending", "completed", "failed"] as const;
export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];

export const NOTIFICATION_LEVELS = ["INFO", "IMPORTANT", "CRITICAL"] as const;
export type NotificationLevel = (typeof NOTIFICATION_LEVELS)[number];

export const NOTIFICATION_STATUSES = [
  "queued",
  "sent",
  "failed",
  "skipped",
] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const MONITOR_RUN_STATUSES = [
  "running",
  "success",
  "partial",
  "error",
] as const;
export type MonitorRunStatus = (typeof MONITOR_RUN_STATUSES)[number];

export interface SocialPost {
  externalId: string;
  platform: string;
  authorName: string;
  authorUsername: string;
  content: string;
  url: string;
  publishedAt: Date;
  rawData: Record<string, unknown>;
}

export interface StoredPost extends SocialPost {
  id: number;
  createdAt: Date;
  contentZh: string | null;
}

export interface PostAnalysis {
  relevant: boolean;
  category: ResetCategory;
  confidence: number;
  codexRelated: boolean;
  workRelated: boolean;
  resetConfirmed: boolean;
  resetCompleted: boolean;
  resetType: ResetType;
  timeExpression: string | null;
  estimatedResetTime: Date | null;
  estimatedResetWindowEnd: Date | null;
  summary: string;
  reasoningSummary: string;
  translationZh: string | null;
}

export interface StoredAnalysis extends PostAnalysis {
  id: number;
  postId: number;
  status: AnalysisStatus;
  model: string | null;
  createdAt: Date;
}

export interface ResetEvent {
  id: number;
  type: ResetEventType;
  status: EventStatus;
  resetType: ResetType;
  certainty: CertaintyLevel;
  announcedAt: Date | null;
  expectedAt: Date | null;
  expectedWindowEnd: Date | null;
  completedAt: Date | null;
  confidence: number;
  summary: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResetEventWithPosts extends ResetEvent {
  posts: StoredPost[];
  latestAnalysis: StoredAnalysis | null;
}

export interface MonitorRun {
  id: number;
  startedAt: Date;
  completedAt: Date | null;
  status: MonitorRunStatus;
  postsFetched: number;
  newPosts: number;
  relevantPosts: number;
  eventsCreated: number;
  notificationsSent: number;
  error: string | null;
}

export interface CronSummary {
  success: boolean;
  postsFetched: number;
  newPosts: number;
  relevantPosts: number;
  eventsCreated: number;
  notificationsSent: number;
  pendingAnalyses: number;
  sourceStatus: "ok" | "unavailable" | "unconfigured";
  error?: string;
}

export interface DashboardSnapshot {
  configured: boolean;
  database: "connected" | "unavailable" | "unconfigured";
  activeEvent: ResetEventWithPosts | null;
  latestPost: StoredPost | null;
  latestAnalysis: StoredAnalysis | null;
  lastRun: MonitorRun | null;
  lastSuccessfulRun: MonitorRun | null;
  recentErrors: string[];
}

export const TIBO_USERNAME = "thsottiaux";
export const TIBO_DISPLAY_NAME = "Tibo Sottiaux";
export const DEFAULT_TIMEZONE = "Asia/Shanghai";
export const TIBO_TIMEZONE = "America/Los_Angeles";
export const TEASER_NOTIFY_MIN_CONFIDENCE = 0.75;
export const EVENT_CORRELATION_WINDOW_HOURS = 72;
