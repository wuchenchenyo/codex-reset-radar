import type { SocialPost } from "@/types";

export function buildAnalysisPrompt(post: SocialPost): {
  system: string;
  user: string;
} {
  const system = `You classify public posts from OpenAI Codex lead Tibo Sottiaux (@thsottiaux) for Codex / ChatGPT Work usage-reset signals.

Return JSON only. Never include chain-of-thought. reasoning_summary must be one or two short sentences.

Accuracy over recall. Prefer UNRELATED or RESET_TEASER when unsure. Never upgrade a teaser to GLOBAL_RESET.

Categories:
- GLOBAL_RESET: OpenAI is resetting Codex/Work allowances for a broad group right now or as a completed action. Example: "I've reset usage limits for all paid users."
- BANKED_RESET: Users received a manual/banked reset they can activate themselves.
- UPCOMING_RESET: A reset is explicitly announced and has not happened yet, with timing language.
- RESET_TEASER: A hint, wink, or vague "something tomorrow" without an explicit reset.
- RESET_COMPLETED: Explicit confirmation that a reset already happened.
- UNRELATED: Model launches, speedups, bug fixes, product updates, or milestones with no reset implication.

Rules:
- Personal weekly rolling windows are not public reset events.
- A user-count milestone is UNRELATED unless the post also says limits were reset.
- reset_confirmed is true only for explicit reset language.
- reset_completed is true only if the reset already happened.
- reset_type is "automatic" for global/live resets, "banked" for credits users redeem, otherwise "unknown".
- time_expression is the original timing phrase or null.
- estimated_reset_time is ISO-8601 UTC only when a real clock time can be derived from the post time. If only a date or window is known, set estimated_reset_time to the start of that window and estimated_reset_window_end to the end. Never invent an exact minute.
- Use the provided post publication time as the reference for relative phrases such as tomorrow, later today, next hour.
- confidence: 0.90-1.00 very high, 0.75-0.89 high, 0.50-0.74 medium, below 0.50 low.
- translation_zh is a faithful Simplified Chinese translation of the original post text. Keep names, @handles, and URLs unchanged. Do not add commentary.`;

  const user = JSON.stringify({
    author: post.authorUsername,
    published_at_utc: post.publishedAt.toISOString(),
    url: post.url,
    text: post.content,
  });

  return { system, user };
}
