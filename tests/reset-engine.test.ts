import { describe, expect, it } from "vitest";
import { InMemoryRadarRepository } from "@/services/data/memory-repository";
import { NotificationEngine, QueuedBrowserProvider } from "@/services/notifications/engine";
import { ResetEngine } from "@/services/reset/engine";
import { runMonitor } from "@/services/monitor/pipeline";
import { ManualSource, makeManualPost } from "@/services/social";
import type { AIAnalyzer } from "@/services/ai/types";
import type { PostAnalysis, SocialPost } from "@/types";
import { AnalyzerUnavailableError, InvalidAnalysisError } from "@/services/ai/types";
import { SourceUnavailableError } from "@/services/social/source";
import { sanitizeAnalysis } from "@/lib/validation/analysis";
import { parseCodexStatus } from "@/services/status-parser/parse-status";
import { authorizeCron } from "@/services/monitor/auth";

function analysis(partial: Partial<PostAnalysis>): PostAnalysis {
  return sanitizeAnalysis({
    relevant: true,
    category: "UNRELATED",
    confidence: 0.9,
    codexRelated: true,
    workRelated: true,
    resetConfirmed: false,
    resetCompleted: false,
    resetType: "unknown",
    timeExpression: null,
    estimatedResetTime: null,
    estimatedResetWindowEnd: null,
    summary: "summary",
    reasoningSummary: "reason",
    ...partial,
  });
}

function stubAnalyzer(map: Record<string, PostAnalysis> | ((post: SocialPost) => PostAnalysis)): AIAnalyzer {
  return {
    id: "stub",
    model: "stub-1",
    async analyzePost(post) {
      if (typeof map === "function") return map(post);
      return map[post.content] ?? analysis({ category: "UNRELATED", relevant: false });
    },
  };
}

describe("classification and reset engine", () => {
  it("classifies global, banked, upcoming, completed, teaser, and unrelated posts", async () => {
    const cases: Array<[string, PostAnalysis, string]> = [
      [
        "I've reset usage limits for all paid Codex users.",
        analysis({ category: "GLOBAL_RESET", resetConfirmed: true, resetType: "automatic" }),
        "LIVE",
      ],
      [
        "We added a reset to everyone's account.",
        analysis({ category: "BANKED_RESET", resetConfirmed: true, resetType: "banked" }),
        "LIVE",
      ],
      [
        "Reset coming tomorrow.",
        analysis({ category: "UPCOMING_RESET", resetConfirmed: true, timeExpression: "tomorrow" }),
        "INCOMING",
      ],
      [
        "Reset is live.",
        analysis({ category: "RESET_COMPLETED", resetCompleted: true, resetConfirmed: true }),
        "COMPLETED",
      ],
      [
        "Something fun tomorrow 👀",
        analysis({ category: "RESET_TEASER", confidence: 0.68 }),
        "POSSIBLE",
      ],
    ];

    for (const [content, parsed, status] of cases) {
      const repo = new InMemoryRadarRepository();
      const engine = new ResetEngine(repo);
      const { post } = await repo.upsertPost(makeManualPost({ content, externalId: content }));
      const result = await engine.apply(post, parsed);
      expect(result.event?.status).toBe(status);
    }

    const repo = new InMemoryRadarRepository();
    const engine = new ResetEngine(repo);
    const { post } = await repo.upsertPost(
      makeManualPost({ content: "Codex got faster today.", externalId: "fast" }),
    );
    const unrelated = await engine.apply(
      post,
      analysis({ category: "UNRELATED", relevant: false }),
    );
    expect(unrelated.event).toBeNull();
  });

  it("never upgrades a teaser to a global reset without evidence", () => {
    const result = sanitizeAnalysis(
      analysis({ category: "RESET_TEASER", resetConfirmed: true, confidence: 0.4 }),
    );
    expect(result.category).toBe("UNRELATED");
  });

  it("correlates teaser, upcoming, and live posts into one event", async () => {
    const repo = new InMemoryRadarRepository();
    const engine = new ResetEngine(repo);
    const base = new Date("2026-09-13T18:00:00Z");
    const posts = [
      makeManualPost({ content: "Something tomorrow 👀", publishedAt: base, externalId: "1" }),
      makeManualPost({
        content: "Reset coming in one hour.",
        publishedAt: new Date(base.getTime() + 3600_000),
        externalId: "2",
      }),
      makeManualPost({
        content: "Reset is live.",
        publishedAt: new Date(base.getTime() + 7200_000),
        externalId: "3",
      }),
    ];
    const analyses = [
      analysis({ category: "RESET_TEASER", confidence: 0.66 }),
      analysis({ category: "UPCOMING_RESET", timeExpression: "in one hour" }),
      analysis({ category: "RESET_COMPLETED", resetCompleted: true }),
    ];
    let eventId: number | null = null;
    for (let i = 0; i < posts.length; i += 1) {
      const stored = await repo.upsertPost(posts[i]!);
      const result = await engine.apply(stored.post, analyses[i]!);
      eventId = result.event?.id ?? eventId;
    }
    const events = await repo.listEvents();
    expect(events.total).toBe(1);
    expect(events.events[0]?.id).toBe(eventId);
    expect(events.events[0]?.posts).toHaveLength(3);
    expect(events.events[0]?.status).toBe("COMPLETED");
  });

  it("does not duplicate posts, events, or notifications on a second cron run", async () => {
    const repo = new InMemoryRadarRepository();
    const notifications = new NotificationEngine(repo, [new QueuedBrowserProvider(repo)]);
    const post = makeManualPost({
      content: "I've reset usage limits for all paid users.",
      externalId: "dup-1",
    });
    const analyzer = stubAnalyzer({
      [post.content]: analysis({
        category: "GLOBAL_RESET",
        resetConfirmed: true,
        resetType: "automatic",
      }),
    });
    const deps = {
      source: new ManualSource([post]),
      analyzer,
      repo,
      notifications,
    };
    const first = await runMonitor(deps);
    const second = await runMonitor(deps);
    expect(first.newPosts).toBe(1);
    expect(second.newPosts).toBe(0);
    expect(first.eventsCreated).toBe(1);
    expect(second.eventsCreated).toBe(0);
    expect(first.notificationsSent).toBe(1);
    expect(second.notificationsSent).toBe(0);
  });

  it("keeps historical posts when the X API fails", async () => {
    const repo = new InMemoryRadarRepository();
    await repo.upsertPost(makeManualPost({ content: "old", externalId: "old" }));
    const summary = await runMonitor({
      source: {
        id: "x",
        async getLatestPosts() {
          throw new SourceUnavailableError("X API failed");
        },
      },
      analyzer: stubAnalyzer({}),
      repo,
      notifications: new NotificationEngine(repo, [new QueuedBrowserProvider(repo)]),
    });
    expect(summary.sourceStatus).toBe("unavailable");
    expect(await repo.getLatestPost()).not.toBeNull();
  });

  it("marks analysis pending when the AI API fails or returns invalid JSON", async () => {
    const repo = new InMemoryRadarRepository();
    const post = makeManualPost({ content: "Reset coming tomorrow.", externalId: "ai-fail" });
    const failing: AIAnalyzer = {
      id: "fail",
      model: "fail",
      async analyzePost() {
        throw new AnalyzerUnavailableError("down");
      },
    };
    await runMonitor({
      source: new ManualSource([post]),
      analyzer: failing,
      repo,
      notifications: new NotificationEngine(repo, [new QueuedBrowserProvider(repo)]),
    });
    const stored = await repo.getLatestPost();
    const pending = await repo.getPendingAnalyses();
    expect(stored).not.toBeNull();
    expect(pending).toHaveLength(1);

    const invalid: AIAnalyzer = {
      id: "invalid",
      model: "invalid",
      async analyzePost() {
        throw new InvalidAnalysisError("bad json");
      },
    };
    await runMonitor({
      source: new ManualSource([makeManualPost({ content: "hello", externalId: "ai-json" })]),
      analyzer: invalid,
      repo,
      notifications: new NotificationEngine(repo, [new QueuedBrowserProvider(repo)]),
    });
    expect((await repo.getPendingAnalyses()).length).toBeGreaterThan(0);
  });

  it("does not notify for unrelated posts", async () => {
    const repo = new InMemoryRadarRepository();
    const summary = await runMonitor({
      source: new ManualSource([makeManualPost({ content: "Codex got faster today." })]),
      analyzer: stubAnalyzer((post) =>
        analysis({
          category: "UNRELATED",
          relevant: false,
          summary: post.content,
        }),
      ),
      repo,
      notifications: new NotificationEngine(repo, [new QueuedBrowserProvider(repo)]),
    });
    expect(summary.notificationsSent).toBe(0);
    expect(summary.relevantPosts).toBe(0);
  });
});

describe("auth and status parser", () => {
  it("rejects unauthorized cron requests", () => {
    process.env.CRON_SECRET = "test-secret";
    expect(authorizeCron(new Request("http://localhost", { headers: { authorization: "Bearer nope" } }))).toBe(false);
    expect(
      authorizeCron(new Request("http://localhost", { headers: { authorization: "Bearer test-secret" } })),
    ).toBe(true);
  });

  it("parses a future /status dump without credentials", () => {
    const parsed = parseCodexStatus(`5h limit 42% remaining
Weekly limit 80% remaining
Resets 2026-09-17T06:32:00Z`);
    expect(parsed.fiveHourRemainingPct).toBe(42);
    expect(parsed.weeklyRemainingPct).toBe(80);
    expect(parsed.weeklyResetsAt?.toISOString()).toBe("2026-09-17T06:32:00.000Z");
  });
});
