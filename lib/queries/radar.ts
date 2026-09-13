import { isSupabaseConfigured } from "@/lib/env/server";
import type { DashboardSnapshot, ResetEventWithPosts } from "@/types";
import { createRepository } from "@/services/monitor/factory";

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  if (!isSupabaseConfigured()) {
    return {
      configured: false,
      database: "unconfigured",
      activeEvent: null,
      latestPost: null,
      latestAnalysis: null,
      lastRun: null,
      lastSuccessfulRun: null,
      recentErrors: [],
    };
  }

  try {
    const repo = createRepository();
    const [activeEvent, latestPost, lastRun, lastSuccessfulRun, recentErrors] =
      await Promise.all([
        repo.getActiveEvent(),
        repo.getLatestPost(),
        repo.getLatestRun(),
        repo.getLatestSuccessfulRun(),
        repo.getRecentRunErrors(6),
      ]);
    const latestAnalysis = latestPost
      ? await repo.getCompletedAnalysisForPost(latestPost.id)
      : null;
    return {
      configured: true,
      database: "connected",
      activeEvent,
      latestPost,
      latestAnalysis,
      lastRun,
      lastSuccessfulRun,
      recentErrors,
    };
  } catch {
    return {
      configured: true,
      database: "unavailable",
      activeEvent: null,
      latestPost: null,
      latestAnalysis: null,
      lastRun: null,
      lastSuccessfulRun: null,
      recentErrors: ["Database unavailable"],
    };
  }
}

export async function getHistory(options: {
  type?: string;
  status?: string;
  page?: number;
}) {
  const page = Math.max(1, options.page ?? 1);
  const limit = 20;
  if (!isSupabaseConfigured()) {
    return {
      events: [] as ResetEventWithPosts[],
      total: 0,
      stats: null,
      database: "unconfigured" as const,
      page,
      limit,
    };
  }
  try {
    const repo = createRepository();
    const types = options.type ? [options.type] : undefined;
    const statuses = options.status ? [options.status] : undefined;
    const [{ events, total }, stats] = await Promise.all([
      repo.listEvents({ types, statuses, limit, offset: (page - 1) * limit }),
      repo.getEventStats(),
    ]);
    return { events, total, stats, database: "connected" as const, page, limit };
  } catch {
    return {
      events: [] as ResetEventWithPosts[],
      total: 0,
      stats: null,
      database: "unavailable" as const,
      page,
      limit,
    };
  }
}

export async function getMonitorStatus() {
  const snapshot = await getDashboardSnapshot();
  return snapshot;
}
