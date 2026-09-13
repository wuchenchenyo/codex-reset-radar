export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-52 animate-pulse rounded-2xl border border-border/80 bg-muted/40" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-40 animate-pulse rounded-xl border border-border/80 bg-muted/40" />
        <div className="h-40 animate-pulse rounded-xl border border-border/80 bg-muted/40" />
      </div>
    </div>
  );
}
