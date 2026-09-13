import { describe, expect, it } from "vitest";
import { InMemoryRadarRepository } from "@/services/data/memory-repository";
import { NotificationEngine, QueuedBrowserProvider } from "@/services/notifications/engine";
import { buildTelegramText, TelegramProvider } from "@/services/notifications/telegram";
import { makeManualPost } from "@/services/social";
import { ResetEngine } from "@/services/reset/engine";
import { sanitizeAnalysis } from "@/lib/validation/analysis";

describe("telegram notifications", () => {
  it("builds a message with source tweet and translation", () => {
    const text = buildTelegramText(
      {
        event: {
          id: 1,
          type: "RESET_COMPLETED",
          status: "COMPLETED",
          resetType: "automatic",
          certainty: "confirmed",
          announcedAt: new Date(),
          expectedAt: null,
          expectedWindowEnd: null,
          completedAt: new Date(),
          confidence: 0.95,
          summary: "Reset all propagated.",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        level: "CRITICAL",
        title: "Codex reset is live",
        body: "Reset all propagated.",
        key: "COMPLETED:RESET_COMPLETED",
      },
      {
        id: 1,
        type: "RESET_COMPLETED",
        status: "COMPLETED",
        resetType: "automatic",
        certainty: "confirmed",
        announcedAt: new Date(),
        expectedAt: null,
        expectedWindowEnd: null,
        completedAt: new Date(),
        confidence: 0.95,
        summary: "Reset all propagated.",
        createdAt: new Date(),
        updatedAt: new Date(),
        posts: [
          {
            ...makeManualPost({ content: "Reset all propagated. Sweet dreams." }),
            id: 4,
            createdAt: new Date(),
            contentZh: "重置已全部生效。晚安。",
            url: "https://x.com/thsottiaux/status/1",
          },
        ],
        latestAnalysis: null,
      },
      "https://example.com",
    );
    expect(text).toContain("Codex 重置已生效");
    expect(text).toContain("重置已全部生效");
    expect(text).toContain("打开源推文");
    expect(text).toContain("打开雷达");
  });

  it("sends once and does not duplicate", async () => {
    const repo = new InMemoryRadarRepository();
    const engine = new ResetEngine(repo);
    const stored = await repo.upsertPost(
      makeManualPost({ content: "I've reset usage limits for all paid users.", externalId: "tg-1" }),
    );
    const result = await engine.apply(
      stored.post,
      sanitizeAnalysis({
        relevant: true,
        category: "GLOBAL_RESET",
        confidence: 0.95,
        codexRelated: true,
        workRelated: true,
        resetConfirmed: true,
        resetCompleted: false,
        resetType: "automatic",
        timeExpression: null,
        estimatedResetTime: null,
        estimatedResetWindowEnd: null,
        summary: "Global reset.",
        reasoningSummary: "explicit",
        translationZh: "全球重置。",
      }),
    );
    let calls = 0;
    const telegram = new TelegramProvider(repo, {
      token: "token",
      chatId: "123",
      fetchImpl: async () => {
        calls += 1;
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
    });
    const notifications = new NotificationEngine(repo, [
      new QueuedBrowserProvider(repo),
      telegram,
    ]);
    const first = await notifications.notify(result.event!);
    const second = await notifications.notify(result.event!);
    expect(first).toBe(2);
    expect(second).toBe(0);
    expect(calls).toBe(1);
  });
});
