import { getServerEnv, isTelegramConfigured } from "@/lib/env/server";
import { authorizeCron, unauthorizedResponse } from "@/services/monitor/auth";

export const dynamic = "force-dynamic";

function telegramError(body: unknown): string {
  if (body && typeof body === "object" && "description" in body) {
    const description = (body as { description?: unknown }).description;
    if (typeof description === "string" && description.length > 0) {
      return description.slice(0, 180);
    }
  }
  return "Telegram request failed";
}

export async function POST(request: Request) {
  if (!authorizeCron(request)) {
    return unauthorizedResponse();
  }

  const env = getServerEnv();
  if (!isTelegramConfigured() || !env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return Response.json({ ok: false, error: "Telegram is not configured" }, { status: 503 });
  }

  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;

  try {
    const meResponse = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const meBody = (await meResponse.json()) as {
      ok?: boolean;
      result?: { username?: string };
      description?: string;
    };
    if (!meResponse.ok || !meBody.ok) {
      return Response.json(
        { ok: false, step: "getMe", error: telegramError(meBody) },
        { status: 502 },
      );
    }

    const sendResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "<b>Codex Reset Radar</b>\nTelegram connectivity test succeeded.",
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    const sendBody = (await sendResponse.json()) as {
      ok?: boolean;
      result?: { message_id?: number };
      description?: string;
    };
    if (!sendResponse.ok || !sendBody.ok) {
      return Response.json(
        { ok: false, step: "sendMessage", error: telegramError(sendBody) },
        { status: 502 },
      );
    }

    return Response.json({
      ok: true,
      bot: meBody.result?.username ?? null,
      messageId: sendBody.result?.message_id ?? null,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Telegram test failed",
      },
      { status: 502 },
    );
  }
}
