import type { SocialPost } from "@/types";

export class SourceUnavailableError extends Error {
  readonly code = "SOURCE_UNAVAILABLE";
  readonly retryable = true;

  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "SourceUnavailableError";
  }
}

export interface SocialSource {
  readonly id: string;
  getLatestPosts(): Promise<SocialPost[]>;
}
