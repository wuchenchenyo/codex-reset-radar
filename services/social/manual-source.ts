import type { SocialPost } from "@/types";
import { SocialSource } from "@/services/social/source";

export class ManualSource implements SocialSource {
  readonly id = "manual";

  constructor(private readonly posts: SocialPost[]) {}

  async getLatestPosts(): Promise<SocialPost[]> {
    return this.posts;
  }
}

export function makeManualPost(input: {
  content: string;
  publishedAt?: Date;
  externalId?: string;
  authorName?: string;
  authorUsername?: string;
}): SocialPost {
  const publishedAt = input.publishedAt ?? new Date();
  const externalId =
    input.externalId ??
    `manual-${publishedAt.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
  const username = input.authorUsername ?? "thsottiaux";
  return {
    externalId,
    platform: "manual",
    authorName: input.authorName ?? "Tibo Sottiaux",
    authorUsername: username,
    content: input.content,
    url: `https://x.com/${username}/status/${externalId}`,
    publishedAt,
    rawData: { source: "manual", content: input.content },
  };
}
