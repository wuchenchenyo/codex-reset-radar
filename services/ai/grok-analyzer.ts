import OpenAI from "openai";
import {
  analysisLlmSchema,
  coerceAnalysisPayload,
  sanitizeAnalysis,
  toPostAnalysis,
} from "@/lib/validation/analysis";
import { getAiApiKey, getAiBaseUrl, getAiModel, getAiProvider, type AiProvider } from "@/lib/env/server";
import { log } from "@/lib/logging";
import type { PostAnalysis, SocialPost } from "@/types";
import { buildAnalysisPrompt } from "@/services/ai/prompt";
import {
  AIAnalyzer,
  AnalyzerUnavailableError,
  InvalidAnalysisError,
} from "@/services/ai/types";

function extractJson(text: string): string {
  const trimmed = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

export class GrokAnalyzer implements AIAnalyzer {
  readonly id: string;
  readonly model: string;
  private readonly client: OpenAI;

  constructor(options?: { apiKey?: string; model?: string; provider?: AiProvider; baseURL?: string }) {
    const provider = options?.provider ?? getAiProvider();
    const apiKey = options?.apiKey ?? getAiApiKey();
    if (!apiKey) {
      throw new AnalyzerUnavailableError("No AI API key configured");
    }
    this.id = provider;
    this.model = options?.model ?? getAiModel();
    this.client = new OpenAI({
      apiKey,
      baseURL: options?.baseURL ?? getAiBaseUrl(),
    });
  }

  async analyzePost(post: SocialPost): Promise<PostAnalysis> {
    const { system, user } = buildAnalysisPrompt(post);
    let content: string | null = null;
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        temperature: this.id === "minimax" ? 0.3 : 0,
        ...(this.id === "minimax"
          ? {}
          : { response_format: { type: "json_object" as const } }),
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        ...(this.id === "minimax"
          ? { extra_body: { thinking: { type: "disabled" } } }
          : {}),
      });
      content = response.choices[0]?.message?.content ?? null;
    } catch (error) {
      log.error("ai_api_error", { analyzer: this.id, model: this.model });
      throw new AnalyzerUnavailableError("AI API request failed", error);
    }

    if (!content) {
      throw new InvalidAnalysisError("AI returned an empty response");
    }

    let parsedUnknown: unknown;
    try {
      parsedUnknown = JSON.parse(extractJson(content));
    } catch (error) {
      throw new InvalidAnalysisError("AI returned invalid JSON", error);
    }

    const parsed = analysisLlmSchema.safeParse(coerceAnalysisPayload(parsedUnknown));
    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => issue.path.join(".") || "root");
      log.warn("ai_schema_invalid", {
        analyzer: this.id,
        model: this.model,
        keys: parsedUnknown && typeof parsedUnknown === "object" ? Object.keys(parsedUnknown) : [],
        issues,
      });
      throw new InvalidAnalysisError("AI JSON failed schema validation", parsed.error);
    }

    return sanitizeAnalysis(toPostAnalysis(parsed.data));
  }
}

export function createAnalyzer(): AIAnalyzer {
  return new GrokAnalyzer();
}
