import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { categoryLabel } from "@/lib/dashboard/copy";
import { confidenceLabel } from "@/lib/validation/analysis";
import { splitPostedAndLocal } from "@/lib/time/timezone";
import { DEFAULT_TIMEZONE, type StoredAnalysis, type StoredPost } from "@/types";

export function LatestSignal({
  post,
  analysis,
}: {
  post: StoredPost | null;
  analysis: StoredAnalysis | null;
}) {
  if (!post) {
    return (
      <section className="rounded-xl border border-border/80 p-5">
        <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">Latest signal</p>
        <p className="mt-3 text-sm text-muted-foreground">No Tibo posts ingested yet.</p>
      </section>
    );
  }

  const times = splitPostedAndLocal(post.publishedAt, DEFAULT_TIMEZONE);

  return (
    <section className="rounded-xl border border-border/80 p-5">
      <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">Latest signal</p>
      <div className="mt-4 flex items-start gap-3">
        <Avatar className="size-10">
          <AvatarFallback>TS</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{post.authorName}</p>
            <p className="text-sm text-muted-foreground">@{post.authorUsername}</p>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{post.content}</p>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Tibo posted {times.posted}</span>
            <span>Your time {times.local}</span>
          </div>
          {analysis ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{categoryLabel(analysis.category)}</Badge>
              <Badge variant="outline">{confidenceLabel(analysis.confidence)}</Badge>
              <Badge variant="outline">{analysis.resetType}</Badge>
              {analysis.resetConfirmed ? <Badge>Confirmed</Badge> : <Badge variant="outline">Unconfirmed</Badge>}
            </div>
          ) : (
            <p className="mt-4 text-xs text-muted-foreground">AI analysis pending</p>
          )}
          {analysis?.summary ? (
            <p className="mt-3 text-sm text-muted-foreground">{analysis.summary}</p>
          ) : null}
          <a
            href={post.url}
            className="mt-4 inline-flex text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            Open original post
          </a>
        </div>
      </div>
    </section>
  );
}
