create table public.posts (
  id bigint generated always as identity primary key,
  external_id text not null,
  platform text not null,
  author_name text not null,
  author_username text not null,
  content text not null,
  url text not null,
  published_at timestamptz not null,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint posts_platform_external_id_key unique (platform, external_id)
);

create table public.analyses (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.posts (id) on delete cascade,
  status text not null default 'pending',
  relevant boolean not null default false,
  category text not null,
  confidence double precision not null default 0,
  codex_related boolean not null default false,
  work_related boolean not null default false,
  reset_confirmed boolean not null default false,
  reset_completed boolean not null default false,
  reset_type text not null default 'unknown',
  time_expression text,
  estimated_reset_time timestamptz,
  estimated_reset_window_end timestamptz,
  summary text not null,
  reasoning_summary text not null,
  model text,
  created_at timestamptz not null default now(),
  constraint analyses_post_id_key unique (post_id),
  constraint analyses_status_check check (status in ('pending', 'completed', 'failed')),
  constraint analyses_category_check check (
    category in (
      'GLOBAL_RESET',
      'BANKED_RESET',
      'UPCOMING_RESET',
      'RESET_TEASER',
      'RESET_COMPLETED',
      'UNRELATED'
    )
  ),
  constraint analyses_reset_type_check check (reset_type in ('automatic', 'banked', 'unknown')),
  constraint analyses_confidence_check check (confidence >= 0 and confidence <= 1)
);

create table public.reset_events (
  id bigint generated always as identity primary key,
  type text not null,
  status text not null,
  reset_type text not null default 'unknown',
  certainty text not null default 'speculative',
  announced_at timestamptz,
  expected_at timestamptz,
  expected_window_end timestamptz,
  completed_at timestamptz,
  confidence double precision not null default 0,
  summary text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reset_events_type_check check (
    type in (
      'GLOBAL_RESET',
      'BANKED_RESET',
      'UPCOMING_RESET',
      'RESET_TEASER',
      'RESET_COMPLETED'
    )
  ),
  constraint reset_events_status_check check (
    status in ('POSSIBLE', 'ANNOUNCED', 'INCOMING', 'LIVE', 'COMPLETED', 'EXPIRED')
  ),
  constraint reset_events_reset_type_check check (reset_type in ('automatic', 'banked', 'unknown')),
  constraint reset_events_certainty_check check (certainty in ('confirmed', 'estimated', 'speculative')),
  constraint reset_events_confidence_check check (confidence >= 0 and confidence <= 1)
);

create table public.reset_event_posts (
  reset_event_id bigint not null references public.reset_events (id) on delete cascade,
  post_id bigint not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reset_event_id, post_id)
);

create table public.notifications (
  id bigint generated always as identity primary key,
  reset_event_id bigint not null references public.reset_events (id) on delete cascade,
  provider text not null,
  level text not null,
  status text not null,
  notification_key text not null,
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  constraint notifications_event_provider_key unique (reset_event_id, provider, notification_key),
  constraint notifications_level_check check (level in ('INFO', 'IMPORTANT', 'CRITICAL')),
  constraint notifications_status_check check (status in ('queued', 'sent', 'failed', 'skipped'))
);

create table public.settings (
  id bigint generated always as identity primary key,
  timezone text not null default 'Asia/Shanghai',
  weekly_reset_at timestamptz,
  notifications_enabled boolean not null default true,
  browser_notifications boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.monitor_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null,
  posts_fetched integer not null default 0,
  new_posts integer not null default 0,
  relevant_posts integer not null default 0,
  events_created integer not null default 0,
  notifications_sent integer not null default 0,
  error text,
  constraint monitor_runs_status_check check (status in ('running', 'success', 'partial', 'error'))
);

create index posts_published_at_idx on public.posts using btree (published_at desc);
create index analyses_status_idx on public.analyses using btree (status);
create index reset_events_status_idx on public.reset_events using btree (status);
create index reset_events_created_at_idx on public.reset_events using btree (created_at desc);
create index reset_event_posts_post_id_idx on public.reset_event_posts using btree (post_id);
create index notifications_status_idx on public.notifications using btree (status);
create index monitor_runs_started_at_idx on public.monitor_runs using btree (started_at desc);

alter table public.posts enable row level security;
alter table public.analyses enable row level security;
alter table public.reset_events enable row level security;
alter table public.reset_event_posts enable row level security;
alter table public.notifications enable row level security;
alter table public.settings enable row level security;
alter table public.monitor_runs enable row level security;

revoke all on table public.posts from anon, authenticated;
revoke all on table public.analyses from anon, authenticated;
revoke all on table public.reset_events from anon, authenticated;
revoke all on table public.reset_event_posts from anon, authenticated;
revoke all on table public.notifications from anon, authenticated;
revoke all on table public.settings from anon, authenticated;
revoke all on table public.monitor_runs from anon, authenticated;

grant select on table public.posts to anon, authenticated;
grant select on table public.analyses to anon, authenticated;
grant select on table public.reset_events to anon, authenticated;
grant select on table public.reset_event_posts to anon, authenticated;
grant select on table public.notifications to anon, authenticated;
grant select on table public.settings to anon, authenticated;
grant select on table public.monitor_runs to anon, authenticated;

create policy "Anyone can read posts"
on public.posts for select
to anon, authenticated
using (true);

create policy "Anyone can read analyses"
on public.analyses for select
to anon, authenticated
using (true);

create policy "Anyone can read reset events"
on public.reset_events for select
to anon, authenticated
using (true);

create policy "Anyone can read reset event posts"
on public.reset_event_posts for select
to anon, authenticated
using (true);

create policy "Anyone can read notifications"
on public.notifications for select
to anon, authenticated
using (true);

create policy "Anyone can read settings"
on public.settings for select
to anon, authenticated
using (true);

create policy "Anyone can read monitor runs"
on public.monitor_runs for select
to anon, authenticated
using (true);

insert into public.settings (timezone)
values ('Asia/Shanghai');
