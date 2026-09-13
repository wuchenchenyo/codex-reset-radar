import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  NEXT_PUBLIC_APP_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  X_BEARER_TOKEN: z.string().optional(),
  XAI_API_KEY: z.string().optional(),
  AI_API_KEY: z.string().optional(),
  AI_PROVIDER: z.enum(["xai", "openai", "minimax"]).optional(),
  AI_MODEL: z.string().optional(),
  AI_BASE_URL: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  ALLOW_MANUAL_INGEST: z.string().optional(),
  DEFAULT_TIMEZONE: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

function emptyToUndefined(value: string | undefined): string | undefined {
  return value ? value : undefined;
}

export function getServerEnv(): ServerEnv {
  return serverEnvSchema.parse({
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_APP_URL: emptyToUndefined(process.env.NEXT_PUBLIC_APP_URL),
    NEXT_PUBLIC_SUPABASE_URL: emptyToUndefined(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: emptyToUndefined(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_ROLE_KEY: emptyToUndefined(process.env.SUPABASE_SERVICE_ROLE_KEY),
    X_BEARER_TOKEN: emptyToUndefined(process.env.X_BEARER_TOKEN),
    XAI_API_KEY: emptyToUndefined(process.env.XAI_API_KEY),
    AI_API_KEY: emptyToUndefined(process.env.AI_API_KEY),
    AI_PROVIDER: emptyToUndefined(process.env.AI_PROVIDER),
    AI_MODEL: emptyToUndefined(process.env.AI_MODEL),
    AI_BASE_URL: emptyToUndefined(process.env.AI_BASE_URL),
    CRON_SECRET: emptyToUndefined(process.env.CRON_SECRET),
    ALLOW_MANUAL_INGEST: emptyToUndefined(process.env.ALLOW_MANUAL_INGEST),
    DEFAULT_TIMEZONE: emptyToUndefined(process.env.DEFAULT_TIMEZONE),
  });
}

export function isSupabaseConfigured(): boolean {
  const env = getServerEnv();
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

export function isAiConfigured(): boolean {
  const env = getServerEnv();
  return Boolean(env.XAI_API_KEY || env.AI_API_KEY);
}

export function isXConfigured(): boolean {
  return Boolean(getServerEnv().X_BEARER_TOKEN);
}

export function isManualIngestAllowed(): boolean {
  const env = getServerEnv();
  if (env.ALLOW_MANUAL_INGEST === "true") return true;
  return env.NODE_ENV !== "production";
}

export function getAiApiKey(): string | null {
  const env = getServerEnv();
  return env.XAI_API_KEY || env.AI_API_KEY || null;
}

export type AiProvider = "xai" | "openai" | "minimax";

export function getAiProvider(): AiProvider {
  const env = getServerEnv();
  if (env.AI_PROVIDER) return env.AI_PROVIDER;
  if (env.XAI_API_KEY) return "xai";
  if (env.AI_API_KEY?.startsWith("sk-cp-")) return "minimax";
  return "openai";
}

export function getAiModel(): string {
  const env = getServerEnv();
  if (env.AI_MODEL) return env.AI_MODEL;
  if (getAiProvider() === "xai") return "grok-4.6";
  if (getAiProvider() === "minimax") return "MiniMax-M3";
  return "gpt-4.1-mini";
}

export function getAiBaseUrl(): string {
  const env = getServerEnv();
  if (env.AI_BASE_URL) return env.AI_BASE_URL;
  switch (getAiProvider()) {
    case "openai":
      return "https://api.openai.com/v1";
    case "minimax":
      return "https://api.minimax.io/v1";
    default:
      return "https://api.x.ai/v1";
  }
}
