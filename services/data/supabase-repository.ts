import type { SupabaseClient } from "@supabase/supabase-js";
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
import type { RadarRepository } from "@/services/data/types";
import {
  mapAnalysis,
  mapEvent,
  mapPost,
  mapRun,
  postInsert,
  type AnalysisRow,
  type EventRow,
  type PostRow,
  type RunRow,
} from "@/services/data/mappers";

export class SupabaseRadarRepository implements RadarRepository {
  constructor(private readonly client: SupabaseClient) {}

  async upsertPost(post: SocialPost): Promise<{ post: StoredPost; created: boolean }> {
    const { data: existing, error: lookupError } = await this.client
      .from("posts")
      .select("*")
      .eq("platform", post.platform)
      .eq("external_id", post.externalId)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) {
      return { post: mapPost(existing as PostRow), created: false };
    }

    const { data, error } = await this.client
      .from("posts")
      .insert(postInsert(post))
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") {
        const { data: raced, error: racedError } = await this.client
          .from("posts")
          .select("*")
          .eq("platform", post.platform)
          .eq("external_id", post.externalId)
          .single();
        if (racedError) throw racedError;
        return { post: mapPost(raced as PostRow), created: false };
      }
      throw error;
    }
    return { post: mapPost(data as PostRow), created: true };
  }

  async getPostById(id: number): Promise<StoredPost | null> {
    const { data, error } = await this.client.from("posts").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? mapPost(data as PostRow) : null;
  }

  async getLatestPost(): Promise<StoredPost | null> {
    const { data, error } = await this.client
      .from("posts")
      .select("*")
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? mapPost(data as PostRow) : null;
  }

  async getCompletedAnalysisForPost(postId: number): Promise<StoredAnalysis | null> {
    const { data, error } = await this.client
      .from("analyses")
      .select("*")
      .eq("post_id", postId)
      .eq("status", "completed")
      .maybeSingle();
    if (error) throw error;
    return data ? mapAnalysis(data as AnalysisRow) : null;
  }

  async getPendingAnalyses(limit = 20): Promise<Array<{ post: StoredPost; analysis: StoredAnalysis }>> {
    const { data, error } = await this.client
      .from("analyses")
      .select("*, posts(*)")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) throw error;
    return (data ?? [])
      .map((row) => {
        const analysis = mapAnalysis(row as AnalysisRow);
        const postRow = (row as { posts?: PostRow }).posts;
        if (!postRow) return null;
        return { analysis, post: mapPost(postRow) };
      })
      .filter((item): item is { post: StoredPost; analysis: StoredAnalysis } => Boolean(item));
  }

  async saveCompletedAnalysis(
    postId: number,
    analysis: PostAnalysis,
    model: string,
  ): Promise<StoredAnalysis> {
    const payload = {
      post_id: postId,
      status: "completed",
      relevant: analysis.relevant,
      category: analysis.category,
      confidence: analysis.confidence,
      codex_related: analysis.codexRelated,
      work_related: analysis.workRelated,
      reset_confirmed: analysis.resetConfirmed,
      reset_completed: analysis.resetCompleted,
      reset_type: analysis.resetType,
      time_expression: analysis.timeExpression,
      estimated_reset_time: analysis.estimatedResetTime?.toISOString() ?? null,
      estimated_reset_window_end: analysis.estimatedResetWindowEnd?.toISOString() ?? null,
      summary: analysis.summary,
      reasoning_summary: analysis.reasoningSummary,
      model,
    };
    const { data, error } = await this.client
      .from("analyses")
      .upsert(payload, { onConflict: "post_id" })
      .select("*")
      .single();
    if (error) throw error;
    if (analysis.translationZh) {
      await this.client.from("posts").update({ content_zh: analysis.translationZh }).eq("id", postId);
    }
    return mapAnalysis(data as AnalysisRow);
  }

  async markAnalysisPending(postId: number): Promise<StoredAnalysis> {
    const payload = {
      post_id: postId,
      status: "pending",
      relevant: false,
      category: "UNRELATED",
      confidence: 0,
      codex_related: false,
      work_related: false,
      reset_confirmed: false,
      reset_completed: false,
      reset_type: "unknown",
      time_expression: null,
      estimated_reset_time: null,
      estimated_reset_window_end: null,
      summary: "Analysis pending",
      reasoning_summary: "The model response was unavailable and will be retried.",
      model: null,
    };
    const { data, error } = await this.client
      .from("analyses")
      .upsert(payload, { onConflict: "post_id" })
      .select("*")
      .single();
    if (error) throw error;
    return mapAnalysis(data as AnalysisRow);
  }

  async listOpenEvents(): Promise<ResetEvent[]> {
    const { data, error } = await this.client
      .from("reset_events")
      .select("*")
      .neq("status", "EXPIRED")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => mapEvent(row as EventRow));
  }

  async getEventById(id: number): Promise<ResetEventWithPosts | null> {
    const { data, error } = await this.client.from("reset_events").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return this.withPosts(mapEvent(data as EventRow));
  }

  async getActiveEvent(): Promise<ResetEventWithPosts | null> {
    const { data, error } = await this.client
      .from("reset_events")
      .select("*")
      .in("status", ["POSSIBLE", "ANNOUNCED", "INCOMING", "LIVE", "COMPLETED"])
      .order("updated_at", { ascending: false })
      .limit(5);
    if (error) throw error;
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    const row = (data ?? []).find((item) => {
      const event = mapEvent(item as EventRow);
      if (event.status !== "COMPLETED") return true;
      const done = event.completedAt ?? event.updatedAt;
      return done.getTime() >= cutoff;
    });
    if (!row) return null;
    return this.withPosts(mapEvent(row as EventRow));
  }

  async listEvents(filters?: {
    types?: string[];
    statuses?: string[];
    limit?: number;
    offset?: number;
  }): Promise<{ events: ResetEventWithPosts[]; total: number }> {
    let query = this.client.from("reset_events").select("*", { count: "exact" });
    if (filters?.types?.length) query = query.in("type", filters.types);
    if (filters?.statuses?.length) query = query.in("status", filters.statuses);
    const limit = filters?.limit ?? 20;
    const offset = filters?.offset ?? 0;
    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    const events = await Promise.all((data ?? []).map((row) => this.withPosts(mapEvent(row as EventRow))));
    return { events, total: count ?? events.length };
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
    const { data, error } = await this.client
      .from("reset_events")
      .insert({
        type: input.type,
        status: input.status,
        reset_type: input.resetType,
        certainty: input.certainty,
        announced_at: input.announcedAt.toISOString(),
        expected_at: input.expectedAt?.toISOString() ?? null,
        expected_window_end: input.expectedWindowEnd?.toISOString() ?? null,
        completed_at: input.completedAt?.toISOString() ?? null,
        confidence: input.confidence,
        summary: input.summary,
      })
      .select("*")
      .single();
    if (error) throw error;
    const event = mapEvent(data as EventRow);
    await this.linkPost(event.id, input.postId);
    return event;
  }

  async updateEvent(
    id: number,
    patch: Partial<ResetEvent> & { postId?: number },
  ): Promise<ResetEvent> {
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.type) payload.type = patch.type;
    if (patch.status) payload.status = patch.status;
    if (patch.resetType) payload.reset_type = patch.resetType;
    if (patch.certainty) payload.certainty = patch.certainty;
    if (patch.expectedAt !== undefined) payload.expected_at = patch.expectedAt?.toISOString() ?? null;
    if (patch.expectedWindowEnd !== undefined) {
      payload.expected_window_end = patch.expectedWindowEnd?.toISOString() ?? null;
    }
    if (patch.completedAt !== undefined) payload.completed_at = patch.completedAt?.toISOString() ?? null;
    if (patch.confidence !== undefined) payload.confidence = patch.confidence;
    if (patch.summary) payload.summary = patch.summary;

    const { data, error } = await this.client
      .from("reset_events")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    if (patch.postId) await this.linkPost(id, patch.postId);
    return mapEvent(data as EventRow);
  }

  async hasNotification(
    resetEventId: number,
    notificationKey: string,
    provider = "browser",
  ): Promise<boolean> {
    const { data, error } = await this.client
      .from("notifications")
      .select("id")
      .eq("reset_event_id", resetEventId)
      .eq("provider", provider)
      .eq("notification_key", notificationKey)
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  }

  async recordNotification(input: {
    resetEventId: number;
    provider: string;
    level: NotificationLevel;
    status: NotificationStatus;
    notificationKey: string;
    error?: string | null;
  }): Promise<void> {
    const { error } = await this.client.from("notifications").upsert(
      {
        reset_event_id: input.resetEventId,
        provider: input.provider,
        level: input.level,
        status: input.status,
        notification_key: input.notificationKey,
        sent_at: input.status === "sent" ? new Date().toISOString() : null,
        error: input.error ?? null,
      },
      { onConflict: "reset_event_id,provider,notification_key" },
    );
    if (error && error.code !== "23505") throw error;
  }

  async listQueuedNotifications() {
    const { data, error } = await this.client
      .from("notifications")
      .select("id, reset_event_id, provider, level, notification_key")
      .eq("status", "queued")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id as number,
      resetEventId: row.reset_event_id as number,
      provider: row.provider as string,
      level: row.level as NotificationLevel,
      notificationKey: row.notification_key as string,
    }));
  }

  async startMonitorRun(): Promise<MonitorRun> {
    const { data, error } = await this.client
      .from("monitor_runs")
      .insert({ status: "running" })
      .select("*")
      .single();
    if (error) throw error;
    return mapRun(data as RunRow);
  }

  async finishMonitorRun(
    id: number,
    summary: CronSummary,
    status: MonitorRunStatus,
    errorText?: string | null,
  ): Promise<void> {
    const { error } = await this.client
      .from("monitor_runs")
      .update({
        completed_at: new Date().toISOString(),
        status,
        posts_fetched: summary.postsFetched,
        new_posts: summary.newPosts,
        relevant_posts: summary.relevantPosts,
        events_created: summary.eventsCreated,
        notifications_sent: summary.notificationsSent,
        error: errorText ?? null,
      })
      .eq("id", id);
    if (error) throw error;
  }

  async getLatestRun(): Promise<MonitorRun | null> {
    const { data, error } = await this.client
      .from("monitor_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? mapRun(data as RunRow) : null;
  }

  async getLatestSuccessfulRun(): Promise<MonitorRun | null> {
    const { data, error } = await this.client
      .from("monitor_runs")
      .select("*")
      .eq("status", "success")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? mapRun(data as RunRow) : null;
  }

  async getRecentRunErrors(limit = 8): Promise<string[]> {
    const lastSuccess = await this.getLatestSuccessfulRun();
    let query = this.client
      .from("monitor_runs")
      .select("error")
      .not("error", "is", null)
      .order("started_at", { ascending: false })
      .limit(limit);
    if (lastSuccess) {
      query = query.gt("started_at", lastSuccess.startedAt.toISOString());
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row) => row.error as string);
  }

  async getEventStats() {
    const { data, error } = await this.client
      .from("reset_events")
      .select("type, status, announced_at, completed_at")
      .in("status", ["LIVE", "COMPLETED", "ANNOUNCED", "INCOMING", "POSSIBLE"]);
    if (error) throw error;
    const rows = data ?? [];
    const completed = rows.filter((row) => ["LIVE", "COMPLETED"].includes(row.status as string));
    const globalResets = completed.filter((row) =>
      ["GLOBAL_RESET", "RESET_COMPLETED"].includes(row.type as string),
    ).length;
    const bankedResets = completed.filter((row) => row.type === "BANKED_RESET").length;
    const dated = completed
      .map((row) => row.completed_at ?? row.announced_at)
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value).getTime())
      .sort((a, b) => a - b);
    let averageDaysBetween: number | null = null;
    if (dated.length >= 2) {
      const gaps = dated.slice(1).map((value, index) => value - dated[index]!);
      averageDaysBetween = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length / 86400000;
    }
    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);
    const announcementsThisMonth = rows.filter(
      (row) => row.announced_at && new Date(row.announced_at) >= startOfMonth,
    ).length;
    return {
      totalResets: completed.length,
      globalResets,
      bankedResets,
      averageDaysBetween,
      announcementsThisMonth,
    };
  }

  private async linkPost(eventId: number, postId: number) {
    const { error } = await this.client.from("reset_event_posts").upsert({
      reset_event_id: eventId,
      post_id: postId,
    });
    if (error && error.code !== "23505") throw error;
  }

  private async withPosts(event: ResetEvent): Promise<ResetEventWithPosts> {
    const { data, error } = await this.client
      .from("reset_event_posts")
      .select("post_id, posts(*)")
      .eq("reset_event_id", event.id);
    if (error) throw error;
    const posts = (data ?? [])
      .map((row) => {
        const joined = (row as { posts?: PostRow | PostRow[] | null }).posts;
        if (Array.isArray(joined)) return joined[0] ?? null;
        return joined ?? null;
      })
      .filter((row): row is PostRow => Boolean(row))
      .map(mapPost)
      .sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime());
    const latestPost = posts.at(-1);
    const latestAnalysis = latestPost
      ? await this.getCompletedAnalysisForPost(latestPost.id)
      : null;
    return { ...event, posts, latestAnalysis };
  }
}
