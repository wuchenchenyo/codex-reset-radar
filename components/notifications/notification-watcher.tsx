"use client";

import { useEffect } from "react";

export function NotificationWatcher() {
  useEffect(() => {
    let cancelled = false;

    async function tick() {
      if (cancelled) return;
      if (typeof Notification === "undefined") return;
      if (Notification.permission !== "granted") return;
      try {
        const response = await fetch("/api/notifications/pending", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          notifications: Array<{ key: string; title: string; body: string }>;
        };
        const seen = new Set(JSON.parse(localStorage.getItem("crr-seen-notifications") ?? "[]") as string[]);
        for (const item of payload.notifications ?? []) {
          if (seen.has(item.key)) continue;
          new Notification(item.title, { body: item.body });
          seen.add(item.key);
        }
        localStorage.setItem("crr-seen-notifications", JSON.stringify([...seen].slice(-50)));
      } catch {
        // Browser notifications are best-effort.
      }
    }

    void tick();
    const id = window.setInterval(() => void tick(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return null;
}
