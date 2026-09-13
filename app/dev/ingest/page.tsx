import { notFound } from "next/navigation";
import { isManualIngestAllowed } from "@/lib/env/server";
import { IngestForm } from "@/components/dev/ingest-form";

export const dynamic = "force-dynamic";

export default function IngestPage() {
  if (!isManualIngestAllowed()) notFound();
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs tracking-[0.22em] text-muted-foreground uppercase">Development</p>
        <h1 className="mt-2 text-3xl font-medium tracking-tight">Manual ingest</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Submit a sample Tibo post through the full pipeline. This route is blocked in production unless ALLOW_MANUAL_INGEST=true, and still requires CRON_SECRET.
        </p>
      </div>
      <IngestForm />
    </div>
  );
}
