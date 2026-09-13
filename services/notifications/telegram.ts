import { getServerEnv } from "@/lib/env/server";
import type { RadarRepository } from "@/services/data/types";
import type { NotificationPayload, NotificationProvider } from "@/services/notifications/types";
import type { ResetEventWithPosts } from "@/types";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function buildTelegramText(
  payload: NotificationPayload,
  event?: ResetEventWithPosts | null,
  appUrl?: string,
): string {
  const source = event?.posts.at(-1);
  const titleMap: Record<string, string> = {
    "Codex reset is live": "Codex 重置已生效",
    "Banked reset available": "储蓄重置可用",
    "Upcoming Codex reset": "即将发生 Codex 重置",
    "Possible Codex reset": "可能的 Codex 重置",
  };
  const title = titleMap[payload.title] ?? payload.title;
  const lines = [
    `<b>${escapeHtml(title)}</b>`,
    escapeHtml(payload.body),
  ];
  if (source?.content) {
    lines.push("", "<b>原文</b>", escapeHtml(source.content.slice(0, 800)));
  }
  if (source?.contentZh) {
    lines.push("", "<b>译文</b>", escapeHtml(source.contentZh.slice(0, 800)));
  }
  if (source?.url) {
    lines.push("", `<a href="${escapeHtml(source.url)}">打开源推文</a>`);
  }
  if (appUrl) {
    lines.push(`<a href="${escapeHtml(appUrl)}">打开雷达</a>`);
  }
  return lines.join("\n");
}

export class TelegramProvider implements NotificationProvider {
  readonly id = "telegram";

  constructor(
    private readonly repo: RadarRepository,
    private readonly options?: {
      token?: string;
      chatId?: string;
      appUrl?: string;
      fetchImpl?: typeof fetch;
    },
  ) {}

  async send(payload: NotificationPayload): Promise<void> {
    const env = getServerEnv();
    const token = this.options?.token ?? env.TELEGRAM_BOT_TOKEN;
    const chatId = this.options?.chatId ?? env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) {
      throw new Error("Telegram is not configured");
    }

    const detailed = await this.repo.getEventById(payload.event.id);
    const text = buildTelegramText(
      payload,
      detailed,
      this.options?.appUrl ?? env.NEXT_PUBLIC_APP_URL,
    );
    const fetchImpl = this.options?.fetchImpl ?? fetch;
    const response = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Telegram HTTP ${response.status}: ${body.slice(0, 180)}`);
    }

    await this.repo.recordNotification({
      resetEventId: payload.event.id,
      provider: this.id,
      level: payload.level,
      status: "sent",
      notificationKey: payload.key,
    });
  }
}
