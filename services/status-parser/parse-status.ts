import { DateTime } from "luxon";

export interface ParsedCodexStatus {
  fiveHourRemainingPct: number | null;
  weeklyRemainingPct: number | null;
  fiveHourResetsAt: Date | null;
  weeklyResetsAt: Date | null;
  raw: string;
}

const PCT = /(\d+(?:\.\d+)?)%/g;

function parseTimestamp(value: string, now: Date): Date | null {
  const iso = DateTime.fromISO(value, { zone: "utc" });
  if (iso.isValid) return iso.toJSDate();
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) return date;
  const relative = value.match(/in\s+(\d+)h/i);
  if (relative) {
    return DateTime.fromJSDate(now, { zone: "utc" })
      .plus({ hours: Number(relative[1]) })
      .toJSDate();
  }
  return null;
}

export function parseCodexStatus(raw: string, now = new Date()): ParsedCodexStatus {
  const text = raw.replace(/\r/g, "");
  const fiveHourBlock = text.match(/5h[\s\S]{0,180}/i)?.[0] ?? "";
  const weeklyBlock = text.match(/weekly[\s\S]{0,180}/i)?.[0] ?? "";

  const fivePct = [...fiveHourBlock.matchAll(PCT)].map((match) => Number(match[1]));
  const weeklyPct = [...weeklyBlock.matchAll(PCT)].map((match) => Number(match[1]));

  const fiveReset = fiveHourBlock.match(/resets?\s+(?:at\s+)?(.+)$/im)?.[1];
  const weeklyReset = weeklyBlock.match(/resets?\s+(?:at\s+)?(.+)$/im)?.[1];

  return {
    fiveHourRemainingPct: fivePct[0] ?? null,
    weeklyRemainingPct: weeklyPct[0] ?? null,
    fiveHourResetsAt: fiveReset ? parseTimestamp(fiveReset.trim(), now) : null,
    weeklyResetsAt: weeklyReset ? parseTimestamp(weeklyReset.trim(), now) : null,
    raw,
  };
}
