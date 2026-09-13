import Link from "next/link";
import { HistoryFilters } from "@/components/history/history-filters";
import { categoryLabel, statusLabel } from "@/lib/dashboard/copy";
import { getHistory } from "@/lib/queries/radar";
import { formatInZone } from "@/lib/time/timezone";
import { DEFAULT_TIMEZONE } from "@/types";

export const dynamic = "force-dynamic";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const type = params.type;
  const status = params.status;
  const page = Number(params.page ?? "1");
  const data = await getHistory({ type, status, page });
  const current = type ? `?type=${type}` : status ? `?status=${status}` : "all";
  const pages = Math.max(1, Math.ceil(data.total / (data.limit ?? 20)));

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs tracking-[0.22em] text-muted-foreground uppercase">Archive</p>
        <h1 className="mt-2 text-3xl font-medium tracking-tight">Reset history</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Confirmed, estimated, and speculative events stay labeled. Historical cadence is descriptive, not a prediction.
        </p>
      </div>

      {data.stats ? (
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Total resets" value={String(data.stats.totalResets)} />
          <Stat label="Global" value={String(data.stats.globalResets)} />
          <Stat label="Banked" value={String(data.stats.bankedResets)} />
          <Stat
            label="Avg days between"
            value={
              data.stats.averageDaysBetween == null
                ? "—"
                : data.stats.averageDaysBetween.toFixed(1)
            }
          />
        </dl>
      ) : null}

      <HistoryFilters current={current} />

      <div className="overflow-x-auto rounded-xl border border-border/80">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Expected</th>
              <th className="px-4 py-3 font-medium">Certainty</th>
              <th className="px-4 py-3 font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {data.events.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-muted-foreground">
                  No reset events stored yet.
                </td>
              </tr>
            ) : (
              data.events.map((event) => (
                <tr key={event.id} className="border-b border-border/70 last:border-0">
                  <td className="px-4 py-3">
                    {event.announcedAt ? formatInZone(event.announcedAt, DEFAULT_TIMEZONE, "MMM d, yyyy") : "—"}
                  </td>
                  <td className="px-4 py-3">{categoryLabel(event.type)}</td>
                  <td className="px-4 py-3">{statusLabel(event.status)}</td>
                  <td className="px-4 py-3">
                    {event.expectedAt ? formatInZone(event.expectedAt, DEFAULT_TIMEZONE, "MMM d, h:mm a") : "—"}
                  </td>
                  <td className="px-4 py-3 capitalize">{event.certainty}</td>
                  <td className="px-4 py-3 text-muted-foreground">{event.posts.length} post{event.posts.length === 1 ? "" : "s"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 ? (
        <div className="flex items-center gap-3 text-sm">
          {page > 1 ? (
            <Link href={`/history?page=${page - 1}${type ? `&type=${type}` : ""}${status ? `&status=${status}` : ""}`}>
              Previous
            </Link>
          ) : null}
          <span className="text-muted-foreground">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={`/history?page=${page + 1}${type ? `&type=${type}` : ""}${status ? `&status=${status}` : ""}`}>
              Next
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/80 p-4">
      <dt className="text-xs tracking-[0.16em] text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-2 font-mono text-2xl tabular-nums">{value}</dd>
    </div>
  );
}
