import { createAdminClient } from "@/lib/supabase/admin";
import { isAiConfigured } from "@/lib/env/server";
import { createAnalyzer } from "@/services/ai";
import type { AIAnalyzer } from "@/services/ai/types";
import { SupabaseRadarRepository } from "@/services/data/supabase-repository";
import type { RadarRepository } from "@/services/data/types";
import { NotificationEngine, QueuedBrowserProvider } from "@/services/notifications/engine";
import { getDefaultSocialSource } from "@/services/social";
import { SourceUnavailableError, type SocialSource } from "@/services/social/source";

function unavailableSource(error: SourceUnavailableError): SocialSource {
  return {
    id: "x",
    async getLatestPosts(): Promise<never> {
      throw error;
    },
  };
}

export function createRepository(): RadarRepository {
  const client = createAdminClient();
  if (!client) {
    throw new Error("Supabase is not configured");
  }
  return new SupabaseRadarRepository(client);
}

export function createMonitorStack(options?: {
  source?: SocialSource;
  analyzer?: AIAnalyzer | null;
  repo?: RadarRepository;
}) {
  const repo = options?.repo ?? createRepository();
  const analyzer =
    options?.analyzer !== undefined
      ? options.analyzer
      : isAiConfigured()
        ? createAnalyzer()
        : null;
  let source = options?.source;
  if (!source) {
    try {
      source = getDefaultSocialSource();
    } catch (error) {
      source =
        error instanceof SourceUnavailableError
          ? unavailableSource(error)
          : unavailableSource(new SourceUnavailableError("X source unavailable", error));
    }
  }
  const notifications = new NotificationEngine(repo, [new QueuedBrowserProvider(repo)]);
  return { source, analyzer, repo, notifications };
}
