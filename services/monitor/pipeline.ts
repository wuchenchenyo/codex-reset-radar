import { isAiConfigured } from "@/lib/env/server";
import { log } from "@/lib/logging";
import type { CronSummary, PostAnalysis, StoredPost } from "@/types";
import type { AIAnalyzer } from "@/services/ai/types";
import { AnalyzerUnavailableError, InvalidAnalysisError } from "@/services/ai/types";
import type { RadarRepository } from "@/services/data/types";
import { NotificationEngine } from "@/services/notifications/engine";
import { ResetEngine } from "@/services/reset/engine";
import { SourceUnavailableError, type SocialSource } from "@/services/social/source";

export interface MonitorDependencies {
  source: SocialSource;
  analyzer: AIAnalyzer | null;
  repo: RadarRepository;
  notifications: NotificationEngine;
}

export async function runMonitor(deps: MonitorDependencies): Promise<CronSummary> {
  const summary: CronSummary = {
    success: true,
    postsFetched: 0,
    newPosts: 0,
    relevantPosts: 0,
    eventsCreated: 0,
    notificationsSent: 0,
    pendingAnalyses: 0,
    sourceStatus: "ok",
  };

  log.info("cron_start", { source: deps.source.id });
  const run = await deps.repo.startMonitorRun();
  const resetEngine = new ResetEngine(deps.repo);

  const applyRelevant = async (post: StoredPost, analysis: PostAnalysis) => {
    if (!analysis.relevant) return;
    summary.relevantPosts += 1;
    const result = await resetEngine.apply(post, analysis);
    if (result.created) summary.eventsCreated += 1;
    if (result.event && (result.created || result.updated)) {
      summary.notificationsSent += await deps.notifications.notify(result.event);
    }
  };

  try {
    try {
      const posts = await deps.source.getLatestPosts();
      summary.postsFetched = posts.length;
      log.info("source_fetch_result", { count: posts.length, source: deps.source.id });

      for (const post of posts) {
        const { post: stored, created } = await deps.repo.upsertPost(post);
        if (created) summary.newPosts += 1;

        const existing = await deps.repo.getCompletedAnalysisForPost(stored.id);
        if (existing) {
          if (existing.relevant) summary.relevantPosts += 1;
          continue;
        }

        if (!deps.analyzer) {
          await deps.repo.markAnalysisPending(stored.id);
          summary.pendingAnalyses += 1;
          continue;
        }

        try {
          const analysis = await deps.analyzer.analyzePost(stored);
          await deps.repo.saveCompletedAnalysis(stored.id, analysis, deps.analyzer.model);
          await applyRelevant(stored, analysis);
        } catch (error) {
          if (
            error instanceof AnalyzerUnavailableError ||
            error instanceof InvalidAnalysisError
          ) {
            log.error("analysis_error", { postId: stored.id, code: error.code });
            await deps.repo.markAnalysisPending(stored.id);
            summary.pendingAnalyses += 1;
            summary.success = false;
            summary.error = error.message;
            continue;
          }
          throw error;
        }
      }
    } catch (error) {
      if (error instanceof SourceUnavailableError) {
        summary.sourceStatus = error.message.includes("not configured")
          ? "unconfigured"
          : "unavailable";
        summary.success = false;
        summary.error = error.message;
        log.warn("source_unavailable", { source: deps.source.id });
      } else {
        throw error;
      }
    }

    if (deps.analyzer) {
      const pending = await deps.repo.getPendingAnalyses();
      for (const item of pending) {
        try {
          const analysis = await deps.analyzer.analyzePost(item.post);
          await deps.repo.saveCompletedAnalysis(item.post.id, analysis, deps.analyzer.model);
          await applyRelevant(item.post, analysis);
        } catch (error) {
          log.error("analysis_retry_error", { postId: item.post.id });
          summary.pendingAnalyses += 1;
          if (!summary.error && error instanceof Error) summary.error = error.message;
          summary.success = false;
        }
      }
    } else if (!isAiConfigured()) {
      summary.pendingAnalyses += (await deps.repo.getPendingAnalyses()).length;
    }

    const status = summary.error
      ? summary.postsFetched > 0 || summary.newPosts > 0
        ? "partial"
        : "error"
      : "success";
    await deps.repo.finishMonitorRun(run.id, summary, status, summary.error ?? null);
    log.info("cron_finish", {
      postsFetched: summary.postsFetched,
      newPosts: summary.newPosts,
      relevantPosts: summary.relevantPosts,
      eventsCreated: summary.eventsCreated,
      notificationsSent: summary.notificationsSent,
    });
    return summary;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Monitor failed";
    summary.success = false;
    summary.error = message;
    log.error("cron_error");
    await deps.repo.finishMonitorRun(run.id, summary, "error", message);
    return summary;
  }
}
