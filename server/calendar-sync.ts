import { createHash, randomUUID } from "crypto";
import { fromZonedTime } from "date-fns-tz";
import { and, asc, eq, lte } from "drizzle-orm";

import { db, queryClient } from "./db";
import {
  NeedStatus,
  NeedType,
  calendarSyncQueue,
  eventRoles,
  type Need,
} from "@shared/schema";

const CALENDAR_SYNC_SOURCE = "servingnetwork";
const CALENDAR_SYNC_ORG_ID = "clh";
const DEFAULT_TIMEZONE = "America/New_York";
const MAX_ERROR_LENGTH = 1200;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SERVE_SATURDAY_COLOR = "#b91c1c";
const DEFAULT_EVENT_COLOR = "#2563eb";
const DEFAULT_EVENT_TEXT_COLOR = "#ffffff";

export type CalendarSyncAction = "UPSERT" | "DELETE";

export type CalendarSyncNeedRolePayload = {
  id: number;
  name: string;
  slotDate: string | null;
  startTime: string;
  endTime: string;
  capacity: number | null;
  displayOrder: number;
  isActive: boolean;
};

export type CalendarSyncNeedPayload = {
  id: number;
  title: string;
  category: string;
  descriptionHtml: string;
  eventStartDate: string | null;
  eventEndDate: string | null;
  eventDate: string | null;
  eventStartTime: string | null;
  eventEndTime: string | null;
  eventStartDateTime: string | null;
  eventEndDateTime: string | null;
  eventLocation: string | null;
  status: string;
  timezone: string;
  signupUrl: string;
  eventRoles: CalendarSyncNeedRolePayload[];
};

export type CalendarSyncWebhookPayload = {
  source: typeof CALENDAR_SYNC_SOURCE;
  action: CalendarSyncAction;
  orgId: typeof CALENDAR_SYNC_ORG_ID;
  need: CalendarSyncNeedPayload;
};

type CalendarSyncQueueRow = typeof calendarSyncQueue.$inferSelect;

type ExistingCalendarSeries = {
  id: string;
  deletedAt: string | null;
  eventColor: string | null;
  textColor: string | null;
};

export type CalendarSyncProcessResult = {
  processed: number;
  succeeded: number;
  failed: number;
};

function isSyncEnabled(): boolean {
  const raw = (process.env.CALENDAR_SYNC_ENABLED || "").trim().toLowerCase();
  if (!raw) return true;
  return raw === "true" || raw === "1" || raw === "yes";
}

function truncateError(message: string): string {
  if (message.length <= MAX_ERROR_LENGTH) return message;
  return `${message.slice(0, MAX_ERROR_LENGTH - 3)}...`;
}

function toSyncErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown sync error";
}

function toSignupUrl(needId: number): string {
  const publicUrl = process.env.PUBLIC_URL || "https://vfwharrisonoh.org/volunteer/";
  const separator = publicUrl.includes("?") ? "&" : "?";
  return `${publicUrl}${separator}need=${needId}`;
}

function normalizeDate(rawDate?: string | null): string | null {
  const trimmed = rawDate?.trim();
  if (!trimmed) return null;
  return DATE_PATTERN.test(trimmed) ? trimmed : null;
}

function normalizeTime(rawTime?: string | null): string | null {
  const trimmed = rawTime?.trim();
  if (!trimmed) return null;
  return TIME_PATTERN.test(trimmed) ? trimmed : null;
}

function buildDateTime(date: string | null, time: string | null): string | null {
  if (!date || !time) return null;
  return `${date}T${time}:00`;
}

function isEligibleEventNeed(need: Pick<Need, "needType" | "status">): boolean {
  return (
    need.needType === NeedType.EVENT &&
    need.status !== NeedStatus.DRAFT &&
    need.status !== NeedStatus.UNFULFILLED
  );
}

function computeIdempotencyKey(action: CalendarSyncAction, needId: number, payload: string): string {
  const hash = createHash("sha256").update(payload).digest("hex");
  return `servingnetwork:need:${needId}:${action}:${hash}`;
}

function buildDeletePayload(needId: number): CalendarSyncWebhookPayload {
  return {
    source: CALENDAR_SYNC_SOURCE,
    action: "DELETE",
    orgId: CALENDAR_SYNC_ORG_ID,
    need: {
      id: needId,
      title: "",
      category: "",
      descriptionHtml: "",
      eventStartDate: null,
      eventEndDate: null,
      eventDate: null,
      eventStartTime: null,
      eventEndTime: null,
      eventStartDateTime: null,
      eventEndDateTime: null,
      eventLocation: null,
      status: NeedStatus.DRAFT,
      timezone: DEFAULT_TIMEZONE,
      signupUrl: toSignupUrl(needId),
      eventRoles: [],
    },
  };
}

function appendSignupLink(descriptionHtml: string, needId: number): string {
  const base = descriptionHtml || "";
  const separator = base.trim().length > 0 ? "\n\n" : "";
  return `${base}${separator}<p><a href="${toSignupUrl(needId)}">Click Here To Sign Up</a></p>`;
}

function normalizeCategoryKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isServeSaturdayCategory(category: string): boolean {
  return normalizeCategoryKey(category) === "servesaturday";
}

function toUtcIsoFromLocal(localDateTime: string, timezone: string): string {
  return fromZonedTime(localDateTime, timezone).toISOString();
}

function parseTimeToMinutes(value: string): number {
  const match = TIME_PATTERN.exec(value);
  if (!match) {
    throw new Error(`Invalid time format "${value}". Expected HH:mm.`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

function addOneDay(date: string): string {
  const [year, month, day] = date.split("-").map((value) => Number(value));
  const base = new Date(Date.UTC(year, month - 1, day));
  base.setUTCDate(base.getUTCDate() + 1);
  const y = base.getUTCFullYear();
  const m = String(base.getUTCMonth() + 1).padStart(2, "0");
  const d = String(base.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function resolveSeriesWindow(need: CalendarSyncNeedPayload): {
  allDay: boolean;
  startsAt: string;
  endsAt: string;
  timezone: string;
} {
  const timezone = need.timezone || DEFAULT_TIMEZONE;
  const eventStartDate = normalizeDate(need.eventStartDate || need.eventDate);
  const eventEndDate = normalizeDate(need.eventEndDate) || eventStartDate;

  if (!eventStartDate) {
    throw new Error("eventStartDate/eventDate is required for calendar sync UPSERT.");
  }

  const startTime = normalizeTime(need.eventStartTime);
  const endTime = normalizeTime(need.eventEndTime);

  if (!startTime && !endTime) {
    return {
      allDay: true,
      startsAt: toUtcIsoFromLocal(`${eventStartDate}T00:00:00`, timezone),
      endsAt: toUtcIsoFromLocal(`${addOneDay(eventEndDate || eventStartDate)}T00:00:00`, timezone),
      timezone,
    };
  }

  if (startTime && endTime) {
    const startsAt = toUtcIsoFromLocal(`${eventStartDate}T${startTime}:00`, timezone);
    const endsAt = toUtcIsoFromLocal(`${eventEndDate || eventStartDate}T${endTime}:00`, timezone);
    if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      throw new Error(
        "Calendar sync requires event end datetime to be after start datetime.",
      );
    }

    return {
      allDay: false,
      startsAt,
      endsAt,
      timezone,
    };
  }

  if (startTime) {
    const start = new Date(toUtcIsoFromLocal(`${eventStartDate}T${startTime}:00`, timezone));
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    return {
      allDay: false,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      timezone,
    };
  }

  const end = new Date(
    toUtcIsoFromLocal(`${eventEndDate || eventStartDate}T${endTime}:00`, timezone),
  );
  const start = new Date(end.getTime() - 60 * 60 * 1000);
  return {
    allDay: false,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    timezone,
  };
}

function parseQueuePayload(rawPayload: string): CalendarSyncWebhookPayload {
  const parsed = JSON.parse(rawPayload) as CalendarSyncWebhookPayload;
  if (
    !parsed ||
    (parsed.action !== "UPSERT" && parsed.action !== "DELETE") ||
    !parsed.need ||
    typeof parsed.need.id !== "number"
  ) {
    throw new Error("Invalid calendar sync queue payload.");
  }
  return parsed;
}

function toNullableIsoString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}

async function findExistingSeries(orgId: string, needId: number): Promise<ExistingCalendarSeries | null> {
  const integrationKey = `need:${needId}`;
  const rows = await queryClient<Record<string, unknown>[]>`
    SELECT id, deleted_at, event_color, text_color
    FROM calendar_event_series
    WHERE org_id = ${orgId}
      AND integration_source = ${CALENDAR_SYNC_SOURCE}
      AND integration_key = ${integrationKey}
    ORDER BY created_at DESC
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    id: String(row.id || ""),
    deletedAt: toNullableIsoString(row.deleted_at),
    eventColor: typeof row.event_color === "string" ? row.event_color : null,
    textColor: typeof row.text_color === "string" ? row.text_color : null,
  };
}

async function applyDeleteToCalendar(orgId: string, needId: number): Promise<void> {
  const existing = await findExistingSeries(orgId, needId);
  if (!existing || existing.deletedAt) return;

  await queryClient`
    UPDATE calendar_event_series
    SET deleted_at = NOW(),
        updated_at = NOW()
    WHERE id = ${existing.id}::uuid
      AND org_id = ${orgId}
  `;
}

async function applyUpsertToCalendar(payload: CalendarSyncWebhookPayload): Promise<void> {
  const orgId = payload.orgId || CALENDAR_SYNC_ORG_ID;
  const need = payload.need;
  const existing = await findExistingSeries(orgId, need.id);
  const category = (need.category || "").trim();
  const seriesWindow = resolveSeriesWindow(need);
  const integrationKey = `need:${need.id}`;

  const resolvedEventColor = isServeSaturdayCategory(category)
    ? SERVE_SATURDAY_COLOR
    : existing?.eventColor || DEFAULT_EVENT_COLOR;
  const resolvedTextColor = existing?.textColor || DEFAULT_EVENT_TEXT_COLOR;

  const title = need.title?.trim() ? need.title.trim() : `Serving Network Event #${need.id}`;
  const location = need.eventLocation?.trim() ? need.eventLocation.trim() : null;
  const descriptionHtml = need.descriptionHtml || "";
  const groupName = category || null;

  if (existing) {
    await queryClient`
      UPDATE calendar_event_series
      SET title = ${title},
          group_name = ${groupName},
          location = ${location},
          description_html = ${descriptionHtml},
          event_color = ${resolvedEventColor},
          text_color = ${resolvedTextColor},
          all_day = ${seriesWindow.allDay},
          starts_at = ${seriesWindow.startsAt}::timestamptz,
          ends_at = ${seriesWindow.endsAt}::timestamptz,
          timezone = ${seriesWindow.timezone},
          recurrence_rule = ${null},
          recurrence_until = ${null}::timestamptz,
          integration_source = ${CALENDAR_SYNC_SOURCE},
          integration_key = ${integrationKey},
          deleted_at = ${null}::timestamptz,
          updated_at = NOW()
      WHERE id = ${existing.id}::uuid
        AND org_id = ${orgId}
    `;
    return;
  }

  await queryClient`
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
      deleted_at
    ) VALUES (
      ${randomUUID()}::uuid,
      ${orgId},
      ${title},
      ${groupName},
      ${location},
      ${descriptionHtml},
      ${resolvedEventColor},
      ${resolvedTextColor},
      ${seriesWindow.allDay},
      ${seriesWindow.startsAt}::timestamptz,
      ${seriesWindow.endsAt}::timestamptz,
      ${seriesWindow.timezone},
      ${null},
      ${null}::timestamptz,
      ${CALENDAR_SYNC_SOURCE},
      ${integrationKey},
      ${null}::uuid,
      ${null}::timestamptz
    )
  `;
}

async function buildUpsertPayload(need: Need): Promise<CalendarSyncWebhookPayload> {
  const eventStartDate = normalizeDate(need.eventDate);
  const eventEndDate = normalizeDate(need.endDate) || eventStartDate;
  const eventStartTime = normalizeTime(need.eventStartTime);
  const eventEndTime = normalizeTime(need.eventEndTime);

  const roleRows = await db
    .select({
      id: eventRoles.id,
      name: eventRoles.name,
      slotDate: eventRoles.slotDate,
      startTime: eventRoles.startTime,
      endTime: eventRoles.endTime,
      capacity: eventRoles.capacity,
      displayOrder: eventRoles.displayOrder,
      isActive: eventRoles.isActive,
    })
    .from(eventRoles)
    .where(and(eq(eventRoles.needId, need.id), eq(eventRoles.isActive, true)))
    .orderBy(asc(eventRoles.displayOrder), asc(eventRoles.id));

  return {
    source: CALENDAR_SYNC_SOURCE,
    action: "UPSERT",
    orgId: CALENDAR_SYNC_ORG_ID,
    need: {
      id: need.id,
      title: need.title,
      category: need.category,
      descriptionHtml: appendSignupLink(need.description || "", need.id),
      eventStartDate,
      eventEndDate,
      // Keep legacy fields for backward compatibility with existing consumers.
      eventDate: eventStartDate,
      eventStartTime,
      eventEndTime,
      eventStartDateTime: buildDateTime(eventStartDate, eventStartTime),
      eventEndDateTime: buildDateTime(eventEndDate, eventEndTime),
      eventLocation: need.eventLocation || null,
      status: need.status,
      timezone: DEFAULT_TIMEZONE,
      signupUrl: toSignupUrl(need.id),
      eventRoles: roleRows,
    },
  };
}

async function upsertQueueRow(params: {
  needId: number;
  action: CalendarSyncAction;
  payload: CalendarSyncWebhookPayload;
}): Promise<void> {
  const payloadString = JSON.stringify(params.payload);
  const idempotencyKey = computeIdempotencyKey(params.action, params.needId, payloadString);
  const now = new Date();

  await db
    .insert(calendarSyncQueue)
    .values({
      needId: params.needId,
      action: params.action,
      payload: payloadString,
      idempotencyKey,
      attempts: 0,
      nextAttemptAt: now,
      lastAttemptAt: null,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: calendarSyncQueue.needId,
      set: {
        action: params.action,
        payload: payloadString,
        idempotencyKey,
        attempts: 0,
        nextAttemptAt: now,
        lastAttemptAt: null,
        lastError: null,
        updatedAt: now,
      },
    });
}

async function markFailedAttempt(row: CalendarSyncQueueRow, errorMessage: string): Promise<void> {
  const now = new Date();
  const attempts = (row.attempts || 0) + 1;
  const delaySeconds = Math.min(2 ** attempts * 60, 6 * 60 * 60);
  const nextAttemptAt = new Date(now.getTime() + delaySeconds * 1000);

  await db
    .update(calendarSyncQueue)
    .set({
      attempts,
      nextAttemptAt,
      lastAttemptAt: now,
      lastError: truncateError(errorMessage),
      updatedAt: now,
    })
    .where(eq(calendarSyncQueue.needId, row.needId));
}

async function dispatchQueueRow(row: CalendarSyncQueueRow): Promise<void> {
  const payload = parseQueuePayload(row.payload);

  if (payload.action === "DELETE") {
    await applyDeleteToCalendar(payload.orgId || CALENDAR_SYNC_ORG_ID, payload.need.id);
  } else {
    await applyUpsertToCalendar(payload);
  }

  await db.delete(calendarSyncQueue).where(eq(calendarSyncQueue.needId, row.needId));
}

async function processQueueRow(row: CalendarSyncQueueRow): Promise<"success" | "failed"> {
  try {
    await dispatchQueueRow(row);
    return "success";
  } catch (error) {
    const errorMessage = toSyncErrorMessage(error);
    await markFailedAttempt(row, errorMessage);
    return "failed";
  }
}

export async function enqueueNeedCalendarSync(need: Need): Promise<void> {
  if (!isSyncEnabled()) return;

  if (isEligibleEventNeed(need)) {
    const payload = await buildUpsertPayload(need);
    await upsertQueueRow({
      needId: need.id,
      action: "UPSERT",
      payload,
    });
    return;
  }

  await enqueueNeedCalendarDelete(need.id);
}

export async function enqueueNeedCalendarDelete(needId: number): Promise<void> {
  if (!isSyncEnabled()) return;

  await upsertQueueRow({
    needId,
    action: "DELETE",
    payload: buildDeletePayload(needId),
  });
}

export async function processCalendarSyncQueue(limit = 25): Promise<CalendarSyncProcessResult> {
  if (!isSyncEnabled()) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  const now = new Date();
  const jobs = await db
    .select()
    .from(calendarSyncQueue)
    .where(lte(calendarSyncQueue.nextAttemptAt, now))
    .orderBy(asc(calendarSyncQueue.nextAttemptAt))
    .limit(Math.max(1, limit));

  let succeeded = 0;
  let failed = 0;

  for (const job of jobs) {
    const result = await processQueueRow(job);
    if (result === "success") succeeded += 1;
    if (result === "failed") failed += 1;
  }

  return {
    processed: jobs.length,
    succeeded,
    failed,
  };
}

export async function processCalendarSyncQueueForNeed(needId: number): Promise<boolean> {
  if (!isSyncEnabled()) return false;

  const [job] = await db
    .select()
    .from(calendarSyncQueue)
    .where(eq(calendarSyncQueue.needId, needId))
    .limit(1);

  if (!job) return false;

  const result = await processQueueRow(job);
  return result === "success";
}

export async function triggerImmediateCalendarSync(needId: number): Promise<boolean> {
  if (!isSyncEnabled()) return false;

  try {
    return await processCalendarSyncQueueForNeed(needId);
  } catch (error) {
    console.error("Immediate calendar sync failed:", error);
    return false;
  }
}
