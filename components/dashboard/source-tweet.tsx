import type { StoredPost } from "@/types";

export function SourceTweet({ post }: { post: StoredPost }) {
  return (
    <div className="min-w-0">
      <div>
        <p className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">原文</p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{post.content}</p>
      </div>
      {post.contentZh ? (
        <div className="mt-4 border-t border-border/70 pt-4">
          <p className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">中文翻译</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{post.contentZh}</p>
        </div>
      ) : null}
      <a
        href={post.url}
        className="mt-4 inline-flex text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        target="_blank"
        rel="noreferrer"
      >
        打开源推文
      </a>
    </div>
  );
}
