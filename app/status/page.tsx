import { isAiConfigured, isTelegramConfigured, isXConfigured } from "@/lib/env/server";
import { getMonitorStatus } from "@/lib/queries/radar";
import { formatDuration } from "@/lib/time/parse-relative";

export const dynamic = "force-dynamic";

export default async function StatusPage() {
  const snapshot = await getMonitorStatus();
  const lastCheck = snapshot.lastRun?.startedAt;
  const lastSuccess = snapshot.lastSuccessfulRun?.completedAt ?? snapshot.lastSuccessfulRun?.startedAt;

  const rows = [
    { label: "Tibo monitor", value: isXConfigured() ? "Configured" : "Waiting for X token" },
    { label: "Last check", value: lastCheck ? formatDuration(lastCheck) : "Never" },
    { label: "Last successful fetch", value: lastSuccess ? formatDuration(lastSuccess) : "Never" },
    { label: "AI analyzer", value: isAiConfigured() ? "Online" : "Waiting for API key" },
    { label: "Database", value: snapshot.database === "connected" ? "Connected" : snapshot.database },
    {
      label: "Notification",
      value: isTelegramConfigured() ? "Telegram + browser" : "Browser queue only",
    },
    {
      label: "Last run",
      value: snapshot.lastRun
        ? `${snapshot.lastRun.status}${snapshot.lastRun.error ? ` · ${snapshot.lastRun.error}` : ""}`
        : "Not run yet",
    },
    {
      label: "Scheduler",
      value: snapshot.lastRun ? "GitHub Actions (may delay 5–30 min)" : "Not run yet",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs tracking-[0.22em] text-muted-foreground uppercase">Operations</p>
        <h1 className="mt-2 text-3xl font-medium tracking-tight">Monitor status</h1>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="rounded-xl border border-border/80 p-4">
            <dt className="text-xs tracking-[0.16em] text-muted-foreground uppercase">{row.label}</dt>
            <dd className="mt-2 text-sm">{row.value}</dd>
          </div>
        ))}
      </dl>
      <section className="rounded-xl border border-border/80 p-5">
        <h2 className="text-sm font-medium">Recent errors</h2>
        {snapshot.recentErrors.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No recent errors.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {snapshot.recentErrors.map((error) => (
              <li key={error} className="rounded-md bg-muted/50 px-3 py-2 font-mono text-xs">
                {error}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
