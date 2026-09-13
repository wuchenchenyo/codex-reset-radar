import Link from "next/link";
import { cn } from "@/lib/utils";

const filters = [
  { href: "/history", label: "All" },
  { href: "/history?type=GLOBAL_RESET", label: "Global" },
  { href: "/history?type=BANKED_RESET", label: "Banked" },
  { href: "/history?type=UPCOMING_RESET", label: "Upcoming" },
  { href: "/history?type=RESET_TEASER", label: "Possible" },
  { href: "/history?status=COMPLETED", label: "Completed" },
];

export function HistoryFilters({ current }: { current: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((filter) => {
        const key = filter.href.replace("/history", "") || "all";
        const active = current === key;
        return (
          <Link
            key={filter.href}
            href={filter.href}
            className={cn(
              "rounded-full border px-3 py-1 text-xs tracking-wide uppercase",
              active
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {filter.label}
          </Link>
        );
      })}
    </div>
  );
}
