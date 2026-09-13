import type {
  AnalysisStatus,
  CronSummary,
  MonitorRun,
  MonitorRunStatus,
  NotificationLevel,
  NotificationStatus,
  PostAnalysis,
  ResetEvent,
  ResetEventWithPosts,
  SocialPost,
  StoredAnalysis,
  StoredPost,
} from "@/types";

export interface InsertedPost {
  post: StoredPost;
  created: boolean;
}

export interface RadarRepository {
  upsertPost(post: SocialPost): Promise<InsertedPost>;
  getPostById(id: number): Promise<StoredPost | null>;
  getLatestPost(): Promise<StoredPost | null>;
  getCompletedAnalysisForPost(postId: number): Promise<StoredAnalysis | null>;
  getPendingAnalyses(limit?: number): Promise<Array<{ post: StoredPost; analysis: StoredAnalysis }>>;
  saveCompletedAnalysis(postId: number, analysis: PostAnalysis, model: string): Promise<StoredAnalysis>;
  markAnalysisPending(postId: number, error?: string): Promise<StoredAnalysis>;
  listOpenEvents(): Promise<ResetEvent[]>;
  getEventById(id: number): Promise<ResetEventWithPosts | null>;
  getActiveEvent(): Promise<ResetEventWithPosts | null>;
  listEvents(filters?: {
    types?: string[];
    statuses?: string[];
    limit?: number;
    offset?: number;
  }): Promise<{ events: ResetEventWithPosts[]; total: number }>;
  createEvent(input: {
    type: ResetEvent["type"];
    status: ResetEvent["status"];
    resetType: ResetEvent["resetType"];
    certainty: ResetEvent["certainty"];
    announcedAt: Date;
    expectedAt: Date | null;
    expectedWindowEnd: Date | null;
    completedAt: Date | null;
    confidence: number;
    summary: string;
    postId: number;
  }): Promise<ResetEvent>;
  updateEvent(
    id: number,
    patch: Partial<
      Pick<
        ResetEvent,
        | "type"
        | "status"
        | "resetType"
        | "certainty"
        | "expectedAt"
        | "expectedWindowEnd"
        | "completedAt"
        | "confidence"
        | "summary"
      >
    > & { postId?: number },
  ): Promise<ResetEvent>;
  hasNotification(resetEventId: number, notificationKey: string, provider?: string): Promise<boolean>;
  recordNotification(input: {
    resetEventId: number;
    provider: string;
    level: NotificationLevel;
    status: NotificationStatus;
    notificationKey: string;
    error?: string | null;
  }): Promise<void>;
  listQueuedNotifications(): Promise<
    Array<{
      id: number;
      resetEventId: number;
      provider: string;
      level: NotificationLevel;
      notificationKey: string;
    }>
  >;
  startMonitorRun(): Promise<MonitorRun>;
  finishMonitorRun(
    id: number,
    summary: CronSummary,
    status: MonitorRunStatus,
    error?: string | null,
  ): Promise<void>;
  getLatestRun(): Promise<MonitorRun | null>;
  getLatestSuccessfulRun(): Promise<MonitorRun | null>;
  getRecentRunErrors(limit?: number): Promise<string[]>;
  getEventStats(): Promise<{
    totalResets: number;
    globalResets: number;
    bankedResets: number;
    averageDaysBetween: number | null;
    announcementsThisMonth: number;
  }>;
}

export type { AnalysisStatus };
