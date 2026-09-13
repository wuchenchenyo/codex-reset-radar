"use client";

import { useEffect, useState } from "react";
import { DateTime } from "luxon";
import { loadSettings } from "@/lib/settings/local";
import { formatCountdown } from "@/lib/time/parse-relative";

export function WeeklyResetCard() {
  const [label, setLabel] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<string | null>(null);

  useEffect(() => {
    function tick() {
      const settings = loadSettings();
      if (!settings.weeklyResetAt) {
        setLabel(null);
        setCountdown(null);
        return;
      }
      let next = DateTime.fromISO(settings.weeklyResetAt, { zone: settings.timezone });
      if (!next.isValid) return;
      const now = DateTime.now().setZone(settings.timezone);
      while (next <= now) {
        next = next.plus({ weeks: 1 });
      }
      setLabel(next.toFormat("MMMM d, yyyy HH:mm ZZZZ"));
      setCountdown(formatCountdown(next.toUTC().toJSDate(), now.toUTC().toJSDate()));
    }
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!label || !countdown) {
    return (
      <section className="rounded-xl border border-border/80 p-5">
        <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">My weekly reset</p>
        <p className="mt-3 text-sm text-muted-foreground">
          Personal rolling windows are independent of Tibo signals. Set yours in Settings.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border/80 p-5">
      <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">My normal reset</p>
      <p className="mt-3 font-mono text-2xl tracking-tight">{countdown}</p>
      <p className="mt-2 text-sm text-muted-foreground">{label}</p>
    </section>
  );
}
