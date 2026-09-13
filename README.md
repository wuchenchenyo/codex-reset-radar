# Codex Reset Radar

A source-first dashboard that answers one question:

> Is OpenAI likely to reset Codex usage limits soon, has a reset been announced, or has one already happened?

It monitors public posts from Codex lead Tibo Sottiaux (`@thsottiaux`), runs semantic analysis, classifies reset signals, extracts timing, and updates a live dashboard.

This is not an OpenAI product. It never spends a banked reset, never stores ChatGPT passwords, and never scrapes private account pages.

![Dashboard screenshot](docs/screenshots/dashboard.png)

_Add a screenshot at `docs/screenshots/dashboard.png` after the first deploy._

## Architecture

```
User → Next.js (Vercel)
         ↑
      Supabase Postgres
         ↑
Cron (Vercel or any HTTPS cron)
  GET /api/cron/check-tibo
    SocialSource → dedupe → AIAnalyzer → ResetEngine → notifications → dashboard
```

Details: [docs/architecture.md](docs/architecture.md)

## Data flow

1. Cron authenticates with `CRON_SECRET`.
2. `XSource` fetches Tibo's latest public posts.
3. Posts are stored once (`platform + external_id` unique).
4. New posts go through Grok (default) or another OpenAI-compatible analyzer.
5. The reset engine opens or updates a single event when multiple posts describe the same reset.
6. The dashboard shows `NO RESET ANNOUNCED`, `POSSIBLE RESET`, `RESET INCOMING`, `GLOBAL RESET LIVE`, or `BANKED RESET AVAILABLE`.

## Tech stack

- Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui
- Vercel Functions + optional Vercel Cron
- Supabase PostgreSQL
- Zod, Luxon, Vitest
- pnpm

## Local development

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Without Supabase the UI still loads in an empty/setup state.

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Copy the project URL, anon key, and service role key.
3. Run `supabase/migrations/20260913000001_init.sql` in the SQL editor.
4. Confirm RLS is enabled. The migration grants public `SELECT` only. Writes go through the service role on the server.

## Environment variables

See `.env.example`.

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Vercel / local | Canonical URL |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Read-only client key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Cron writes |
| `X_BEARER_TOKEN` | Server only | Official X API |
| `XAI_API_KEY` or `AI_API_KEY` | Server only | Analyzer. MiniMax Token Plan keys start with `sk-cp-` |
| `AI_PROVIDER` | Server only | `xai` (default), `openai`, or `minimax` |
| `AI_MODEL` | Server only | Default `grok-4.6` / `MiniMax-M3` / `gpt-4.1-mini` |
| `AI_BASE_URL` | Server only | Optional. MiniMax China: `https://api.minimaxi.com/v1` |
| `CRON_SECRET` | Server only | Protects `/api/cron/check-tibo` |
| `ALLOW_MANUAL_INGEST` | Server only | Enables `/dev/ingest` in production |

Never commit `.env.local`. Never put the service role key, X token, AI key, or cron secret in client code.

## X API setup

1. Create a developer app at [developer.x.com](https://developer.x.com).
2. Issue a Bearer Token with permission to read public tweets.
3. Set `X_BEARER_TOKEN`.
4. The app reads `@thsottiaux` via `GET /2/users/by/username/:username` and `GET /2/users/:id/tweets`.

If X is down or the token is missing, the dashboard keeps history and shows that the source is temporarily unavailable.

## AI setup

Default provider is xAI Grok.

1. Create a key at [console.x.ai](https://console.x.ai).
2. Set `XAI_API_KEY`.
3. Optional: `AI_MODEL=grok-4.6`.

MiniMax Token Plan is supported. Use the **Subscription Key** from Billing → Token Plan (`sk-cp-...`), not a pay-as-you-go API key:

```env
AI_PROVIDER=minimax
AI_API_KEY=sk-cp-...
AI_MODEL=MiniMax-M3
AI_BASE_URL=https://api.minimax.io/v1
```

China-region accounts should set `AI_BASE_URL=https://api.minimaxi.com/v1`.

`AI_PROVIDER=openai` plus `AI_API_KEY` switches to OpenAI. Invalid model JSON is never written as `UNRELATED`; the post is stored and analysis stays `pending` for the next cron.

## Cron setup

### External cron (works on Vercel Hobby)

Call every 5 minutes:

```bash
curl -X GET "$NEXT_PUBLIC_APP_URL/api/cron/check-tibo" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Any HTTPS cron works (cron-job.org, GitHub Actions, EasyCron).

### Optional native Vercel Cron

`vercel.json` already contains:

```json
{
  "crons": [
    {
      "path": "/api/cron/check-tibo",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

Vercel Hobby may not run 5-minute native cron. Keep an external caller as the reliable path. Native cron still needs `CRON_SECRET`. If Vercel does not send the header, add it in the dashboard or keep using the external caller.

## Vercel deployment

1. Push this repository to GitHub.
2. Import the repo in Vercel.
3. Add the environment variables above.
4. Apply the Supabase migration.
5. Deploy.
6. Point an external cron at `/api/cron/check-tibo`.
7. Open `/status`.
8. In development, use `/dev/ingest` to run sample posts.
9. Confirm rows in `posts`, `analyses`, `reset_events`, and `monitor_runs`.
10. Enable browser notifications in Settings if you want desktop alerts while the site is open.

## Notification setup

The first provider queues browser notifications. The dashboard polls `/api/notifications/pending` and uses the Notification API when permission is granted.

Set both `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` to also send Telegram messages. Create a bot with [@BotFather](https://t.me/BotFather), start a chat with the bot, then get your chat id from `https://api.telegram.org/bot<token>/getUpdates`.

It notifies for `GLOBAL_RESET`, `BANKED_RESET`, `UPCOMING_RESET`, and `RESET_COMPLETED`. Teasers notify only at high confidence. `UNRELATED` never notifies. Each event status is sent once per provider.

## Testing

```bash
pnpm test
```

Coverage includes global/banked/upcoming/completed/teaser/unrelated posts, tomorrow and next-hour parsing, timezone conversion, event correlation, duplicate posts, duplicate cron runs, X failures, AI failures, invalid JSON, and cron auth.

Manual pipeline samples live at `/dev/ingest` when `ALLOW_MANUAL_INGEST=true` or `NODE_ENV !== production`.

Historical rebuild:

```bash
pnpm import-history data/sample-history.json
```

Imports do not send live notifications.

## Security notes

- Cron routes return 401 without `Authorization: Bearer CRON_SECRET`.
- Service role, X, AI, and cron secrets are server-only.
- LLM output is Zod-validated before insert.
- Post content is rendered as text, not HTML.
- RLS is enabled; `anon` / `authenticated` can only `SELECT`.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Dashboard empty | Supabase URL/keys and migration |
| `/status` shows X waiting | `X_BEARER_TOKEN` |
| Analyses stay pending | `XAI_API_KEY` / `AI_API_KEY` |
| Cron 401 | `CRON_SECRET` header |
| Cron 503 | Service role key |
| Duplicate alerts | Unique `(reset_event_id, provider, notification_key)` |

## Project structure

```
app/            routes and API handlers
components/     dashboard, history, settings, ui
lib/            env, time, validation, queries
services/       social, ai, reset, notifications, monitor
supabase/       SQL migration and RLS
scripts/        historical import
tests/          Vitest suites
docs/           architecture and source rules
```

## Production verification checklist

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass
- [ ] Environment variables are set in Vercel Production
- [ ] Supabase migration applied
- [ ] `GET /api/cron/check-tibo` without a bearer token returns 401
- [ ] Authorized cron writes `monitor_runs`
- [ ] `/` shows a status card
- [ ] `/history`, `/status`, and `/settings` render
- [ ] X outage does not delete posts
- [ ] Unrelated posts do not notify
