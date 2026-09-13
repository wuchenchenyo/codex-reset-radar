import { EventTimeline } from "@/components/dashboard/event-timeline";
import { LatestSignal } from "@/components/dashboard/latest-signal";
import { StatusHero } from "@/components/dashboard/status-hero";
import { WeeklyResetCard } from "@/components/dashboard/weekly-reset-card";
import { getDashboardSnapshot } from "@/lib/queries/radar";
import { formatDuration } from "@/lib/time/parse-relative";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const snapshot = await getDashboardSnapshot();
  const lastCheck = snapshot.lastRun?.startedAt ?? snapshot.lastSuccessfulRun?.startedAt;
  const lastCheckedLabel = lastCheck ? formatDuration(lastCheck) : "not yet";

  return (
    <div className="space-y-6">
      {snapshot.database !== "connected" ? (
        <p className="rounded-lg border border-border px-4 py-3 text-sm text-muted-foreground">
          {snapshot.database === "unconfigured"
            ? "Supabase is not configured yet. The dashboard will populate after you add environment variables and run the first cron job."
            : "Source or database temporarily unavailable. Historical data is preserved."}
        </p>
      ) : null}
      <StatusHero event={snapshot.activeEvent} lastCheckedLabel={lastCheckedLabel} />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <LatestSignal
          post={snapshot.activeEvent?.posts.at(-1) ?? snapshot.latestPost}
          analysis={
            snapshot.activeEvent?.latestAnalysis ?? snapshot.latestAnalysis
          }
        />
        <WeeklyResetCard />
      </div>
      <EventTimeline event={snapshot.activeEvent} />
    </div>
  );
}
