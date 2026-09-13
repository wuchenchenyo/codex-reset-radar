import { mergeAiAndParsedTime } from "@/lib/time/parse-relative";
import { certaintyFor } from "@/lib/validation/analysis";
import type { PostAnalysis, ResetEvent, SocialPost, StoredPost } from "@/types";
import type { RadarRepository } from "@/services/data/types";
import { findRelatedEvent } from "@/services/reset/correlate";
import {
  eventStatusFromAnalysis,
  eventTypeFromAnalysis,
  resetTypeFromAnalysis,
  strongerStatus,
  strongerType,
} from "@/services/reset/states";

export interface ResetEngineResult {
  event: ResetEvent | null;
  created: boolean;
  updated: boolean;
}

export class ResetEngine {
  constructor(private readonly repo: RadarRepository) {}

  async apply(post: StoredPost | SocialPost & { id: number }, analysis: PostAnalysis): Promise<ResetEngineResult> {
    const type = eventTypeFromAnalysis(analysis);
    if (!type) {
      return { event: null, created: false, updated: false };
    }

    const timing = mergeAiAndParsedTime({
      publishedAt: post.publishedAt,
      text: post.content,
      timeExpression: analysis.timeExpression,
      aiExact: analysis.estimatedResetTime,
      aiWindowEnd: analysis.estimatedResetWindowEnd,
    });

    const expectedAt = timing?.exact ?? timing?.rangeStart ?? analysis.estimatedResetTime;
    const expectedWindowEnd = timing?.rangeEnd ?? analysis.estimatedResetWindowEnd;
    const completedAt =
      analysis.resetCompleted || type === "RESET_COMPLETED" ? post.publishedAt : null;
    const status = eventStatusFromAnalysis({
      ...analysis,
      estimatedResetTime: expectedAt,
      estimatedResetWindowEnd: expectedWindowEnd,
    });
    const certainty = certaintyFor(analysis);
    const resetType = resetTypeFromAnalysis(analysis);
    const openEvents = await this.repo.listOpenEvents();
    const related = findRelatedEvent(openEvents, type, post.publishedAt);

    if (related) {
      const nextType = strongerType(related.type, type);
      const nextStatus = strongerStatus(related.status, status);
      const updated = await this.repo.updateEvent(related.id, {
        type: nextType,
        status: nextStatus,
        resetType: resetType === "unknown" ? related.resetType : resetType,
        certainty:
          certainty === "confirmed" || related.certainty === "confirmed"
            ? "confirmed"
            : certainty === "estimated" || related.certainty === "estimated"
              ? "estimated"
              : "speculative",
        expectedAt: expectedAt ?? related.expectedAt,
        expectedWindowEnd: expectedWindowEnd ?? related.expectedWindowEnd,
        completedAt: completedAt ?? related.completedAt,
        confidence: Math.max(related.confidence, analysis.confidence),
        summary: analysis.summary || related.summary,
        postId: post.id,
      });
      return { event: updated, created: false, updated: true };
    }

    const created = await this.repo.createEvent({
      type,
      status,
      resetType,
      certainty,
      announcedAt: post.publishedAt,
      expectedAt,
      expectedWindowEnd,
      completedAt,
      confidence: analysis.confidence,
      summary: analysis.summary,
      postId: post.id,
    });
    return { event: created, created: true, updated: false };
  }
}
