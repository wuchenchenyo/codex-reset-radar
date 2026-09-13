import { categoryLabel, statusLabel } from "@/lib/dashboard/copy";
import { formatInZone } from "@/lib/time/timezone";
import { DEFAULT_TIMEZONE, type ResetEventWithPosts, type StoredPost } from "@/types";

export function EventTimeline({ event }: { event: ResetEventWithPosts | null }) {
  if (!event || event.posts.length === 0) {
    return (
      <section className="rounded-xl border border-border/80 p-5">
        <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">Timeline</p>
        <p className="mt-3 text-sm text-muted-foreground">The next confirmed signal will open a timeline here.</p>
      </section>
    );
  }

  const items: Array<{
    id: string;
    at: Date;
    title: string;
    post?: StoredPost;
    description?: string;
  }> = [
    ...event.posts.map((post) => ({
      id: `post-${post.id}`,
      at: post.publishedAt,
      title: "源推文",
      post,
    })),
    {
      id: "status",
      at: event.updatedAt,
      title: statusLabel(event.status),
      description: `${categoryLabel(event.type)} · ${event.certainty}`,
    },
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  return (
    <section className="rounded-xl border border-border/80 p-5">
      <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">Timeline</p>
      <ol className="mt-5 space-y-5">
        {items.map((item, index) => (
          <li key={item.id} className="grid grid-cols-[12px_1fr] gap-4">
            <div className="flex flex-col items-center">
              <span className="mt-1 size-2.5 rounded-full bg-foreground/80" />
              {index < items.length - 1 ? <span className="mt-1 w-px flex-1 bg-border" /> : null}
            </div>
            <div className="pb-2">
              <p className="text-sm font-medium">{item.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatInZone(item.at, DEFAULT_TIMEZONE)}
              </p>
              {item.post ? (
                <div className="mt-2 space-y-2">
                  <p className="whitespace-pre-wrap text-sm leading-6">{item.post.content}</p>
                  {item.post.contentZh ? (
                    <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                      {item.post.contentZh}
                    </p>
                  ) : null}
                  <a
                    href={item.post.url}
                    className="inline-flex text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    打开源推文
                  </a>
                </div>
              ) : (
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
