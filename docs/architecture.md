# Architecture

## System

```
User → Next.js dashboard (Vercel)
                ↑
         Supabase PostgreSQL
                ↑
External cron / Vercel Cron
  GET /api/cron/check-tibo
    → SocialSource (XSource | ManualSource)
    → dedupe posts.external_id
    → AIAnalyzer (Grok / OpenAI-compatible)
    → ResetEngine + event correlation
    → NotificationEngine
    → monitor_runs
```

## Data flow

1. Authenticate cron with `Authorization: Bearer CRON_SECRET`.
2. Fetch latest Tibo posts. On X failure, keep history and record the error.
3. Upsert posts on `(platform, external_id)`.
4. Analyze only posts without a completed analysis. AI failures mark `analyses.status = pending`.
5. Convert relevant analyses into reset events. Related posts within 72 hours merge.
6. Queue notifications for GLOBAL / BANKED / UPCOMING / COMPLETED, and high-confidence teasers only.
7. Dashboard reads the latest open event, latest post, and last monitor run.

## Classification boundary

- Confirmed: explicit reset language from Tibo / official accounts.
- Estimated: upcoming reset with timing but no live confirmation.
- Speculative: teasers. Never shown as fact.

Personal weekly resets are a client-side clock. They never mix with Tibo events.

## Database

See `supabase/migrations/20260913000001_init.sql`.

Writes use `SUPABASE_SERVICE_ROLE_KEY` on the server. The anon key is read-only through RLS.
