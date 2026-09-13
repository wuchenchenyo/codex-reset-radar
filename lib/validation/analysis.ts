import { z } from "zod";
import {
  RESET_CATEGORIES,
  RESET_TYPES,
  type PostAnalysis,
} from "@/types";

const booleanLike = z.union([z.boolean(), z.enum(["true", "false", "yes", "no", "1", "0"])]).transform(
  (value) => value === true || value === "true" || value === "yes" || value === "1",
);

const nullableString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null) return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed.toLowerCase() === "null" || trimmed === "-") return null;
    return trimmed;
  });

const categoryMap: Record<string, (typeof RESET_CATEGORIES)[number]> = {
  GLOBAL_RESET: "GLOBAL_RESET",
  BANKED_RESET: "BANKED_RESET",
  UPCOMING_RESET: "UPCOMING_RESET",
  RESET_TEASER: "RESET_TEASER",
  RESET_COMPLETED: "RESET_COMPLETED",
  UNRELATED: "UNRELATED",
  GLOBAL: "GLOBAL_RESET",
  BANKED: "BANKED_RESET",
  UPCOMING: "UPCOMING_RESET",
  TEASER: "RESET_TEASER",
  COMPLETED: "RESET_COMPLETED",
  NONE: "UNRELATED",
};

export const analysisLlmSchema = z.object({
  relevant: booleanLike,
  category: z.string().transform((value, ctx) => {
    const key = value.trim().toUpperCase().replace(/\s+/g, "_");
    const mapped = categoryMap[key];
    if (!mapped) {
      ctx.addIssue({ code: "custom", message: `Unknown category ${value}` });
      return z.NEVER;
    }
    return mapped;
  }),
  confidence: z.union([z.number(), z.string()]).transform((value, ctx) => {
    const n = typeof value === "number" ? value : Number(String(value).replace("%", ""));
    if (!Number.isFinite(n)) {
      ctx.addIssue({ code: "custom", message: "confidence is not a number" });
      return z.NEVER;
    }
    const scaled = n > 1 ? n / 100 : n;
    return Math.min(1, Math.max(0, scaled));
  }),
  codex_related: booleanLike,
  work_related: booleanLike,
  reset_confirmed: booleanLike,
  reset_completed: booleanLike,
  reset_type: z.string().transform((value, ctx) => {
    const key = value.trim().toLowerCase();
    if (key === "automatic" || key === "auto" || key === "global") return "automatic" as const;
    if (key === "banked" || key === "manual") return "banked" as const;
    if (key === "unknown" || key === "none" || key === "") return "unknown" as const;
    ctx.addIssue({ code: "custom", message: `Unknown reset_type ${value}` });
    return z.NEVER;
  }),
  time_expression: nullableString,
  estimated_reset_time: nullableString,
  estimated_reset_window_end: nullableString.optional(),
  summary: z.string().trim().min(1).max(1200).transform((value) => value.slice(0, 600)),
  reasoning_summary: z
    .string()
    .trim()
    .min(1)
    .max(1200)
    .transform((value) => value.slice(0, 600)),
});

export type AnalysisLlmOutput = z.infer<typeof analysisLlmSchema>;

export function coerceAnalysisPayload(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const raw = input as Record<string, unknown>;
  const categorySource = raw.category ?? raw.label ?? raw.type ?? raw.event_type;
  const category =
    typeof categorySource === "string"
      ? categorySource.trim().toUpperCase().replace(/\s+/g, "_")
      : "";
  const mapped = categoryMap[category] ?? "UNRELATED";
  const relevant =
    raw.relevant ??
    (mapped !== "UNRELATED");
  const summary =
    raw.summary ??
    raw.reasoning_summary ??
    raw.explanation ??
    "No summary provided.";
  const reasoning = raw.reasoning_summary ?? raw.summary ?? "No reasoning provided.";
  return {
    ...raw,
    relevant,
    category: mapped,
    confidence: raw.confidence ?? 0.5,
    codex_related: raw.codex_related ?? mapped !== "UNRELATED",
    work_related: raw.work_related ?? mapped !== "UNRELATED",
    reset_confirmed: raw.reset_confirmed ?? false,
    reset_completed: raw.reset_completed ?? mapped === "RESET_COMPLETED",
    reset_type: raw.reset_type ?? (mapped === "BANKED_RESET" ? "banked" : mapped === "UNRELATED" ? "unknown" : "automatic"),
    time_expression: raw.time_expression ?? null,
    estimated_reset_time: raw.estimated_reset_time ?? null,
    estimated_reset_window_end: raw.estimated_reset_window_end ?? null,
    summary,
    reasoning_summary: reasoning,
  };
}

export function parseEstimatedTime(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "null") return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function toPostAnalysis(raw: AnalysisLlmOutput): PostAnalysis {
  return {
    relevant: raw.relevant,
    category: raw.category,
    confidence: raw.confidence,
    codexRelated: raw.codex_related,
    workRelated: raw.work_related,
    resetConfirmed: raw.reset_confirmed,
    resetCompleted: raw.reset_completed,
    resetType: raw.reset_type,
    timeExpression: raw.time_expression,
    estimatedResetTime: parseEstimatedTime(raw.estimated_reset_time),
    estimatedResetWindowEnd: parseEstimatedTime(raw.estimated_reset_window_end),
    summary: raw.summary.trim(),
    reasoningSummary: raw.reasoning_summary.trim(),
  };
}

export function sanitizeAnalysis(analysis: PostAnalysis): PostAnalysis {
  let category = analysis.category;
  let relevant = analysis.relevant;
  let resetConfirmed = analysis.resetConfirmed;
  let resetCompleted = analysis.resetCompleted;

  if (category === "UNRELATED") {
    relevant = false;
    resetConfirmed = false;
    resetCompleted = false;
  }

  if (category === "RESET_TEASER") {
    resetConfirmed = false;
    resetCompleted = false;
    if (analysis.confidence < 0.5) {
      category = "UNRELATED";
      relevant = false;
    }
  }

  if (category === "UPCOMING_RESET" && resetCompleted) {
    resetCompleted = false;
  }

  if (resetCompleted && category === "UNRELATED") {
    category = "RESET_COMPLETED";
    relevant = true;
  }

  if (!relevant && category !== "UNRELATED") {
    category = "UNRELATED";
  }

  return {
    ...analysis,
    category,
    relevant,
    resetConfirmed,
    resetCompleted,
  };
}

export function certaintyFor(analysis: PostAnalysis): "confirmed" | "estimated" | "speculative" {
  if (
    analysis.category === "GLOBAL_RESET" ||
    analysis.category === "BANKED_RESET" ||
    analysis.category === "RESET_COMPLETED"
  ) {
    return analysis.confidence >= 0.75 ? "confirmed" : "estimated";
  }
  if (analysis.category === "UPCOMING_RESET") {
    return analysis.confidence >= 0.9 ? "confirmed" : "estimated";
  }
  return "speculative";
}

export function confidenceLabel(confidence: number): string {
  if (confidence >= 0.9) return "Very high";
  if (confidence >= 0.75) return "High";
  if (confidence >= 0.5) return "Medium";
  return "Low";
}
