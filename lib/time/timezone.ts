import { DateTime } from "luxon";
import { DEFAULT_TIMEZONE, TIBO_TIMEZONE } from "@/types";

export function isValidTimeZone(zone: string): boolean {
  return DateTime.now().setZone(zone).isValid;
}

export function resolveTimeZone(zone?: string | null): string {
  if (zone && isValidTimeZone(zone)) return zone;
  return DEFAULT_TIMEZONE;
}

export function toUtc(date: Date): DateTime {
  return DateTime.fromJSDate(date, { zone: "utc" });
}

export function formatInZone(
  date: Date,
  zone: string,
  format = "MMM d, yyyy h:mm a ZZZZ",
): string {
  return DateTime.fromJSDate(date, { zone: "utc" }).setZone(resolveTimeZone(zone)).toFormat(format);
}

export function tiboZone(): string {
  return TIBO_TIMEZONE;
}

export function splitPostedAndLocal(date: Date, userZone: string) {
  const utc = DateTime.fromJSDate(date, { zone: "utc" });
  return {
    posted: utc.setZone(TIBO_TIMEZONE).toFormat("MMM d, h:mm a ZZZZ"),
    local: utc.setZone(resolveTimeZone(userZone)).toFormat("MMM d, h:mm a ZZZZ"),
  };
}
