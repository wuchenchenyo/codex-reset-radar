import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { parseRelativeTime } from "@/lib/time/parse-relative";
import { formatInZone } from "@/lib/time/timezone";

const published = DateTime.fromISO("2026-09-13T18:00:00", {
  zone: "America/Los_Angeles",
}).toUTC().toJSDate();

describe("parseRelativeTime", () => {
  it("maps tomorrow from post publication time", () => {
    const parsed = parseRelativeTime("Reset tomorrow.", published);
    expect(parsed?.expression).toBe("tomorrow");
    expect(parsed?.exact).toBeNull();
    const start = DateTime.fromJSDate(parsed!.rangeStart!, { zone: "utc" }).setZone(
      "America/Los_Angeles",
    );
    expect(start.toISODate()).toBe("2026-09-14");
  });

  it("parses next hour as a bounded window", () => {
    const parsed = parseRelativeTime("Landing in the next hour", published);
    expect(parsed?.expression).toBe("next hour");
    expect(parsed?.exact).not.toBeNull();
  });

  it("does not invent an exact clock for vague later today", () => {
    const parsed = parseRelativeTime("We'll reset later today", published);
    expect(parsed?.exact).toBeNull();
    expect(parsed?.rangeEnd).not.toBeNull();
  });

  it("converts PT display into GMT+8", () => {
    const label = formatInZone(published, "Asia/Shanghai", "MMM d, h:mm a ZZZZ");
    expect(label).toContain("Sep 14");
    expect(label).toContain("9:00 AM");
  });
});
