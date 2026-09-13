import type {
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
import { certaintyFor } from "@/lib/validation/analysis";
import type { InsertedPost, RadarRepository } from "@/services/data/types";

function cloneDate(value: Date | null): Date | null {
  return value ? new Date(value) : null;
}

export class InMemoryRadarRepository implements RadarRepository {
  private posts = new Map<number, StoredPost>();
  private postsByExternal = new Map<string, number>();
  private analyses = new Map<number, StoredAnalysis>();
  private analysesByPost = new Map<number, number>();
  private events = new Map<number, ResetEvent>();
  private eventPosts = new Map<number, Set<number>>();
  private notifications = new Map<
    string,
    {
      id: number;
      resetEventId: number;
      provider: string;
      level: NotificationLevel;
      status: NotificationStatus;
      notificationKey: string;
    }
  >();
  private runs: MonitorRun[] = [];
  private postSeq = 1;
  private analysisSeq = 1;
  private eventSeq = 1;
  private runSeq = 1;
  private notificationSeq = 1;

  async upsertPost(post: SocialPost): Promise<InsertedPost> {
    const existingId = this.postsByExternal.get(`${post.platform}:${post.externalId}`);
    if (existingId) {
      return { post: this.posts.get(existingId)!, created: false };
    }
    const stored: StoredPost = {
      ...post,
      contentZh: null,
      id: this.postSeq++,
      createdAt: new Date(),
    };
    this.posts.set(stored.id, stored);
    this.postsByExternal.set(`${post.platform}:${post.externalId}`, stored.id);
    return { post: stored, created: true };
  }

  async getPostById(id: number): Promise<StoredPost | null> {
    return this.posts.get(id) ?? null;
  }

  async getLatestPost(): Promise<StoredPost | null> {
    return [...this.posts.values()].sort(
      (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime(),
    )[0] ?? null;
  }

  async getCompletedAnalysisForPost(postId: number): Promise<StoredAnalysis | null> {
    const id = this.analysesByPost.get(postId);
    if (!id) return null;
    const analysis = this.analyses.get(id);
    return analysis?.status === "completed" ? analysis : null;
  }

  async getPendingAnalyses(): Promise<Array<{ post: StoredPost; analysis: StoredAnalysis }>> {
    const pending: Array<{ post: StoredPost; analysis: StoredAnalysis }> = [];
    for (const analysis of this.analyses.values()) {
      if (analysis.status !== "pending") continue;
      const post = this.posts.get(analysis.postId);
      if (post) pending.push({ post, analysis });
    }
    return pending;
  }

  async saveCompletedAnalysis(
    postId: number,
    analysis: PostAnalysis,
    model: string,
  ): Promise<StoredAnalysis> {
    const stored: StoredAnalysis = {
      ...analysis,
      id: this.analysesByPost.get(postId) ?? this.analysisSeq++,
      postId,
      status: "completed",
      model,
      createdAt: new Date(),
    };
    this.analyses.set(stored.id, stored);
    this.analysesByPost.set(postId, stored.id);
    const post = this.posts.get(postId);
    if (post && analysis.translationZh) {
      this.posts.set(postId, { ...post, contentZh: analysis.translationZh });
    }
    return stored;
  }

  async markAnalysisPending(postId: number): Promise<StoredAnalysis> {
    const existingId = this.analysesByPost.get(postId);
    const stored: StoredAnalysis = {
      id: existingId ?? this.analysisSeq++,
      postId,
      relevant: false,
      category: "UNRELATED",
      confidence: 0,
      codexRelated: false,
      workRelated: false,
      resetConfirmed: false,
      resetCompleted: false,
      resetType: "unknown",
      timeExpression: null,
      estimatedResetTime: null,
      estimatedResetWindowEnd: null,
      summary: "Analysis pending",
      reasoningSummary: "The model response was unavailable and will be retried.",
      translationZh: null,
      status: "pending",
      model: null,
      createdAt: new Date(),
    };
    this.analyses.set(stored.id, stored);
    this.analysesByPost.set(postId, stored.id);
    return stored;
  }

  async listOpenEvents(): Promise<ResetEvent[]> {
    return [...this.events.values()].filter((event) => event.status !== "EXPIRED");
  }

  async getEventById(id: number): Promise<ResetEventWithPosts | null> {
    const event = this.events.get(id);
    if (!event) return null;
    return this.withPosts(event);
  }

  async getActiveEvent(): Promise<ResetEventWithPosts | null> {
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    const ranked = [...this.events.values()]
      .filter((event) => event.status !== "EXPIRED")
      .filter((event) => {
        if (event.status !== "COMPLETED") return true;
        const done = event.completedAt ?? event.updatedAt;
        return done.getTime() >= cutoff;
      })
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    const event = ranked[0];
    return event ? this.withPosts(event) : null;
  }

  async listEvents(filters?: {
    types?: string[];
    statuses?: string[];
    limit?: number;
    offset?: number;
  }): Promise<{ events: ResetEventWithPosts[]; total: number }> {
    let items = [...this.events.values()].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
    if (filters?.types?.length) {
      items = items.filter((event) => filters.types!.includes(event.type));
    }
    if (filters?.statuses?.length) {
      items = items.filter((event) => filters.statuses!.includes(event.status));
    }
    const total = items.length;
    const offset = filters?.offset ?? 0;
    const limit = filters?.limit ?? 20;
    const page = await Promise.all(
      items.slice(offset, offset + limit).map((event) => this.withPosts(event)),
    );
    return { events: page, total };
  }

  async createEvent(input: {
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
  }): Promise<ResetEvent> {
    const now = new Date();
    const event: ResetEvent = {
      id: this.eventSeq++,
      type: input.type,
      status: input.status,
      resetType: input.resetType,
      certainty: input.certainty,
      announcedAt: input.announcedAt,
      expectedAt: cloneDate(input.expectedAt),
      expectedWindowEnd: cloneDate(input.expectedWindowEnd),
      completedAt: cloneDate(input.completedAt),
      confidence: input.confidence,
      summary: input.summary,
      createdAt: now,
      updatedAt: now,
    };
    this.events.set(event.id, event);
    this.eventPosts.set(event.id, new Set([input.postId]));
    return event;
  }

  async updateEvent(
    id: number,
    patch: Partial<ResetEvent> & { postId?: number },
  ): Promise<ResetEvent> {
    const current = this.events.get(id);
    if (!current) throw new Error(`Event ${id} not found`);
    const next: ResetEvent = {
      ...current,
      ...patch,
      id,
      updatedAt: new Date(),
    };
    this.events.set(id, next);
    if (patch.postId) {
      const set = this.eventPosts.get(id) ?? new Set();
      set.add(patch.postId);
      this.eventPosts.set(id, set);
    }
    return next;
  }

  async hasNotification(
    resetEventId: number,
    notificationKey: string,
    provider = "browser",
  ): Promise<boolean> {
    return this.notifications.has(`${resetEventId}:${provider}:${notificationKey}`);
  }

  async recordNotification(input: {
    resetEventId: number;
    provider: string;
    level: NotificationLevel;
    status: NotificationStatus;
    notificationKey: string;
  }): Promise<void> {
    const key = `${input.resetEventId}:${input.provider}:${input.notificationKey}`;
    this.notifications.set(key, {
      id: this.notificationSeq++,
      ...input,
    });
  }

  async listQueuedNotifications() {
    return [...this.notifications.values()].filter((item) => item.status === "queued");
  }

  async startMonitorRun(): Promise<MonitorRun> {
    const run: MonitorRun = {
      id: this.runSeq++,
      startedAt: new Date(),
      completedAt: null,
      status: "running",
      postsFetched: 0,
      newPosts: 0,
      relevantPosts: 0,
      eventsCreated: 0,
      notificationsSent: 0,
      error: null,
    };
    this.runs.push(run);
    return run;
  }

  async finishMonitorRun(
    id: number,
    summary: CronSummary,
    status: MonitorRunStatus,
    error?: string | null,
  ): Promise<void> {
    const run = this.runs.find((item) => item.id === id);
    if (!run) return;
    run.completedAt = new Date();
    run.status = status;
    run.postsFetched = summary.postsFetched;
    run.newPosts = summary.newPosts;
    run.relevantPosts = summary.relevantPosts;
    run.eventsCreated = summary.eventsCreated;
    run.notificationsSent = summary.notificationsSent;
    run.error = error ?? null;
  }

  async getLatestRun(): Promise<MonitorRun | null> {
    return this.runs.at(-1) ?? null;
  }

  async getLatestSuccessfulRun(): Promise<MonitorRun | null> {
    return [...this.runs].reverse().find((run) => run.status === "success") ?? null;
  }

  async getRecentRunErrors(limit = 5): Promise<string[]> {
    const lastSuccess = [...this.runs].reverse().find((run) => run.status === "success");
    return this.runs
      .filter((run) => run.error)
      .filter((run) => !lastSuccess || run.startedAt > lastSuccess.startedAt)
      .slice(-limit)
      .reverse()
      .map((run) => run.error!);
  }

  async getEventStats() {
    const events = [...this.events.values()].filter((event) =>
      ["LIVE", "COMPLETED"].includes(event.status),
    );
    const globalResets = events.filter((event) => event.type === "GLOBAL_RESET" || event.type === "RESET_COMPLETED").length;
    const bankedResets = events.filter((event) => event.type === "BANKED_RESET").length;
    const dated = events
      .map((event) => event.completedAt ?? event.announcedAt)
      .filter((value): value is Date => Boolean(value))
      .sort((a, b) => a.getTime() - b.getTime());
    let averageDaysBetween: number | null = null;
    if (dated.length >= 2) {
      const gaps = dated.slice(1).map((date, index) => date.getTime() - dated[index]!.getTime());
      averageDaysBetween = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length / 86400000;
    }
    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);
    const announcementsThisMonth = [...this.events.values()].filter(
      (event) => event.announcedAt && event.announcedAt >= startOfMonth,
    ).length;
    return {
      totalResets: events.length,
      globalResets,
      bankedResets,
      averageDaysBetween,
      announcementsThisMonth,
    };
  }

  private async withPosts(event: ResetEvent): Promise<ResetEventWithPosts> {
    const postIds = [...(this.eventPosts.get(event.id) ?? new Set())];
    const posts = postIds
      .map((id) => this.posts.get(id))
      .filter((post): post is StoredPost => Boolean(post))
      .sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime());
    const latestPost = posts.at(-1);
    const latestAnalysis = latestPost
      ? (await this.getCompletedAnalysisForPost(latestPost.id)) ??
        (this.analysesByPost.has(latestPost.id)
          ? this.analyses.get(this.analysesByPost.get(latestPost.id)!) ?? null
          : null)
      : null;
    return { ...event, posts, latestAnalysis };
  }
}

export { certaintyFor };
