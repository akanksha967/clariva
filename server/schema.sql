-- Clariva production schema (Postgres / Supabase)
-- Run in Supabase SQL editor or: psql $DATABASE_URL -f schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS clinics (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  timezone        TEXT NOT NULL DEFAULT 'UTC',
  open_time       TEXT NOT NULL DEFAULT '09:00',
  close_time      TEXT NOT NULL DEFAULT '17:00',
  emergency_number TEXT,
  calcom_url      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leads (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL,
  clinic_id  TEXT,
  clinic_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads (created_at DESC);

CREATE TABLE IF NOT EXISTS callbacks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id    TEXT NOT NULL,
  patient_name TEXT,
  phone        TEXT NOT NULL,
  urgency      TEXT NOT NULL DEFAULT 'normal',
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  raw_payload  JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_callbacks_clinic_created ON callbacks (clinic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_callbacks_status ON callbacks (status);

CREATE TABLE IF NOT EXISTS calls (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       TEXT,
  clinic_name     TEXT,
  duration_seconds INTEGER,
  status          TEXT NOT NULL DEFAULT 'completed',
  transcript      TEXT,
  vapi_call_id    TEXT,
  raw_payload     JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calls_clinic_created ON calls (clinic_id, created_at DESC);
