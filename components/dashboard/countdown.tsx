"use client";

import { useEffect, useState } from "react";
import { formatCountdown } from "@/lib/time/parse-relative";

export function Countdown({ target }: { target: string }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span className="font-mono text-2xl tracking-tight tabular-nums sm:text-3xl">
      {formatCountdown(new Date(target), now)}
    </span>
  );
}
