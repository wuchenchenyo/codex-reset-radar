import { isXConfigured } from "@/lib/env/server";
import { SocialSource, SourceUnavailableError } from "@/services/social/source";
import { XSource } from "@/services/social/x-source";

export function getDefaultSocialSource(): SocialSource {
  if (!isXConfigured()) {
    throw new SourceUnavailableError("X_BEARER_TOKEN is not configured");
  }
  return new XSource();
}

export { XSource } from "@/services/social/x-source";
export { ManualSource, makeManualPost } from "@/services/social/manual-source";
export { SourceUnavailableError } from "@/services/social/source";
export type { SocialSource } from "@/services/social/source";
