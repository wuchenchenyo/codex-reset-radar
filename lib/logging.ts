type LogFields = Record<string, unknown>;

const SECRET_KEYS = new Set([
  "authorization",
  "apiKey",
  "api_key",
  "token",
  "secret",
  "bearer",
  "x_bearer_token",
  "cron_secret",
  "service_role",
  "supabase_service_role_key",
]);

function sanitize(fields?: LogFields): LogFields | undefined {
  if (!fields) return undefined;
  const next: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (SECRET_KEYS.has(key.toLowerCase())) {
      next[key] = "[redacted]";
      continue;
    }
    next[key] = value;
  }
  return next;
}

function emit(level: "info" | "warn" | "error", message: string, fields?: LogFields) {
  const payload = {
    level,
    message,
    ts: new Date().toISOString(),
    ...sanitize(fields),
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const log = {
  info: (message: string, fields?: LogFields) => emit("info", message, fields),
  warn: (message: string, fields?: LogFields) => emit("warn", message, fields),
  error: (message: string, fields?: LogFields) => emit("error", message, fields),
};
