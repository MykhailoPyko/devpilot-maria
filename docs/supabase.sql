-- Run once in Supabase SQL Editor. Dedicated table: does not alter existing CRM tables.
create table if not exists public.devpilot_web_leads (
  request_id uuid primary key,
  name text not null check (char_length(name) between 1 and 100),
  task text not null check (char_length(task) between 1 and 700),
  contact text not null check (char_length(contact) between 1 and 160),
  consent boolean not null check (consent = true),
  consent_version text not null default 'contact-request-v1',
  source text not null default 'devpilot-netlify',
  created_at timestamptz not null default now(),
  notification_status text not null default 'pending' check (notification_status in ('pending','sent'))
);
alter table public.devpilot_web_leads enable row level security;
revoke all on public.devpilot_web_leads from anon, authenticated;
grant select, insert, update on public.devpilot_web_leads to service_role;
-- Browser access is disabled; only server-side credentials may write this table.
-- notification_status='pending' includes not-yet-delivered/failed notifications.
