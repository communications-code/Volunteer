import { randomUUID } from "crypto";

import { fromZonedTime, toZonedTime } from "date-fns-tz";
import rrulePkg from "rrule";
import { z } from "zod";

import {
  getCalendarOrgId,
  type CalendarEventRow,
  type CalendarEventSeriesRow,
  type RecurrencePattern,
} from "./calendar-native";
import { queryClient } from "./db";

const { RRule } = rrulePkg;

type WeekdayCode = "SU" | "MO" | "TU" | "WE" | "TH" | "FR" | "SA";

const DEFAULT_TIMEZONE = "America/New_York";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CalendarIdempotentReplay = {
  status: number;
  payload: unknown;
};

type CalendarAuditLogInput = {
  orgId: string;
  eventType: string;
  entityType?: string | null;
  entityId?: string | null;
  payload?: unknown;
  idempotencyKey?: string | null;
  requestPath?: string | null;
  httpMethod?: string | null;
  responseStatus?: number | null;
  responsePayload?: unknown;
  webhookStatus?: string | null;
};

type CalendarSeriesMutationInput = {
  title: string;
  group_name?: string | null;
  location?: string | null;
  description_html: string;
  event_color: string;
  text_color: string;
  all_day: boolean;
  starts_at: string;
  ends_at: string;
  timezone: string;
  recurrence_rule?: string | null;
  recurrence_until?: string | null;
};

const weekdaySchema = z.enum(["SU", "MO", "TU", "WE", "TH", "FR", "SA"]);

const recurrencePatternSchema = z
  .object({
    kind: z.enum(["none", "daily", "weekly", "monthly_day", "monthly_nth_weekday"]),
    interval: z.coerce.number().int().min(1).max(12).optional(),
    weekdays: z.array(weekdaySchema).optional(),
    nth: z.coerce.number().int().min(-1).max(5).optional(),
    weekday: weekdaySchema.optional(),
    until: z.string().datetime().nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "weekly" && (!value.weekdays || value.weekdays.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Weekly recurrence requires at least one weekday",
        path: ["weekdays"],
      });
    }

    if (value.kind === "monthly_nth_weekday") {
      if (!value.weekday) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Monthly nth weekday recurrence requires weekday",
          path: ["weekday"],
        });
      }

      if (!value.nth || value.nth === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Monthly nth weekday recurrence requires nth value",
          path: ["nth"],
        });
      }
    }
  });

export const calendarEventInputSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    groupName: z.preprocess(
      (value) => {
        if (typeof value !== "string") return value;
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
      },
      z.string().max(80).nullable().optional(),
    ),
    location: z.string().trim().max(255).nullable().optional(),
    descriptionHtml: z.string().max(15000).default(""),
    eventColor: z
      .string()
      .regex(/^#([A-Fa-f0-9]{6})$/, "Event color must be a 6-digit hex color")
      .default("#2563eb"),
    textColor: z
      .string()
      .regex(/^#([A-Fa-f0-9]{6})$/, "Text color must be a 6-digit hex color")
      .default("#ffffff"),
    allDay: z.boolean().default(false),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    timezone: z.string().default(DEFAULT_TIMEZONE),
    recurrencePattern: recurrencePatternSchema.nullable().optional(),
    recurrenceRule: z.string().nullable().optional(),
    recurrenceUntil: z.string().datetime().nullable().optional(),
  })
  .superRefine((value, ctx) => {
    const start = new Date(value.startsAt);
    const end = new Date(value.endsAt);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid start/end date",
      });
      return;
    }

    if (end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date/time must be after start date/time",
        path: ["endsAt"],
      });
    }
  });

export const calendarOccurrenceCancelSchema = z
  .object({
    seriesId: z.string().uuid(),
    occurrenceStart: z.string().datetime(),
    occurrenceEnd: z.string().datetime().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.occurrenceEnd) return;

    const start = new Date(value.occurrenceStart);
    const end = new Date(value.occurrenceEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid occurrence start/end date",
      });
      return;
    }

    if (end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Occurrence end must be after occurrence start",
        path: ["occurrenceEnd"],
      });
    }
  });

export const calendarOccurrenceMoveSchema = z
  .object({
    seriesId: z.string().uuid(),
    occurrenceStart: z.string().datetime(),
    occurrenceEnd: z.string().datetime().optional(),
    newOccurrenceStart: z.string().datetime(),
    newOccurrenceEnd: z.string().datetime(),
  })
  .superRefine((value, ctx) => {
    const originalStart = new Date(value.occurrenceStart);
    const originalEnd = value.occurrenceEnd ? new Date(value.occurrenceEnd) : null;
    const newStart = new Date(value.newOccurrenceStart);
    const newEnd = new Date(value.newOccurrenceEnd);

    if (
      Number.isNaN(originalStart.getTime()) ||
      (originalEnd && Number.isNaN(originalEnd.getTime())) ||
      Number.isNaN(newStart.getTime()) ||
      Number.isNaN(newEnd.getTime())
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid occurrence dates",
      });
      return;
    }

    if (originalEnd && originalEnd <= originalStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Occurrence end must be after occurrence start",
        path: ["occurrenceEnd"],
      });
    }

    if (newEnd <= newStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "New occurrence end must be after new occurrence start",
        path: ["newOccurrenceEnd"],
      });
    }
  });

const codeToRRuleWeekday: Record<WeekdayCode, rrulePkg.Weekday> = {
  SU: RRule.SU,
  MO: RRule.MO,
  TU: RRule.TU,
  WE: RRule.WE,
  TH: RRule.TH,
  FR: RRule.FR,
  SA: RRule.SA,
};

const rruleDayToCode: Record<number, WeekdayCode> = {
  0: "MO",
  1: "TU",
  2: "WE",
  3: "TH",
  4: "FR",
  5: "SA",
  6: "SU",
};

const jsDayToWeekdayCode: WeekdayCode[] = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

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
    org_id: String(input.org_id ?? getCalendarOrgId()),
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
    org_id: String(input.org_id ?? getCalendarOrgId()),
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

  let parsed: ReturnType<typeof rrulePkg.rrulestr>;
  try {
    parsed = rrulePkg.rrulestr(rule, { forceset: false });
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

function buildRecurrenceRuleFromPattern(params: {
  startsAt: string;
  timezone?: string;
  pattern?: RecurrencePattern | null;
}): { rule: string | null; recurrenceUntil: string | null } {
  const { startsAt, timezone = DEFAULT_TIMEZONE, pattern } = params;

  if (!pattern || pattern.kind === "none") {
    return {
      rule: null,
      recurrenceUntil: pattern?.until ?? null,
    };
  }

  const startDate = new Date(startsAt);
  const zonedStart = toZonedTime(startDate, timezone);
  const localRuleStart = new Date(
    Date.UTC(
      zonedStart.getFullYear(),
      zonedStart.getMonth(),
      zonedStart.getDate(),
      zonedStart.getHours(),
      zonedStart.getMinutes(),
      zonedStart.getSeconds(),
    ),
  );

  const options: ConstructorParameters<typeof RRule>[0] = {
    dtstart: localRuleStart,
    interval: pattern.interval ?? 1,
  };

  if (pattern.until) {
    const zonedUntil = toZonedTime(new Date(pattern.until), timezone);
    options.until = new Date(
      Date.UTC(
        zonedUntil.getFullYear(),
        zonedUntil.getMonth(),
        zonedUntil.getDate(),
        zonedUntil.getHours(),
        zonedUntil.getMinutes(),
        zonedUntil.getSeconds(),
      ),
    );
  }

  switch (pattern.kind) {
    case "daily":
      options.freq = RRule.DAILY;
      break;
    case "weekly":
      options.freq = RRule.WEEKLY;
      options.byweekday = (pattern.weekdays ?? [jsDayToWeekdayCode[zonedStart.getDay()]]).map(
        (weekday) => codeToRRuleWeekday[weekday],
      );
      break;
    case "monthly_day":
      options.freq = RRule.MONTHLY;
      options.bymonthday = [zonedStart.getDate()];
      break;
    case "monthly_nth_weekday":
      options.freq = RRule.MONTHLY;
      options.bysetpos = [pattern.nth ?? 1];
      options.byweekday = [
        codeToRRuleWeekday[pattern.weekday ?? jsDayToWeekdayCode[zonedStart.getDay()]],
      ];
      break;
    default:
      return { rule: null, recurrenceUntil: pattern.until ?? null };
  }

  const rule = new RRule(options);
  return {
    rule: rule.toString(),
    recurrenceUntil: pattern.until ?? null,
  };
}

function normalizeDescriptionHtml(value: string): string {
  return (value || "").trim();
}

function toUuidOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return UUID_PATTERN.test(value) ? value : null;
}

export function getCalendarAdminErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return "Unexpected error";
}

async function findSeriesById(id: string, orgId = getCalendarOrgId()): Promise<CalendarEventSeriesRow | null> {
  const rows = await queryClient<Record<string, unknown>[]>`
    SELECT *
    FROM calendar_event_series
    WHERE id = ${id}::uuid
      AND org_id = ${orgId}
      AND deleted_at IS NULL
    LIMIT 1
  `;

  if (rows.length === 0) {
    return null;
  }

  return normalizeSeriesRow(rows[0]);
}

export async function getCalendarIdempotentReplay(params: {
  orgId: string;
  key?: string | null;
  method: string;
  path: string;
}): Promise<CalendarIdempotentReplay | null> {
  if (!params.key) {
    return null;
  }

  const rows = await queryClient<Record<string, unknown>[]>`
    SELECT response_status, response_payload
    FROM calendar_audit_log
    WHERE org_id = ${params.orgId}
      AND idempotency_key = ${params.key}
      AND http_method = ${params.method}
      AND request_path = ${params.path}
      AND event_type = 'idempotency.response'
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (rows.length === 0) {
    return null;
  }

  return {
    status: Number(rows[0].response_status ?? 200),
    payload: rows[0].response_payload ?? {},
  };
}

export async function storeCalendarIdempotentReplay(params: {
  orgId: string;
  key?: string | null;
  method: string;
  path: string;
  status: number;
  payload: unknown;
}): Promise<void> {
  if (!params.key) {
    return;
  }

  await appendCalendarAuditLog({
    orgId: params.orgId,
    eventType: "idempotency.response",
    payload: {},
    idempotencyKey: params.key,
    requestPath: params.path,
    httpMethod: params.method,
    responseStatus: params.status,
    responsePayload: params.payload,
  });
}

export async function appendCalendarAuditLog(input: CalendarAuditLogInput): Promise<void> {
  await queryClient`
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
      webhook_status
    ) VALUES (
      ${randomUUID()}::uuid,
      ${input.orgId},
      ${input.eventType},
      ${input.entityType ?? null},
      ${input.entityId ?? null}::uuid,
      ${JSON.stringify(input.payload ?? {})}::jsonb,
      ${input.idempotencyKey ?? null},
      ${input.requestPath ?? null},
      ${input.httpMethod ?? null},
      ${input.responseStatus ?? null},
      ${input.responsePayload === undefined ? null : JSON.stringify(input.responsePayload)}::jsonb,
      ${input.webhookStatus ?? null}
    )
  `;
}

export async function createNativeCalendarSeries(params: {
  orgId?: string;
  createdBy?: unknown;
  input: z.infer<typeof calendarEventInputSchema>;
}) {
  const orgId = params.orgId || getCalendarOrgId();
  const recurrenceFromPattern = buildRecurrenceRuleFromPattern({
    startsAt: params.input.startsAt,
    timezone: params.input.timezone,
    pattern: params.input.recurrencePattern,
  });

  const payload: CalendarSeriesMutationInput = {
    title: params.input.title,
    group_name: params.input.groupName ?? null,
    location: params.input.location ?? null,
    description_html: normalizeDescriptionHtml(params.input.descriptionHtml),
    event_color: params.input.eventColor,
    text_color: params.input.textColor,
    all_day: params.input.allDay,
    starts_at: params.input.startsAt,
    ends_at: params.input.endsAt,
    timezone: params.input.timezone,
    recurrence_rule: params.input.recurrencePattern
      ? recurrenceFromPattern.rule
      : (params.input.recurrenceRule ?? null),
    recurrence_until: params.input.recurrencePattern
      ? recurrenceFromPattern.recurrenceUntil
      : (params.input.recurrenceUntil ?? null),
  };

  const rows = await queryClient<Record<string, unknown>[]>`
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
      created_by
    ) VALUES (
      ${randomUUID()}::uuid,
      ${orgId},
      ${payload.title},
      ${payload.group_name ?? null},
      ${payload.location ?? null},
      ${payload.description_html},
      ${payload.event_color},
      ${payload.text_color},
      ${payload.all_day},
      ${payload.starts_at}::timestamptz,
      ${payload.ends_at}::timestamptz,
      ${payload.timezone},
      ${payload.recurrence_rule ?? null},
      ${payload.recurrence_until ?? null}::timestamptz,
      ${toUuidOrNull(params.createdBy)}::uuid
    )
    RETURNING *
  `;

  const created = normalizeSeriesRow(rows[0]);
  return {
    eventSeries: {
      ...created,
      recurrencePattern: deriveRecurrencePatternFromRule(
        created.recurrence_rule,
        created.starts_at,
        created.timezone,
      ),
    },
  };
}

export async function updateNativeCalendarSeries(params: {
  id: string;
  orgId?: string;
  input: z.infer<typeof calendarEventInputSchema>;
}) {
  const orgId = params.orgId || getCalendarOrgId();
  const recurrenceFromPattern = buildRecurrenceRuleFromPattern({
    startsAt: params.input.startsAt,
    timezone: params.input.timezone,
    pattern: params.input.recurrencePattern,
  });

  const rows = await queryClient<Record<string, unknown>[]>`
    UPDATE calendar_event_series
    SET
      title = ${params.input.title},
      group_name = ${params.input.groupName ?? null},
      location = ${params.input.location ?? null},
      description_html = ${normalizeDescriptionHtml(params.input.descriptionHtml)},
      event_color = ${params.input.eventColor},
      text_color = ${params.input.textColor},
      all_day = ${params.input.allDay},
      starts_at = ${params.input.startsAt}::timestamptz,
      ends_at = ${params.input.endsAt}::timestamptz,
      timezone = ${params.input.timezone},
      recurrence_rule = ${
        params.input.recurrencePattern
          ? recurrenceFromPattern.rule
          : (params.input.recurrenceRule ?? null)
      },
      recurrence_until = ${
        params.input.recurrencePattern
          ? recurrenceFromPattern.recurrenceUntil
          : (params.input.recurrenceUntil ?? null)
      }::timestamptz,
      updated_at = now()
    WHERE id = ${params.id}::uuid
      AND org_id = ${orgId}
      AND deleted_at IS NULL
    RETURNING *
  `;

  if (rows.length === 0) {
    return null;
  }

  const updated = normalizeSeriesRow(rows[0]);
  return {
    eventSeries: {
      ...updated,
      recurrencePattern: deriveRecurrencePatternFromRule(
        updated.recurrence_rule,
        updated.starts_at,
        updated.timezone,
      ),
    },
  };
}

export async function deleteNativeCalendarSeries(params: {
  id: string;
  orgId?: string;
}) {
  const orgId = params.orgId || getCalendarOrgId();

  await queryClient`
    UPDATE calendar_event_series
    SET deleted_at = now(), updated_at = now()
    WHERE id = ${params.id}::uuid
      AND org_id = ${orgId}
      AND deleted_at IS NULL
  `;

  return {
    success: true,
    deletedId: params.id,
  };
}

function toCanonicalIso(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid occurrence date");
  }

  return parsed.toISOString();
}

export async function cancelNativeCalendarOccurrence(params: {
  orgId?: string;
  input: z.infer<typeof calendarOccurrenceCancelSchema>;
}) {
  const orgId = params.orgId || getCalendarOrgId();
  const series = await findSeriesById(params.input.seriesId, orgId);
  if (!series) {
    return null;
  }

  const canonicalOccurrenceStart = toCanonicalIso(params.input.occurrenceStart);
  const occurrenceStartDate = new Date(canonicalOccurrenceStart);
  const seriesDuration = Math.max(
    60 * 1000,
    new Date(series.ends_at).getTime() - new Date(series.starts_at).getTime(),
  );
  const canonicalOccurrenceEnd = params.input.occurrenceEnd
    ? toCanonicalIso(params.input.occurrenceEnd)
    : new Date(occurrenceStartDate.getTime() + seriesDuration).toISOString();

  const existingRows = await queryClient<Record<string, unknown>[]>`
    SELECT id
    FROM calendar_events
    WHERE org_id = ${orgId}
      AND series_id = ${params.input.seriesId}::uuid
      AND occurrence_start = ${canonicalOccurrenceStart}::timestamptz
    ORDER BY created_at DESC
    LIMIT 1
  `;

  let eventRow: CalendarEventRow;
  if (existingRows.length > 0 && typeof existingRows[0].id === "string") {
    const updatedRows = await queryClient<Record<string, unknown>[]>`
      UPDATE calendar_events
      SET
        status = 'CANCELLED',
        occurrence_end = ${canonicalOccurrenceEnd}::timestamptz,
        updated_at = now()
      WHERE id = ${existingRows[0].id}::uuid
      RETURNING *
    `;

    eventRow = normalizeEventRow(updatedRows[0]);
  } else {
    const insertedRows = await queryClient<Record<string, unknown>[]>`
      INSERT INTO calendar_events (
        id,
        org_id,
        series_id,
        occurrence_start,
        occurrence_end,
        status
      ) VALUES (
        ${randomUUID()}::uuid,
        ${orgId},
        ${params.input.seriesId}::uuid,
        ${canonicalOccurrenceStart}::timestamptz,
        ${canonicalOccurrenceEnd}::timestamptz,
        'CANCELLED'
      )
      RETURNING *
    `;

    eventRow = normalizeEventRow(insertedRows[0]);
  }

  return {
    occurrence: {
      id: eventRow.id,
      seriesId: eventRow.series_id,
      occurrenceStart: eventRow.occurrence_start,
      occurrenceEnd: eventRow.occurrence_end,
      status: eventRow.status,
    },
  };
}

async function upsertActiveCalendarOccurrence(params: {
  orgId: string;
  seriesId: string;
  occurrenceStart: string;
  occurrenceEnd: string;
}): Promise<CalendarEventRow> {
  const existingRows = await queryClient<Record<string, unknown>[]>`
    SELECT id
    FROM calendar_events
    WHERE org_id = ${params.orgId}
      AND series_id = ${params.seriesId}::uuid
      AND occurrence_start = ${params.occurrenceStart}::timestamptz
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (existingRows.length > 0 && typeof existingRows[0].id === "string") {
    const updatedRows = await queryClient<Record<string, unknown>[]>`
      UPDATE calendar_events
      SET
        status = 'ACTIVE',
        occurrence_end = ${params.occurrenceEnd}::timestamptz,
        updated_at = now()
      WHERE id = ${existingRows[0].id}::uuid
      RETURNING *
    `;

    return normalizeEventRow(updatedRows[0]);
  }

  const insertedRows = await queryClient<Record<string, unknown>[]>`
    INSERT INTO calendar_events (
      id,
      org_id,
      series_id,
      occurrence_start,
      occurrence_end,
      status
    ) VALUES (
      ${randomUUID()}::uuid,
      ${params.orgId},
      ${params.seriesId}::uuid,
      ${params.occurrenceStart}::timestamptz,
      ${params.occurrenceEnd}::timestamptz,
      'ACTIVE'
    )
    RETURNING *
  `;

  return normalizeEventRow(insertedRows[0]);
}

export async function moveNativeCalendarOccurrence(params: {
  orgId?: string;
  input: z.infer<typeof calendarOccurrenceMoveSchema>;
}) {
  const orgId = params.orgId || getCalendarOrgId();
  const series = await findSeriesById(params.input.seriesId, orgId);
  if (!series) {
    return null;
  }

  const canonicalOccurrenceStart = toCanonicalIso(params.input.occurrenceStart);
  const canonicalNewOccurrenceStart = toCanonicalIso(params.input.newOccurrenceStart);
  const canonicalNewOccurrenceEnd = toCanonicalIso(params.input.newOccurrenceEnd);

  if (!series.recurrence_rule) {
    const rows = await queryClient<Record<string, unknown>[]>`
      UPDATE calendar_event_series
      SET
        starts_at = ${canonicalNewOccurrenceStart}::timestamptz,
        ends_at = ${canonicalNewOccurrenceEnd}::timestamptz,
        updated_at = now()
      WHERE id = ${series.id}::uuid
        AND org_id = ${orgId}
        AND deleted_at IS NULL
      RETURNING *
    `;

    if (rows.length === 0) {
      return null;
    }

    const updated = normalizeSeriesRow(rows[0]);
    return {
      eventSeries: {
        ...updated,
        recurrencePattern: deriveRecurrencePatternFromRule(
          updated.recurrence_rule,
          updated.starts_at,
          updated.timezone,
        ),
      },
    };
  }

  const occurrenceStartDate = new Date(canonicalOccurrenceStart);
  const seriesDuration = Math.max(
    60 * 1000,
    new Date(series.ends_at).getTime() - new Date(series.starts_at).getTime(),
  );
  const originalOccurrenceEnd = params.input.occurrenceEnd
    ? toCanonicalIso(params.input.occurrenceEnd)
    : new Date(occurrenceStartDate.getTime() + seriesDuration).toISOString();

  const cancelledPayload = await cancelNativeCalendarOccurrence({
    orgId,
    input: {
      seriesId: params.input.seriesId,
      occurrenceStart: canonicalOccurrenceStart,
      occurrenceEnd: originalOccurrenceEnd,
    },
  });
  const moved = await upsertActiveCalendarOccurrence({
    orgId,
    seriesId: params.input.seriesId,
    occurrenceStart: canonicalNewOccurrenceStart,
    occurrenceEnd: canonicalNewOccurrenceEnd,
  });

  return {
    occurrence: {
      id: moved.id,
      seriesId: moved.series_id,
      occurrenceStart: moved.occurrence_start,
      occurrenceEnd: moved.occurrence_end,
      status: moved.status,
    },
    cancelledOccurrence: cancelledPayload?.occurrence ?? null,
  };
}
