<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Codex Reset Radar

Local-first public radar for Codex quota resets. Primary source is Tibo (`@thsottiaux`).

- Read-only. Never redeem banked resets or store ChatGPT credentials.
- Confirmed public events need a primary source, UTC timestamp, and permalink.
- Teasers stay speculative. Do not upgrade them to GLOBAL_RESET without evidence.
- Business logic lives in `services/`, not in React components or route handlers.
- Server secrets: `SUPABASE_SERVICE_ROLE_KEY`, `X_BEARER_TOKEN`, `XAI_API_KEY` / `AI_API_KEY`, `CRON_SECRET`.
