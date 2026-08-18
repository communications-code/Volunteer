import postgres from "postgres";

type CalendarTransferMode = "merge" | "replace";

type CalendarSeriesRow = {
  id: string;
  org_id: string;
  title: string;
  group_name: string | null;
  location: string | null;
  description_html: string;
  event_color: string;
  text_color: string;
  all_day: boolean;
  starts_at: string;
  ends_at: string;
  timezone: string;
  recurrence_rule: string | null;
  recurrence_until: string | null;
  integration_source: string | null;
  integration_key: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type CalendarEventRow = {
  id: string;
  org_id: string;
  series_id: string | null;
  occurrence_start: string;
  occurrence_end: string;
  title_override: string | null;
  location_override: string | null;
  description_html_override: string | null;
  all_day_override: boolean | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type CalendarAuditRow = {
  id: string;
  org_id: string;
  event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  payload: unknown;
  idempotency_key: string | null;
  request_path: string | null;
  http_method: string | null;
  response_status: number | null;
  response_payload: unknown;
  webhook_status: string | null;
  created_at: string;
};

type CalendarExportBundle = {
  version: string;
  exportedAt: string;
  orgId: string;
  eventSeries: CalendarSeriesRow[];
  events: CalendarEventRow[];
  auditLog?: CalendarAuditRow[];
};

export type CalendarTransferResult = {
  sourceBaseUrl: string;
  mode: CalendarTransferMode;
  orgId: string;
  exportedAt: string;
  importedSeries: number;
  importedEvents: number;
  importedAuditLog: number;
};

type CalendarTransferOptions = {
  mode?: CalendarTransferMode;
  sourceBaseUrl?: string;
  sourceOrgId?: string;
  timeoutMs?: number;
};

const DEFAULT_SOURCE_BASE_URL = "https://clh-calendar.vercel.app";
const DEFAULT_SOURCE_ORG_ID = "clh";
const DEFAULT_TIMEOUT_MS = 20_000;

function getTimeoutMs(rawTimeout?: number): number {
  if (!rawTimeout || !Number.isFinite(rawTimeout)) {
    return DEFAULT_TIMEOUT_MS;
  }
  return Math.max(2_000, Math.floor(rawTimeout));
}

function truncateTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchCalendarBundle(params: {
  baseUrl: string;
  timeoutMs: number;
}): Promise<CalendarExportBundle> {
  const { baseUrl, timeoutMs } = params;

  const exportResponse = await fetchWithTimeout(
    `${baseUrl}/api/v1/calendar/export`,
    {
      method: "GET",
    },
    timeoutMs,
  );

  if (!exportResponse.ok) {
    const details = (await exportResponse.text().catch(() => "")).trim();
    throw new Error(
      `Calendar export failed (${exportResponse.status})${details ? `: ${details.slice(0, 220)}` : ""}`,
    );
  }

  const bundle = (await exportResponse.json()) as CalendarExportBundle;
  if (!bundle || !Array.isArray(bundle.eventSeries) || !Array.isArray(bundle.events)) {
    throw new Error("Calendar export payload is invalid.");
  }

  return bundle;
}

async function ensureCalendarTables(sql: postgres.Sql) {
  await sql`create extension if not exists pgcrypto`;

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS calendar_event_series (
      id UUID PRIMARY KEY,
      org_id TEXT NOT NULL DEFAULT 'clh',
      title TEXT NOT NULL,
      group_name TEXT,
      location TEXT,
      description_html TEXT NOT NULL DEFAULT '',
      event_color TEXT NOT NULL DEFAULT '#2563eb',
      text_color TEXT NOT NULL DEFAULT '#ffffff',
      all_day BOOLEAN NOT NULL DEFAULT false,
      starts_at TIMESTAMPTZ NOT NULL,
      ends_at TIMESTAMPTZ NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'America/New_York',
      recurrence_rule TEXT,
      recurrence_until TIMESTAMPTZ,
      integration_source TEXT,
      integration_key TEXT,
      created_by UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    )
  `);

  await sql.unsafe(`
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
      ADD COLUMN IF NOT EXISTS group_name TEXT,
      ADD COLUMN IF NOT EXISTS event_color TEXT NOT NULL DEFAULT '#2563eb',
      ADD COLUMN IF NOT EXISTS text_color TEXT NOT NULL DEFAULT '#ffffff',
      ADD COLUMN IF NOT EXISTS integration_source TEXT,
      ADD COLUMN IF NOT EXISTS integration_key TEXT
  `);

  await sql.unsafe(`
    ALTER TABLE calendar_event_series
      ALTER COLUMN org_id SET DEFAULT 'clh',
      ALTER COLUMN description_html SET DEFAULT '',
      ALTER COLUMN all_day SET DEFAULT false,
      ALTER COLUMN timezone SET DEFAULT 'America/New_York',
      ALTER COLUMN created_at SET DEFAULT NOW(),
      ALTER COLUMN updated_at SET DEFAULT NOW(),
      ALTER COLUMN event_color SET DEFAULT '#2563eb',
      ALTER COLUMN text_color SET DEFAULT '#ffffff'
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id UUID PRIMARY KEY,
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
    )
  `);

  await sql.unsafe(`
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
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);

  await sql.unsafe(`
    ALTER TABLE calendar_events
      ALTER COLUMN org_id SET DEFAULT 'clh',
      ALTER COLUMN status SET DEFAULT 'ACTIVE',
      ALTER COLUMN created_at SET DEFAULT NOW(),
      ALTER COLUMN updated_at SET DEFAULT NOW()
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS calendar_audit_log (
      id UUID PRIMARY KEY,
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
    )
  `);

  await sql.unsafe(`
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
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);

  await sql.unsafe(`
    ALTER TABLE calendar_audit_log
      ALTER COLUMN org_id SET DEFAULT 'clh',
      ALTER COLUMN payload SET DEFAULT '{}'::jsonb,
      ALTER COLUMN created_at SET DEFAULT NOW()
  `);

  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_calendar_event_series_org_starts
    ON calendar_event_series(org_id, starts_at)
  `);

  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_calendar_event_series_recurrence
    ON calendar_event_series(org_id, recurrence_rule)
  `);

  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_calendar_event_series_org_group_name
    ON calendar_event_series(org_id, group_name)
    WHERE group_name IS NOT NULL
  `);

  await sql.unsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_event_series_integration_unique
    ON calendar_event_series(org_id, integration_source, integration_key)
    WHERE integration_source IS NOT NULL AND integration_key IS NOT NULL
  `);

  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_calendar_events_org_occurrence
    ON calendar_events(org_id, occurrence_start)
  `);

  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_calendar_audit_org_created
    ON calendar_audit_log(org_id, created_at DESC)
  `);

  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_calendar_audit_idempotency
    ON calendar_audit_log(org_id, idempotency_key, http_method, request_path)
    WHERE idempotency_key IS NOT NULL
  `);
}

async function upsertSeries(sql: postgres.Sql, rows: CalendarSeriesRow[]) {
  for (const row of rows) {
    await sql`
      INSERT INTO calendar_event_series (
        id,
        org_id,
        title,
        group_name,
        location,
        description_html,
        event_color,
        text_color,
        all_day,
        starts_at,
        ends_at,
        timezone,
        recurrence_rule,
        recurrence_until,
        integration_source,
        integration_key,
        created_by,
        created_at,
        updated_at,
        deleted_at
      ) VALUES (
        ${row.id}::uuid,
        ${row.org_id},
        ${row.title},
        ${row.group_name},
        ${row.location},
        ${row.description_html},
        ${row.event_color},
        ${row.text_color},
        ${row.all_day},
        ${row.starts_at}::timestamptz,
        ${row.ends_at}::timestamptz,
        ${row.timezone},
        ${row.recurrence_rule},
        ${row.recurrence_until}::timestamptz,
        ${row.integration_source},
        ${row.integration_key},
        ${row.created_by}::uuid,
        ${row.created_at}::timestamptz,
        ${row.updated_at}::timestamptz,
        ${row.deleted_at}::timestamptz
      )
      ON CONFLICT (id) DO UPDATE SET
        org_id = EXCLUDED.org_id,
        title = EXCLUDED.title,
        group_name = EXCLUDED.group_name,
        location = EXCLUDED.location,
        description_html = EXCLUDED.description_html,
        event_color = EXCLUDED.event_color,
        text_color = EXCLUDED.text_color,
        all_day = EXCLUDED.all_day,
        starts_at = EXCLUDED.starts_at,
        ends_at = EXCLUDED.ends_at,
        timezone = EXCLUDED.timezone,
        recurrence_rule = EXCLUDED.recurrence_rule,
        recurrence_until = EXCLUDED.recurrence_until,
        integration_source = EXCLUDED.integration_source,
        integration_key = EXCLUDED.integration_key,
        created_by = EXCLUDED.created_by,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at,
        deleted_at = EXCLUDED.deleted_at
    `;
  }
}

async function upsertEvents(sql: postgres.Sql, rows: CalendarEventRow[]) {
  for (const row of rows) {
    await sql`
      INSERT INTO calendar_events (
        id,
        org_id,
        series_id,
        occurrence_start,
        occurrence_end,
        title_override,
        location_override,
        description_html_override,
        all_day_override,
        status,
        created_at,
        updated_at
      ) VALUES (
        ${row.id}::uuid,
        ${row.org_id},
        ${row.series_id}::uuid,
        ${row.occurrence_start}::timestamptz,
        ${row.occurrence_end}::timestamptz,
        ${row.title_override},
        ${row.location_override},
        ${row.description_html_override},
        ${row.all_day_override},
        ${row.status},
        ${row.created_at}::timestamptz,
        ${row.updated_at}::timestamptz
      )
      ON CONFLICT (id) DO UPDATE SET
        org_id = EXCLUDED.org_id,
        series_id = EXCLUDED.series_id,
        occurrence_start = EXCLUDED.occurrence_start,
        occurrence_end = EXCLUDED.occurrence_end,
        title_override = EXCLUDED.title_override,
        location_override = EXCLUDED.location_override,
        description_html_override = EXCLUDED.description_html_override,
        all_day_override = EXCLUDED.all_day_override,
        status = EXCLUDED.status,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at
    `;
  }
}

async function upsertAuditLog(sql: postgres.Sql, rows: CalendarAuditRow[]) {
  for (const row of rows) {
    await sql`
      INSERT INTO calendar_audit_log (
        id,
        org_id,
        event_type,
        entity_type,
        entity_id,
        payload,
        idempotency_key,
        request_path,
        http_method,
        response_status,
        response_payload,
        webhook_status,
        created_at
      ) VALUES (
        ${row.id}::uuid,
        ${row.org_id},
        ${row.event_type},
        ${row.entity_type},
        ${row.entity_id}::uuid,
        ${JSON.stringify(row.payload ?? {})}::jsonb,
        ${row.idempotency_key},
        ${row.request_path},
        ${row.http_method},
        ${row.response_status},
        ${JSON.stringify(row.response_payload ?? null)}::jsonb,
        ${row.webhook_status},
        ${row.created_at}::timestamptz
      )
      ON CONFLICT (id) DO UPDATE SET
        org_id = EXCLUDED.org_id,
        event_type = EXCLUDED.event_type,
        entity_type = EXCLUDED.entity_type,
        entity_id = EXCLUDED.entity_id,
        payload = EXCLUDED.payload,
        idempotency_key = EXCLUDED.idempotency_key,
        request_path = EXCLUDED.request_path,
        http_method = EXCLUDED.http_method,
        response_status = EXCLUDED.response_status,
        response_payload = EXCLUDED.response_payload,
        webhook_status = EXCLUDED.webhook_status,
        created_at = EXCLUDED.created_at
    `;
  }
}

export async function transferCalendarDataFromSource(
  options: CalendarTransferOptions = {},
): Promise<CalendarTransferResult> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is required.");
  }

  const sourceBaseUrl = truncateTrailingSlash(
    options.sourceBaseUrl || process.env.CALENDAR_SOURCE_BASE_URL || DEFAULT_SOURCE_BASE_URL,
  );
  const sourceOrgId = options.sourceOrgId || process.env.CALENDAR_SOURCE_ORG_ID || DEFAULT_SOURCE_ORG_ID;
  const timeoutMs = getTimeoutMs(
    options.timeoutMs ?? Number(process.env.CALENDAR_SOURCE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
  );
  const mode: CalendarTransferMode = options.mode || "merge";

  const bundle = await fetchCalendarBundle({
    baseUrl: sourceBaseUrl,
    timeoutMs,
  });

  const filteredSeries = (bundle.eventSeries || []).filter((row) => row.org_id === sourceOrgId);
  const filteredEvents = (bundle.events || []).filter((row) => row.org_id === sourceOrgId);
  const filteredAudit = (bundle.auditLog || []).filter((row) => row.org_id === sourceOrgId);

  const targetSql = postgres(process.env.DATABASE_URL, {
    ssl: "require",
    prepare: false,
    max: 1,
    connect_timeout: 12,
  });

  try {
    await ensureCalendarTables(targetSql);

    await targetSql.begin(async (tx) => {
      if (mode === "replace") {
        await tx`DELETE FROM calendar_audit_log WHERE org_id = ${sourceOrgId}`;
        await tx`DELETE FROM calendar_events WHERE org_id = ${sourceOrgId}`;
        await tx`DELETE FROM calendar_event_series WHERE org_id = ${sourceOrgId}`;
      }

      await upsertSeries(tx, filteredSeries);
      await upsertEvents(tx, filteredEvents);
      if (filteredAudit.length > 0) {
        await upsertAuditLog(tx, filteredAudit);
      }
    });
  } finally {
    await targetSql.end({ timeout: 5 });
  }

  return {
    sourceBaseUrl,
    mode,
    orgId: sourceOrgId,
    exportedAt: bundle.exportedAt,
    importedSeries: filteredSeries.length,
    importedEvents: filteredEvents.length,
    importedAuditLog: filteredAudit.length,
  };
}

async function runFromCli() {
  const modeArg = process.argv.find((arg) => arg === "--replace");
  const mode: CalendarTransferMode = modeArg ? "replace" : "merge";
  const result = await transferCalendarDataFromSource({ mode });
  console.log(JSON.stringify({ success: true, ...result }, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runFromCli().catch((error) => {
    console.error("Calendar transfer failed:", error);
    process.exit(1);
  });
}
