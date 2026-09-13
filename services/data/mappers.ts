import type {
  MonitorRun,
  ResetEvent,
  SocialPost,
  StoredAnalysis,
  StoredPost,
} from "@/types";

export interface PostRow {
  id: number;
  external_id: string;
  platform: string;
  author_name: string;
  author_username: string;
  content: string;
  url: string;
  published_at: string;
  raw_data: Record<string, unknown> | null;
  created_at: string;
}

export interface AnalysisRow {
  id: number;
  post_id: number;
  status: StoredAnalysis["status"];
  relevant: boolean;
  category: StoredAnalysis["category"];
  confidence: number;
  codex_related: boolean;
  work_related: boolean;
  reset_confirmed: boolean;
  reset_completed: boolean;
  reset_type: StoredAnalysis["resetType"];
  time_expression: string | null;
  estimated_reset_time: string | null;
  estimated_reset_window_end: string | null;
  summary: string;
  reasoning_summary: string;
  model: string | null;
  created_at: string;
}

export interface EventRow {
  id: number;
  type: ResetEvent["type"];
  status: ResetEvent["status"];
  reset_type: ResetEvent["resetType"];
  certainty: ResetEvent["certainty"];
  announced_at: string | null;
  expected_at: string | null;
  expected_window_end: string | null;
  completed_at: string | null;
  confidence: number;
  summary: string;
  created_at: string;
  updated_at: string;
}

export interface RunRow {
  id: number;
  started_at: string;
  completed_at: string | null;
  status: MonitorRun["status"];
  posts_fetched: number;
  new_posts: number;
  relevant_posts: number;
  events_created: number;
  notifications_sent: number;
  error: string | null;
}

export function mapPost(row: PostRow): StoredPost {
  return {
    id: row.id,
    externalId: row.external_id,
    platform: row.platform,
    authorName: row.author_name,
    authorUsername: row.author_username,
    content: row.content,
    url: row.url,
    publishedAt: new Date(row.published_at),
    rawData: row.raw_data ?? {},
    createdAt: new Date(row.created_at),
  };
}

export function mapAnalysis(row: AnalysisRow): StoredAnalysis {
  return {
    id: row.id,
    postId: row.post_id,
    status: row.status,
    relevant: row.relevant,
    category: row.category,
    confidence: row.confidence,
    codexRelated: row.codex_related,
    workRelated: row.work_related,
    resetConfirmed: row.reset_confirmed,
    resetCompleted: row.reset_completed,
    resetType: row.reset_type,
    timeExpression: row.time_expression,
    estimatedResetTime: row.estimated_reset_time ? new Date(row.estimated_reset_time) : null,
    estimatedResetWindowEnd: row.estimated_reset_window_end
      ? new Date(row.estimated_reset_window_end)
      : null,
    summary: row.summary,
    reasoningSummary: row.reasoning_summary,
    model: row.model,
    createdAt: new Date(row.created_at),
  };
}

export function mapEvent(row: EventRow): ResetEvent {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    resetType: row.reset_type,
    certainty: row.certainty,
    announcedAt: row.announced_at ? new Date(row.announced_at) : null,
    expectedAt: row.expected_at ? new Date(row.expected_at) : null,
    expectedWindowEnd: row.expected_window_end ? new Date(row.expected_window_end) : null,
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    confidence: row.confidence,
    summary: row.summary,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function mapRun(row: RunRow): MonitorRun {
  return {
    id: row.id,
    startedAt: new Date(row.started_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    status: row.status,
    postsFetched: row.posts_fetched,
    newPosts: row.new_posts,
    relevantPosts: row.relevant_posts,
    eventsCreated: row.events_created,
    notificationsSent: row.notifications_sent,
    error: row.error,
  };
}

export function postInsert(post: SocialPost) {
  return {
    external_id: post.externalId,
    platform: post.platform,
    author_name: post.authorName,
    author_username: post.authorUsername,
    content: post.content,
    url: post.url,
    published_at: post.publishedAt.toISOString(),
    raw_data: post.rawData,
  };
}
