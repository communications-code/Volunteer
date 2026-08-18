import { fromZonedTime, toZonedTime } from "date-fns-tz";
import rrulePkg from "rrule";

import { queryClient } from "./db";

const { RRule, rrulestr } = rrulePkg;

const DEFAULT_CALENDAR_ORG_ID = "vfw";
const DEFAULT_TIMEZONE = "America/New_York";

type WeekdayCode = "SU" | "MO" | "TU" | "WE" | "TH" | "FR" | "SA";
type RecurrenceKind = "none" | "daily" | "weekly" | "monthly_day" | "monthly_nth_weekday";

export interface RecurrencePattern {
  kind: RecurrenceKind;
  interval?: number;
  weekdays?: WeekdayCode[];
  nth?: number;
  weekday?: WeekdayCode;
  until?: string | null;
}

export interface CalendarEventSeriesRow {
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
}

export interface CalendarEventRow {
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
}

export interface CalendarOccurrence {
  id: string;
  seriesId: string;
  orgId: string;
  isRecurring: boolean;
  title: string;
  groupName: string | null;
  integrationSource: string | null;
  integrationKey: string | null;
  location: string | null;
  descriptionHtml: string;
  eventColor: string;
  textColor: string;
  allDay: boolean;
  occurrenceStart: string;
  occurrenceEnd: string;
  timezone: string;
}

export interface CalendarExportBundle {
  version: "1";
  exportedAt: string;
  orgId: string;
  eventSeries: CalendarEventSeriesRow[];
  events: CalendarEventRow[];
}

export type CalendarSeriesModeResponse = {
  eventSeries: Array<CalendarEventSeriesRow & { recurrencePattern: RecurrencePattern }>;
};

export type CalendarOccurrenceModeResponse = {
  range: {
    start: string;
    end: string;
  };
  occurrences: CalendarOccurrence[];
};

export type CalendarPublicEventsResponse = {
  range: {
    start: string;
    end: string;
  };
  events: Array<{
    id: string;
    seriesId: string;
    isRecurring: boolean;
    title: string;
    groupName: string | null;
    integrationSource: string | null;
    integrationKey: string | null;
    location: string | null;
    descriptionHtml: string;
    eventColor: string;
    textColor: string;
    allDay: boolean;
    occurrenceStart: string;
    occurrenceEnd: string;
    timezone: string;
  }>;
};

type CancelledOccurrenceRow = {
  series_id: string | null;
  occurrence_start: string;
};

type ActiveOccurrenceOverrideRow = CalendarEventRow & {
  series: CalendarEventSeriesRow | null;
};

const jsDayToWeekdayCode: WeekdayCode[] = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

const rruleDayToCode: Record<number, WeekdayCode> = {
  0: "MO",
  1: "TU",
  2: "WE",
  3: "TH",
  4: "FR",
  5: "SA",
  6: "SU",
};

function toIsoString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }

  if (typeof value === "number") {
    return new Date(value).toISOString();
  }

  return "";
}

function toNullableIsoString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const iso = toIsoString(value);
  return iso || null;
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "t" || normalized === "1") return true;
    if (normalized === "false" || normalized === "f" || normalized === "0") return false;
  }
  return fallback;
}

function normalizeSeriesRow(input: Record<string, unknown>): CalendarEventSeriesRow {
  return {
    id: String(input.id ?? ""),
    org_id: String(input.org_id ?? DEFAULT_CALENDAR_ORG_ID),
    title: String(input.title ?? ""),
    group_name: typeof input.group_name === "string" ? input.group_name : null,
    location: typeof input.location === "string" ? input.location : null,
    description_html: String(input.description_html ?? ""),
    event_color:
      typeof input.event_color === "string" && input.event_color.trim().length > 0
        ? input.event_color
        : "#2563eb",
    text_color:
      typeof input.text_color === "string" && input.text_color.trim().length > 0
        ? input.text_color
        : "#ffffff",
    all_day: toBoolean(input.all_day, false),
    starts_at: toIsoString(input.starts_at),
    ends_at: toIsoString(input.ends_at),
    timezone:
      typeof input.timezone === "string" && input.timezone.trim().length > 0
        ? input.timezone
        : DEFAULT_TIMEZONE,
    recurrence_rule: typeof input.recurrence_rule === "string" ? input.recurrence_rule : null,
    recurrence_until: toNullableIsoString(input.recurrence_until),
    integration_source:
      typeof input.integration_source === "string" ? input.integration_source : null,
    integration_key: typeof input.integration_key === "string" ? input.integration_key : null,
    created_by: typeof input.created_by === "string" ? input.created_by : null,
    created_at: toIsoString(input.created_at),
    updated_at: toIsoString(input.updated_at),
    deleted_at: toNullableIsoString(input.deleted_at),
  };
}

function normalizeEventRow(input: Record<string, unknown>): CalendarEventRow {
  return {
    id: String(input.id ?? ""),
    org_id: String(input.org_id ?? DEFAULT_CALENDAR_ORG_ID),
    series_id: typeof input.series_id === "string" ? input.series_id : null,
    occurrence_start: toIsoString(input.occurrence_start),
    occurrence_end: toIsoString(input.occurrence_end),
    title_override: typeof input.title_override === "string" ? input.title_override : null,
    location_override: typeof input.location_override === "string" ? input.location_override : null,
    description_html_override:
      typeof input.description_html_override === "string"
        ? input.description_html_override
        : null,
    all_day_override:
      typeof input.all_day_override === "boolean" ? input.all_day_override : null,
    status:
      typeof input.status === "string" && input.status.trim().length > 0
        ? input.status
        : "ACTIVE",
    created_at: toIsoString(input.created_at),
    updated_at: toIsoString(input.updated_at),
  };
}

function normalizeWeekdayArray(byweekday: unknown): WeekdayCode[] {
  if (!byweekday) return [];
  const weekdays = Array.isArray(byweekday) ? byweekday : [byweekday];

  return weekdays
    .map((entry) => {
      if (typeof entry === "number") {
        return rruleDayToCode[entry];
      }

      if (typeof entry === "object" && entry && "weekday" in entry) {
        const day = Number((entry as { weekday: number }).weekday);
        return rruleDayToCode[day];
      }

      return undefined;
    })
    .filter((value): value is WeekdayCode => Boolean(value));
}

function deriveRecurrencePatternFromRule(
  rule: string | null,
  startsAt: string,
  timezone = DEFAULT_TIMEZONE,
): RecurrencePattern {
  if (!rule) {
    return { kind: "none" };
  }

  let parsed: ReturnType<typeof rrulestr>;
  try {
    parsed = rrulestr(rule, { forceset: false });
  } catch {
    return { kind: "none" };
  }

  const options = "origOptions" in parsed ? parsed.origOptions : undefined;
  if (!options || options.freq === undefined) {
    return { kind: "none" };
  }

  const recurrenceUntil = options.until?.toISOString() ?? null;

  if (options.freq === RRule.DAILY) {
    return {
      kind: "daily",
      interval: options.interval ?? 1,
      until: recurrenceUntil,
    };
  }

  if (options.freq === RRule.WEEKLY) {
    return {
      kind: "weekly",
      weekdays: normalizeWeekdayArray(options.byweekday),
      interval: options.interval ?? 1,
      until: recurrenceUntil,
    };
  }

  if (options.freq === RRule.MONTHLY) {
    if (options.bysetpos && options.byweekday) {
      const weekdays = normalizeWeekdayArray(options.byweekday);
      return {
        kind: "monthly_nth_weekday",
        nth: Array.isArray(options.bysetpos) ? options.bysetpos[0] : options.bysetpos,
        weekday: weekdays[0],
        interval: options.interval ?? 1,
        until: recurrenceUntil,
      };
    }

    return {
      kind: "monthly_day",
      interval: options.interval ?? 1,
      until: recurrenceUntil,
    };
  }

  const zonedStart = toZonedTime(new Date(startsAt), timezone);
  return {
    kind: "weekly",
    weekdays: [jsDayToWeekdayCode[zonedStart.getDay()]],
    interval: options.interval ?? 1,
    until: recurrenceUntil,
  };
}

function expandRecurringSeries(
  series: CalendarEventSeriesRow,
  rangeStart: Date,
  rangeEnd: Date,
): CalendarOccurrence[] {
  if (!series.recurrence_rule) {
    return [];
  }

  let parsed: ReturnType<typeof rrulestr>;
  try {
    parsed = rrulestr(series.recurrence_rule, { forceset: false });
  } catch {
    return [];
  }

  const startDate = new Date(series.starts_at);
  const endDate = new Date(series.ends_at);
  const durationMs = Math.max(1, endDate.getTime() - startDate.getTime());
  const timezone = series.timezone || DEFAULT_TIMEZONE;
  const baseLocalStart = toZonedTime(startDate, timezone);
  const occurrences = parsed.between(rangeStart, rangeEnd, true);

  return occurrences.map((occurrenceStart: Date) => {
    const normalizedOccurrenceStart = fromZonedTime(
      `${occurrenceStart.getUTCFullYear()}-${String(occurrenceStart.getUTCMonth() + 1).padStart(2, "0")}-${String(
        occurrenceStart.getUTCDate(),
      ).padStart(2, "0")}T${String(baseLocalStart.getHours()).padStart(2, "0")}:${String(
        baseLocalStart.getMinutes(),
      ).padStart(2, "0")}:${String(baseLocalStart.getSeconds()).padStart(2, "0")}`,
      timezone,
    );
    const occurrenceEnd = new Date(normalizedOccurrenceStart.getTime() + durationMs);

    return {
      id: `${series.id}:${normalizedOccurrenceStart.toISOString()}`,
      seriesId: series.id,
      orgId: series.org_id,
      isRecurring: true,
      title: series.title,
      groupName: series.group_name,
      integrationSource: series.integration_source,
      integrationKey: series.integration_key,
      location: series.location,
      descriptionHtml: series.description_html,
      eventColor: series.event_color || "#2563eb",
      textColor: series.text_color || "#ffffff",
      allDay: series.all_day,
      occurrenceStart: normalizedOccurrenceStart.toISOString(),
      occurrenceEnd: occurrenceEnd.toISOString(),
      timezone: series.timezone,
    };
  });
}

function expandSingleSeries(
  series: CalendarEventSeriesRow,
  rangeStart: Date,
  rangeEnd: Date,
): CalendarOccurrence[] {
  const start = new Date(series.starts_at);
  const end = new Date(series.ends_at);
  const overlaps = start <= rangeEnd && end >= rangeStart;

  if (!overlaps) {
    return [];
  }

  return [
    {
      id: `${series.id}:${series.starts_at}`,
      seriesId: series.id,
      orgId: series.org_id,
      isRecurring: false,
      title: series.title,
      groupName: series.group_name,
      integrationSource: series.integration_source,
      integrationKey: series.integration_key,
      location: series.location,
      descriptionHtml: series.description_html,
      eventColor: series.event_color || "#2563eb",
      textColor: series.text_color || "#ffffff",
      allDay: series.all_day,
      occurrenceStart: series.starts_at,
      occurrenceEnd: series.ends_at,
      timezone: series.timezone,
    },
  ];
}

function expandSeriesForRange(
  rows: CalendarEventSeriesRow[],
  rangeStartIso: string,
  rangeEndIso: string,
): CalendarOccurrence[] {
  const rangeStart = new Date(rangeStartIso);
  const rangeEnd = new Date(rangeEndIso);

  if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
    return [];
  }

  return rows
    .flatMap((series) => {
      if (series.deleted_at) {
        return [];
      }

      return series.recurrence_rule
        ? expandRecurringSeries(series, rangeStart, rangeEnd)
        : expandSingleSeries(series, rangeStart, rangeEnd);
    })
    .sort(
      (a, b) =>
        new Date(a.occurrenceStart).getTime() - new Date(b.occurrenceStart).getTime(),
    );
}

function resolveRangeFromSearchParams(searchParams: URLSearchParams): {
  start: string;
  end: string;
} {
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (start && end) {
    return { start, end };
  }

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 0, 23, 59, 59),
  );

  return {
    start: monthStart.toISOString(),
    end: monthEnd.toISOString(),
  };
}

function buildOccurrenceKey(seriesId: string, occurrenceStart: string): string {
  const parsed = new Date(occurrenceStart);
  const canonicalStart = Number.isNaN(parsed.getTime())
    ? occurrenceStart
    : parsed.toISOString();
  return `${seriesId}:${canonicalStart}`;
}

function mapActiveOverrideToOccurrence(row: ActiveOccurrenceOverrideRow): CalendarOccurrence | null {
  const series = row.series;
  if (!series) {
    return null;
  }

  return {
    id: row.id,
    seriesId: series.id,
    orgId: series.org_id,
    isRecurring: Boolean(series.recurrence_rule),
    title: row.title_override ?? series.title,
    groupName: series.group_name,
    integrationSource: series.integration_source,
    integrationKey: series.integration_key,
    location: row.location_override ?? series.location,
    descriptionHtml: row.description_html_override ?? series.description_html,
    eventColor: series.event_color || "#2563eb",
    textColor: series.text_color || "#ffffff",
    allDay: row.all_day_override ?? series.all_day,
    occurrenceStart: row.occurrence_start,
    occurrenceEnd: row.occurrence_end,
    timezone: series.timezone,
  };
}

async function listSeries(orgId: string): Promise<CalendarEventSeriesRow[]> {
  const rows = await queryClient<Record<string, unknown>[]>`
    SELECT *
    FROM calendar_event_series
    WHERE org_id = ${orgId}
      AND deleted_at IS NULL
    ORDER BY starts_at ASC
  `;

  return rows.map(normalizeSeriesRow);
}

async function listCancelledOccurrences(params: {
  orgId: string;
  start: string;
  end: string;
}): Promise<CancelledOccurrenceRow[]> {
  const rows = await queryClient<Record<string, unknown>[]>`
    SELECT series_id, occurrence_start
    FROM calendar_events
    WHERE org_id = ${params.orgId}
      AND status = 'CANCELLED'
      AND series_id IS NOT NULL
      AND occurrence_start >= ${params.start}::timestamptz
      AND occurrence_start <= ${params.end}::timestamptz
  `;

  return rows.map((row) => ({
    series_id: typeof row.series_id === "string" ? row.series_id : null,
    occurrence_start: toIsoString(row.occurrence_start),
  }));
}

async function listActiveOccurrenceOverrides(params: {
  orgId: string;
  start: string;
  end: string;
}): Promise<ActiveOccurrenceOverrideRow[]> {
  const rows = await queryClient<Record<string, unknown>[]>`
    SELECT
      ce.*,
      row_to_json(s.*) AS series
    FROM calendar_events ce
    INNER JOIN calendar_event_series s
      ON s.id = ce.series_id
      AND s.org_id = ce.org_id
      AND s.deleted_at IS NULL
    WHERE ce.org_id = ${params.orgId}
      AND ce.status = 'ACTIVE'
      AND ce.series_id IS NOT NULL
      AND ce.occurrence_start >= ${params.start}::timestamptz
      AND ce.occurrence_start <= ${params.end}::timestamptz
  `;

  return rows.map((row) => {
    const rawSeries = row.series;
    return {
      ...normalizeEventRow(row),
      series:
        rawSeries && typeof rawSeries === "object"
          ? normalizeSeriesRow(rawSeries as Record<string, unknown>)
          : null,
    };
  });
}

export function getCalendarOrgId(): string {
  const configured = (process.env.CALENDAR_SOURCE_ORG_ID || "").trim();
  return configured || DEFAULT_CALENDAR_ORG_ID;
}

export async function getNativeCalendarExportBundle(
  orgId = getCalendarOrgId(),
): Promise<CalendarExportBundle> {
  const [seriesRows, eventRows] = await Promise.all([
    queryClient<Record<string, unknown>[]>`
      SELECT *
      FROM calendar_event_series
      WHERE org_id = ${orgId}
      ORDER BY created_at ASC
    `,
    queryClient<Record<string, unknown>[]>`
      SELECT *
      FROM calendar_events
      WHERE org_id = ${orgId}
      ORDER BY created_at ASC
    `,
  ]);

  return {
    version: "1",
    exportedAt: new Date().toISOString(),
    orgId,
    eventSeries: seriesRows.map(normalizeSeriesRow),
    events: eventRows.map(normalizeEventRow),
  };
}

export async function getNativeCalendarEventsResponse(params: {
  searchParams: URLSearchParams;
  orgId?: string;
}): Promise<CalendarSeriesModeResponse | CalendarOccurrenceModeResponse> {
  const orgId = params.orgId || getCalendarOrgId();
  const mode = params.searchParams.get("mode");
  const series = await listSeries(orgId);

  if (mode === "series") {
    return {
      eventSeries: series.map((row) => ({
        ...row,
        recurrencePattern: deriveRecurrencePatternFromRule(
          row.recurrence_rule,
          row.starts_at,
          row.timezone,
        ),
      })),
    };
  }

  const { start, end } = resolveRangeFromSearchParams(params.searchParams);
  const [cancelled, activeOverrides] = await Promise.all([
    listCancelledOccurrences({ orgId, start, end }),
    listActiveOccurrenceOverrides({ orgId, start, end }),
  ]);
  const cancelledSet = new Set(
    cancelled
      .filter((row) => Boolean(row.series_id))
      .map((row) => buildOccurrenceKey(row.series_id as string, row.occurrence_start)),
  );
  const activeOverrideSet = new Set(
    activeOverrides
      .filter((row) => Boolean(row.series_id))
      .map((row) => buildOccurrenceKey(row.series_id as string, row.occurrence_start)),
  );

  const generatedOccurrences = expandSeriesForRange(series, start, end).filter(
    (occurrence) =>
      !cancelledSet.has(buildOccurrenceKey(occurrence.seriesId, occurrence.occurrenceStart)) &&
      !activeOverrideSet.has(buildOccurrenceKey(occurrence.seriesId, occurrence.occurrenceStart)),
  );
  const overrideOccurrences = activeOverrides
    .map(mapActiveOverrideToOccurrence)
    .filter((occurrence): occurrence is CalendarOccurrence => Boolean(occurrence));
  const occurrences = [...generatedOccurrences, ...overrideOccurrences].sort(
    (a, b) => new Date(a.occurrenceStart).getTime() - new Date(b.occurrenceStart).getTime(),
  );

  return {
    range: { start, end },
    occurrences,
  };
}

export async function getNativePublicCalendarEventsResponse(
  searchParams: URLSearchParams,
): Promise<CalendarPublicEventsResponse> {
  const orgId = getCalendarOrgId();
  const { start, end } = resolveRangeFromSearchParams(searchParams);

  const series = await listSeries(orgId);
  const [cancelled, activeOverrides] = await Promise.all([
    listCancelledOccurrences({
      orgId,
      start,
      end,
    }),
    listActiveOccurrenceOverrides({
      orgId,
      start,
      end,
    }),
  ]);
  const cancelledSet = new Set(
    cancelled
      .filter((row) => Boolean(row.series_id))
      .map((row) => buildOccurrenceKey(row.series_id as string, row.occurrence_start)),
  );
  const activeOverrideSet = new Set(
    activeOverrides
      .filter((row) => Boolean(row.series_id))
      .map((row) => buildOccurrenceKey(row.series_id as string, row.occurrence_start)),
  );

  const generatedEvents = expandSeriesForRange(series, start, end)
    .filter((occurrence) => {
      const key = buildOccurrenceKey(occurrence.seriesId, occurrence.occurrenceStart);
      return !cancelledSet.has(key) && !activeOverrideSet.has(key);
    })
    .map((occurrence) => ({
      id: occurrence.id,
      seriesId: occurrence.seriesId,
      isRecurring: occurrence.isRecurring,
      title: occurrence.title,
      groupName: occurrence.groupName,
      integrationSource: occurrence.integrationSource,
      integrationKey: occurrence.integrationKey,
      location: occurrence.location,
      descriptionHtml: occurrence.descriptionHtml,
      eventColor: occurrence.eventColor,
      textColor: occurrence.textColor,
      allDay: occurrence.allDay,
      occurrenceStart: occurrence.occurrenceStart,
      occurrenceEnd: occurrence.occurrenceEnd,
      timezone: occurrence.timezone,
    }));
  const overrideEvents = activeOverrides
    .map(mapActiveOverrideToOccurrence)
    .filter((occurrence): occurrence is CalendarOccurrence => Boolean(occurrence))
    .map((occurrence) => ({
      id: occurrence.id,
      seriesId: occurrence.seriesId,
      isRecurring: occurrence.isRecurring,
      title: occurrence.title,
      groupName: occurrence.groupName,
      integrationSource: occurrence.integrationSource,
      integrationKey: occurrence.integrationKey,
      location: occurrence.location,
      descriptionHtml: occurrence.descriptionHtml,
      eventColor: occurrence.eventColor,
      textColor: occurrence.textColor,
      allDay: occurrence.allDay,
      occurrenceStart: occurrence.occurrenceStart,
      occurrenceEnd: occurrence.occurrenceEnd,
      timezone: occurrence.timezone,
    }));
  const events = [...generatedEvents, ...overrideEvents].sort(
    (a, b) => new Date(a.occurrenceStart).getTime() - new Date(b.occurrenceStart).getTime(),
  );

  return {
    range: { start, end },
    events,
  };
}
