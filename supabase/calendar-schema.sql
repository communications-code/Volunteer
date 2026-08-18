BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Serving Network keeps its own admin/session model, so this cutover schema
-- intentionally aligns the calendar data tables only. We preserve `created_by`
-- values as UUIDs, but do not recreate the standalone Calendar app's
-- `admins_profile` or `auth.users` foreign keys.

CREATE TABLE IF NOT EXISTS calendar_event_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL DEFAULT 'clh',
  title TEXT NOT NULL,
  location TEXT,
  description_html TEXT NOT NULL DEFAULT '',
  all_day BOOLEAN NOT NULL DEFAULT false,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  recurrence_rule TEXT,
  recurrence_until TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  event_color TEXT NOT NULL DEFAULT '#2563eb',
  text_color TEXT NOT NULL DEFAULT '#ffffff',
  integration_source TEXT,
  integration_key TEXT,
  group_name TEXT
);

ALTER TABLE calendar_event_series
  ADD COLUMN IF NOT EXISTS org_id TEXT NOT NULL DEFAULT 'clh',
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS description_html TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS all_day BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/New_York',
  ADD COLUMN IF NOT EXISTS recurrence_rule TEXT,
  ADD COLUMN IF NOT EXISTS recurrence_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS event_color TEXT NOT NULL DEFAULT '#2563eb',
  ADD COLUMN IF NOT EXISTS text_color TEXT NOT NULL DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS integration_source TEXT,
  ADD COLUMN IF NOT EXISTS integration_key TEXT,
  ADD COLUMN IF NOT EXISTS group_name TEXT;

ALTER TABLE calendar_event_series
  ALTER COLUMN org_id SET DEFAULT 'clh',
  ALTER COLUMN description_html SET DEFAULT '',
  ALTER COLUMN all_day SET DEFAULT false,
  ALTER COLUMN timezone SET DEFAULT 'America/New_York',
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW(),
  ALTER COLUMN event_color SET DEFAULT '#2563eb',
  ALTER COLUMN text_color SET DEFAULT '#ffffff';

CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL DEFAULT 'clh',
  series_id UUID REFERENCES calendar_event_series(id) ON DELETE CASCADE,
  occurrence_start TIMESTAMPTZ NOT NULL,
  occurrence_end TIMESTAMPTZ NOT NULL,
  title_override TEXT,
  location_override TEXT,
  description_html_override TEXT,
  all_day_override BOOLEAN,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS org_id TEXT NOT NULL DEFAULT 'clh',
  ADD COLUMN IF NOT EXISTS series_id UUID,
  ADD COLUMN IF NOT EXISTS occurrence_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS occurrence_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS title_override TEXT,
  ADD COLUMN IF NOT EXISTS location_override TEXT,
  ADD COLUMN IF NOT EXISTS description_html_override TEXT,
  ADD COLUMN IF NOT EXISTS all_day_override BOOLEAN,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE calendar_events
  ALTER COLUMN org_id SET DEFAULT 'clh',
  ALTER COLUMN status SET DEFAULT 'ACTIVE',
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

CREATE TABLE IF NOT EXISTS calendar_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL DEFAULT 'clh',
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT,
  request_path TEXT,
  http_method TEXT,
  response_status INTEGER,
  response_payload JSONB,
  webhook_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE calendar_audit_log
  ADD COLUMN IF NOT EXISTS org_id TEXT NOT NULL DEFAULT 'clh',
  ADD COLUMN IF NOT EXISTS event_type TEXT,
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS entity_id UUID,
  ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS request_path TEXT,
  ADD COLUMN IF NOT EXISTS http_method TEXT,
  ADD COLUMN IF NOT EXISTS response_status INTEGER,
  ADD COLUMN IF NOT EXISTS response_payload JSONB,
  ADD COLUMN IF NOT EXISTS webhook_status TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE calendar_audit_log
  ALTER COLUMN org_id SET DEFAULT 'clh',
  ALTER COLUMN payload SET DEFAULT '{}'::jsonb,
  ALTER COLUMN created_at SET DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'calendar_event_series_time_check'
  ) THEN
    ALTER TABLE calendar_event_series
      ADD CONSTRAINT calendar_event_series_time_check
      CHECK (ends_at > starts_at);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'calendar_events_time_check'
  ) THEN
    ALTER TABLE calendar_events
      ADD CONSTRAINT calendar_events_time_check
      CHECK (occurrence_end > occurrence_start);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'calendar_events_series_id_fkey'
  ) THEN
    ALTER TABLE calendar_events
      ADD CONSTRAINT calendar_events_series_id_fkey
      FOREIGN KEY (series_id)
      REFERENCES calendar_event_series(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_calendar_event_series_org_starts
  ON calendar_event_series(org_id, starts_at);

CREATE INDEX IF NOT EXISTS idx_calendar_event_series_recurrence
  ON calendar_event_series(org_id, recurrence_rule)
  WHERE recurrence_rule IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_event_series_org_group_name
  ON calendar_event_series(org_id, group_name)
  WHERE group_name IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_event_series_integration_unique
  ON calendar_event_series(org_id, integration_source, integration_key)
  WHERE integration_source IS NOT NULL AND integration_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_events_org_occurrence
  ON calendar_events(org_id, occurrence_start);

CREATE INDEX IF NOT EXISTS idx_calendar_audit_org_created
  ON calendar_audit_log(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_calendar_audit_idempotency
  ON calendar_audit_log(org_id, idempotency_key, http_method, request_path)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE IF EXISTS calendar_event_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS calendar_audit_log ENABLE ROW LEVEL SECURITY;

COMMIT;
