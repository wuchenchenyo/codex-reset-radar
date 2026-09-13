import { Countdown } from "@/components/dashboard/countdown";
import { heroForEvent } from "@/lib/dashboard/copy";
import { formatInZone } from "@/lib/time/timezone";
import { DEFAULT_TIMEZONE, type ResetEventWithPosts } from "@/types";
import { cn } from "@/lib/utils";

const toneClass: Record<string, string> = {
  idle: "text-foreground",
  possible: "text-amber-200",
  incoming: "text-sky-200",
  live: "text-emerald-200",
  banked: "text-violet-200",
};

export function StatusHero({
  event,
  lastCheckedLabel,
}: {
  event: ResetEventWithPosts | null;
  lastCheckedLabel: string;
}) {
  const hero = heroForEvent(event);
  const expected = event?.expectedAt ?? event?.expectedWindowEnd ?? null;

  return (
    <section className="rounded-2xl border border-border/80 px-5 py-8 sm:px-8 sm:py-10">
      <p className="text-xs tracking-[0.22em] text-muted-foreground uppercase">{hero.kicker}</p>
      <h1 className={cn("mt-4 max-w-3xl text-4xl font-medium tracking-tight sm:text-5xl", toneClass[hero.tone])}>
        {hero.title}
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">{hero.detail}</p>

      {event ? (
        <dl className="mt-8 grid gap-6 sm:grid-cols-3">
          <div>
            <dt className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Confidence</dt>
            <dd className="mt-2 font-mono text-2xl tabular-nums">{Math.round(event.confidence * 100)}%</dd>
            <p className="mt-1 text-xs text-muted-foreground capitalize">{event.certainty}</p>
          </div>
          <div>
            <dt className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Expected</dt>
            <dd className="mt-2 text-sm">
              {expected
                ? formatInZone(expected, DEFAULT_TIMEZONE)
                : event.status === "LIVE" || event.status === "COMPLETED"
                  ? "Now"
                  : "Window unknown"}
            </dd>
            {expected && event.status !== "LIVE" && event.status !== "COMPLETED" ? (
              <div className="mt-2">
                <Countdown target={expected.toISOString()} />
              </div>
            ) : null}
          </div>
          <div>
            <dt className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Source</dt>
            <dd className="mt-2 text-sm">Tibo @thsottiaux</dd>
            <p className="mt-1 text-xs text-muted-foreground">{event.resetType}</p>
          </div>
        </dl>
      ) : (
        <p className="mt-8 text-sm text-muted-foreground">Last checked {lastCheckedLabel}</p>
      )}
    </section>
  );
}
