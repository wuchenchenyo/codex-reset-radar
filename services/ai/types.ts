import type { PostAnalysis, SocialPost } from "@/types";

export class AnalyzerUnavailableError extends Error {
  readonly code = "ANALYZER_UNAVAILABLE";
  readonly retryable = true;

  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "AnalyzerUnavailableError";
  }
}

export class InvalidAnalysisError extends Error {
  readonly code = "INVALID_ANALYSIS";
  readonly retryable = true;

  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "InvalidAnalysisError";
  }
}

export interface AIAnalyzer {
  readonly id: string;
  readonly model: string;
  analyzePost(post: SocialPost): Promise<PostAnalysis>;
}
