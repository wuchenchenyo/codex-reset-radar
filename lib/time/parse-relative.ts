import { DateTime, Interval } from "luxon";
import { TIBO_TIMEZONE } from "@/types";

export interface ParsedTime {
  expression: string;
  exact: Date | null;
  rangeStart: Date | null;
  rangeEnd: Date | null;
}

const WEEKDAYS: Record<string, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
};

function ref(publishedAt: Date): DateTime {
  return DateTime.fromJSDate(publishedAt, { zone: "utc" }).setZone(TIBO_TIMEZONE);
}

function rangeOfDay(day: DateTime): ParsedTime {
  const start = day.startOf("day");
  const end = day.endOf("day");
  return {
    expression: "day",
    exact: null,
    rangeStart: start.toUTC().toJSDate(),
    rangeEnd: end.toUTC().toJSDate(),
  };
}

function withClock(day: DateTime, hour: number, minute = 0): ParsedTime {
  const exact = day.set({ hour, minute, second: 0, millisecond: 0 });
  return {
    expression: "clock",
    exact: exact.toUTC().toJSDate(),
    rangeStart: exact.toUTC().toJSDate(),
    rangeEnd: exact.toUTC().toJSDate(),
  };
}

function parseClock(text: string): { hour: number; minute: number } | null {
  const match = text.match(
    /\b(?:around\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(pt|pst|pdt)?\b/i,
  );
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3]?.toLowerCase();
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  if (!meridiem && hour <= 7) hour += 12;
  if (hour > 23) return null;
  return { hour, minute };
}

export function parseRelativeTime(
  text: string,
  publishedAt: Date,
): ParsedTime | null {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  const origin = ref(publishedAt);
  const clock = parseClock(normalized);

  if (/\bin a few minutes\b|\bin minutes\b/.test(normalized)) {
    const exact = origin.plus({ minutes: 10 });
    return {
      expression: "in a few minutes",
      exact: exact.toUTC().toJSDate(),
      rangeStart: origin.toUTC().toJSDate(),
      rangeEnd: origin.plus({ minutes: 30 }).toUTC().toJSDate(),
    };
  }

  if (/\bnext hour\b|\bin the next hour\b|\bin an hour\b/.test(normalized)) {
    const exact = origin.plus({ hours: 1 });
    return {
      expression: "next hour",
      exact: exact.toUTC().toJSDate(),
      rangeStart: origin.toUTC().toJSDate(),
      rangeEnd: origin.plus({ hours: 1 }).toUTC().toJSDate(),
    };
  }

  if (/\bfew hours\b|\bin a few hours\b|\bin the next few hours\b/.test(normalized)) {
    return {
      expression: "few hours",
      exact: null,
      rangeStart: origin.toUTC().toJSDate(),
      rangeEnd: origin.plus({ hours: 6 }).toUTC().toJSDate(),
    };
  }

  if (/\blater today\b|\bthis afternoon\b/.test(normalized)) {
    const start = origin;
    const end = origin.set({ hour: 23, minute: 59, second: 59 });
    return {
      expression: "later today",
      exact: clock ? withClock(origin, clock.hour, clock.minute).exact : null,
      rangeStart: start.toUTC().toJSDate(),
      rangeEnd: end.toUTC().toJSDate(),
    };
  }

  if (/\btonight\b/.test(normalized)) {
    const start = origin.set({ hour: 18, minute: 0, second: 0 });
    const end = origin.endOf("day");
    return {
      expression: "tonight",
      exact: clock ? withClock(origin, clock.hour, clock.minute).exact : null,
      rangeStart: (start < origin ? origin : start).toUTC().toJSDate(),
      rangeEnd: end.toUTC().toJSDate(),
    };
  }

  if (/\btomorrow morning\b/.test(normalized)) {
    const day = origin.plus({ days: 1 });
    return {
      expression: "tomorrow morning",
      exact: null,
      rangeStart: day.set({ hour: 6 }).toUTC().toJSDate(),
      rangeEnd: day.set({ hour: 12 }).toUTC().toJSDate(),
    };
  }

  if (/\btomorrow afternoon\b/.test(normalized)) {
    const day = origin.plus({ days: 1 });
    return {
      expression: "tomorrow afternoon",
      exact: null,
      rangeStart: day.set({ hour: 12 }).toUTC().toJSDate(),
      rangeEnd: day.set({ hour: 18 }).toUTC().toJSDate(),
    };
  }

  if (/\btomorrow\b/.test(normalized)) {
    const day = origin.plus({ days: 1 });
    if (clock) return { ...withClock(day, clock.hour, clock.minute), expression: "tomorrow" };
    return { ...rangeOfDay(day), expression: "tomorrow" };
  }

  if (/\bthis weekend\b/.test(normalized)) {
    const saturday = origin.set({ weekday: 6 }).startOf("day");
    const weekendStart = saturday < origin ? origin : saturday;
    const sundayEnd = origin.set({ weekday: 7 }).endOf("day");
    return {
      expression: "this weekend",
      exact: null,
      rangeStart: weekendStart.toUTC().toJSDate(),
      rangeEnd: sundayEnd.toUTC().toJSDate(),
    };
  }

  if (/\bnext week\b/.test(normalized)) {
    const start = origin.plus({ weeks: 1 }).startOf("week");
    const end = start.endOf("week");
    return {
      expression: "next week",
      exact: null,
      rangeStart: start.toUTC().toJSDate(),
      rangeEnd: end.toUTC().toJSDate(),
    };
  }

  for (const [name, weekday] of Object.entries(WEEKDAYS)) {
    if (new RegExp(`\\b${name}\\b`).test(normalized)) {
      let day = origin.set({ weekday: weekday as 1 | 2 | 3 | 4 | 5 | 6 | 7 });
      if (day <= origin) day = day.plus({ weeks: 1 });
      if (clock) return { ...withClock(day, clock.hour, clock.minute), expression: name };
      return { ...rangeOfDay(day), expression: name };
    }
  }

  if (clock && /\b(today|pt|pst|pdt)\b/.test(normalized)) {
    return { ...withClock(origin, clock.hour, clock.minute), expression: "clock" };
  }

  return null;
}

export function mergeAiAndParsedTime(options: {
  publishedAt: Date;
  text: string;
  timeExpression: string | null;
  aiExact: Date | null;
  aiWindowEnd: Date | null;
}): ParsedTime | null {
  const source = options.timeExpression
    ? `${options.timeExpression} ${options.text}`
    : options.text;
  const parsed = parseRelativeTime(source, options.publishedAt);

  if (!parsed && !options.aiExact && !options.aiWindowEnd) return null;

  if (parsed && !parsed.exact && options.aiExact) {
    const ai = DateTime.fromJSDate(options.aiExact, { zone: "utc" });
    if (parsed.rangeStart && parsed.rangeEnd) {
      const interval = Interval.fromDateTimes(
        DateTime.fromJSDate(parsed.rangeStart, { zone: "utc" }),
        DateTime.fromJSDate(parsed.rangeEnd, { zone: "utc" }),
      );
      if (interval.contains(ai) && interval.toDuration().as("hours") <= 6) {
        return { ...parsed, exact: options.aiExact };
      }
    }
    return parsed;
  }

  if (parsed) return parsed;

  return {
    expression: options.timeExpression ?? "ai",
    exact: options.aiExact,
    rangeStart: options.aiExact,
    rangeEnd: options.aiWindowEnd,
  };
}

export function formatCountdown(target: Date, now = new Date()): string {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return "00:00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  if (days > 0) return `${days}d ${hh}:${mm}:${ss}`;
  return `${hh}:${mm}:${ss}`;
}

export function formatDuration(from: Date, to = new Date()): string {
  const ms = Math.max(0, to.getTime() - from.getTime());
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours === 1) return "1 hour ago";
  if (hours < 48) return `${hours} hours ago`;
  const days = Math.round(hours / 24);
  return `${days} days ago`;
}
