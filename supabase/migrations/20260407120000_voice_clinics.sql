-- Voice + calendar: one row per clinic phone line.
-- Vercel uses SUPABASE_SERVICE_ROLE_KEY (bypasses RLS) — do not expose that key in the browser.

create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  clinic_id text not null unique,
  clinic_name text not null,
  inbound_phone_e164 text not null unique,
  open_time text not null default '09:00',
  close_time text not null default '17:00',
  callback_time text default 'the next business day',
  emergency_number text not null default '911',
  timezone text not null default 'America/New_York',
  created_at timestamptz not null default now()
);

create table if not exists public.clinic_integrations (
  clinic_id text primary key references public.clinics (clinic_id) on delete cascade,
  google_refresh_token text,
  google_calendar_id text not null default 'primary',
  updated_at timestamptz not null default now()
);

create index if not exists clinics_inbound_phone_idx on public.clinics (inbound_phone_e164);

alter table public.clinics enable row level security;
alter table public.clinic_integrations enable row level security;

-- No policies: anon/authenticated cannot read. Only service_role (server) can access via REST.

comment on table public.clinics is 'Inbound DID → Vapi variableValues (clinic_name, hours, clinic_id).';
comment on table public.clinic_integrations is 'Per-clinic Google Calendar OAuth refresh token; never expose to client.';
