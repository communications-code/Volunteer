import express, { type Express, type Request } from "express";
import {
  storage,
  EventSignupValidationError,
  EventSlotConflictError,
  type NeedMutationInput,
  type NeedListItem,
  type PledgeWithEventRoles,
  type EventRoleSummary,
} from "./storage";
import { setupAuth } from "./auth";
import { interpretAssistantQuery } from "./assistant";
import { fromZodError } from "zod-validation-error";
import {
  insertNeedSchema,
  insertPledgeSchema,
  insertUserSchema,
  insertCategorySchema,
  NeedStatus,
  NeedType,
  type Need,
  categories,
} from "@shared/schema";
import { z } from "zod";
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { createHmac } from 'crypto';
import {
  sendPledgeNotification,
  sendPledgeConfirmation,
  sendEmail,
  sendEventSignupChangeConfirmation,
  sendEventSignupReminder,
} from "./email";
import { addSubscriber } from "./mailerlite";
import { eq, asc, inArray, and, ne } from "drizzle-orm";
import { ensureAuthCompatibility } from "./auth-compat";
import { ensureEmailDeliverySettings } from "./email-delivery-settings";
import {
  enqueueNeedCalendarDelete,
  enqueueNeedCalendarSync,
  processCalendarSyncQueue,
  triggerImmediateCalendarSync,
} from "./calendar-sync";
import { transferCalendarDataFromSource } from "./calendar-transfer";
import { proxyCalendarRequest } from "./calendar-compat";
import {
  appendCalendarAuditLog,
  calendarEventInputSchema,
  calendarOccurrenceCancelSchema,
  calendarOccurrenceMoveSchema,
  cancelNativeCalendarOccurrence,
  createNativeCalendarSeries,
  deleteNativeCalendarSeries,
  getCalendarAdminErrorMessage,
  getCalendarIdempotentReplay,
  moveNativeCalendarOccurrence,
  storeCalendarIdempotentReplay,
  updateNativeCalendarSeries,
} from "./calendar-admin";
import {
  getCalendarOrgId,
  getNativeCalendarEventsResponse,
  getNativeCalendarExportBundle,
  getNativePublicCalendarEventsResponse,
} from "./calendar-native";
import { getCurrentDateInNewYork } from "./timezone";

// Helper function to generate secure tokens for email actions
function generateSecureToken(needId: number, action: string): string {
  if (!process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET environment variable must be set');
  }
  
  // Token expires in 7 days
  const expiryTime = Date.now() + (7 * 24 * 60 * 60 * 1000);
  
  // Create a payload with the need ID, action, and expiry time
  const payload = `${needId}:${action}:${expiryTime}`;
  
  // Create an HMAC signature using the session secret
  const hmac = createHmac('sha256', process.env.SESSION_SECRET);
  hmac.update(payload);
  const signature = hmac.digest('hex');
  
  // Combine payload and signature to form the token
  return Buffer.from(`${payload}:${signature}`).toString('base64');
}

// Helper function to verify a secure token
function verifySecureToken(token: string): { needId: number; action: string; valid: boolean } {
  try {
    if (!process.env.SESSION_SECRET) {
      throw new Error('SESSION_SECRET environment variable must be set');
    }
    
    // Decode the token
    const decoded = Buffer.from(token, 'base64').toString();
    const [needIdStr, action, expiryTimeStr, signature] = decoded.split(':');
    
    // Parse the need ID and expiry time
    const needId = parseInt(needIdStr);
    const expiryTime = parseInt(expiryTimeStr);
    
    // Check if the token has expired
    if (isNaN(expiryTime) || Date.now() > expiryTime) {
      return { needId, action, valid: false };
    }
    
    // Recreate the payload
    const payload = `${needId}:${action}:${expiryTime}`;
    
    // Verify the signature
    const hmac = createHmac('sha256', process.env.SESSION_SECRET);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');
    
    // Check if the signatures match
    const valid = signature === expectedSignature;
    
    return { needId, action, valid };
  } catch (err) {
    console.error('Error verifying token:', err);
    return { needId: -1, action: '', valid: false };
  }
}

const nyDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  hourCycle: "h23",
});

function getPublicEventLastDate(
  need: Pick<NeedListItem, "needType" | "eventLastDate" | "startDate" | "endDate" | "eventDate" | "neededBy">,
): string | null {
  if (need.needType !== NeedType.EVENT) {
    return null;
  }

  return need.eventLastDate || need.endDate || need.eventDate || need.neededBy || need.startDate || null;
}

function isEventHiddenFromPublic(need: Pick<NeedListItem, "needType" | "status" | "eventLastDate" | "startDate" | "endDate" | "eventDate" | "neededBy">): boolean {
  if (need.needType !== NeedType.EVENT) {
    return false;
  }

  if (need.status === NeedStatus.FULFILLED) {
    return true;
  }

  const eventLastDate = getPublicEventLastDate(need);
  if (!eventLastDate) {
    return false;
  }

  return getCurrentDateInNewYork() > eventLastDate;
}

function isEventRoleHiddenFromPublic(
  need: Pick<NeedListItem, "eventDate" | "startDate" | "neededBy">,
  role: Pick<EventRoleSummary, "slotDate">,
): boolean {
  const slotDate = role.slotDate || need.eventDate || need.startDate || need.neededBy || null;
  return Boolean(slotDate && getCurrentDateInNewYork() > slotDate);
}

function isNeedHiddenFromPublic(
  need: Pick<NeedListItem, "needType" | "status" | "eventLastDate" | "startDate" | "endDate" | "eventDate" | "neededBy">,
): boolean {
  return (
    need.status === NeedStatus.DRAFT ||
    need.status === NeedStatus.UNFULFILLED ||
    isEventHiddenFromPublic(need)
  );
}

function getNewYorkLocalParts(date: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const parts = nyDateTimeFormatter.formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  return {
    year: getPart("year"),
    month: getPart("month"),
    day: getPart("day"),
    hour: getPart("hour"),
    minute: getPart("minute"),
    second: getPart("second"),
  };
}

function toIsoDate(parts: { year: number; month: number; day: number }): string {
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}-${month}-${day}`;
}

function getNewYorkIsoDate(date: Date): string {
  return toIsoDate(getNewYorkLocalParts(date));
}

function newYorkDateTimeToUtc(slotDate: string, slotTime: string): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(slotDate.trim());
  const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(slotTime.trim());
  if (!dateMatch || !timeMatch) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);

  let guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const desiredUtcMinutes = Date.UTC(year, month - 1, day, hour, minute, 0);

  for (let i = 0; i < 4; i += 1) {
    const local = getNewYorkLocalParts(guess);
    const actualUtcMinutes = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      0,
    );
    const diffMs = desiredUtcMinutes - actualUtcMinutes;
    if (diffMs === 0) break;
    guess = new Date(guess.getTime() + diffMs);
  }

  return Number.isNaN(guess.getTime()) ? null : guess;
}

export async function registerRoutes(app: Express): Promise<void> {
  const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const parseTimeToMinutes = (time: string): number | null => {
    const trimmed = time.trim();
    const match = timePattern.exec(trimmed);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    return hours * 60 + minutes;
  };

  const isTimeRangeOrdered = (startTime?: string | null, endTime?: string | null): boolean => {
    if (!startTime || !endTime) return true;
    const startMinutes = parseTimeToMinutes(startTime);
    const endMinutes = parseTimeToMinutes(endTime);
    if (startMinutes === null || endMinutes === null) return false;
    return startMinutes < endMinutes;
  };

  const eventRolePayloadSchema = z
    .object({
      id: z.number().int().positive().optional(),
      name: z.string().trim().min(1, "Role name is required"),
      slotDate: z.preprocess(
        (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
        z
          .union([
            z.string().trim().regex(datePattern, "Slot date must be YYYY-MM-DD"),
            z.null(),
            z.undefined(),
          ])
          .optional(),
      ),
      startTime: z.string().trim().regex(timePattern, "Start time must be HH:mm"),
      endTime: z.string().trim().regex(timePattern, "End time must be HH:mm"),
      capacity: z
        .union([z.number().int().positive(), z.null(), z.undefined()])
        .optional()
        .transform((value) => (value === undefined ? 1 : value)),
      displayOrder: z.number().int().nonnegative().optional(),
      isActive: z.boolean().optional(),
    })
    .refine((role) => isTimeRangeOrdered(role.startTime, role.endTime), {
      message: "Role end time must be after start time.",
      path: ["endTime"],
    });

  const needMutationSchema = insertNeedSchema.extend({
    eventRoles: z.array(eventRolePayloadSchema).optional(),
  });

  const pledgeMutationSchema = insertPledgeSchema.extend({
    donationType: z.enum(["items", "money", "signup"]),
    selectedEventRoleIds: z.array(z.number().int().positive()).optional(),
    selectedEventRoleQuantities: z.record(z.string(), z.number().int().positive()).optional(),
  });

  const publicSubscriberSchema = z.object({
    firstName: z.string().trim().min(1, "First name is required").max(80),
    lastName: z.string().trim().min(1, "Last name is required").max(80),
    email: z.string().trim().email("Please enter a valid email address"),
    phone: z.string().trim().min(7, "Phone number is required").max(30),
  });
  const resetAdminPasswordSchema = z.object({
    newPassword: z.string().min(8, "Password must be at least 8 characters").max(128),
    notifyUser: z.boolean().optional(),
  });
  const notificationPreferencesSchema = z.object({
    receiveAllNotifications: z.boolean(),
    enabledCategories: z.array(z.string().trim().min(1)).default([]),
  });
  const eventSignupManageUpdateSchema = z.object({
    token: z.string().trim().min(1),
    firstName: z.string().trim().min(1, "First name is required").max(80),
    lastName: z.string().trim().min(1, "Last name is required").max(80),
    email: z.string().trim().email("Please enter a valid email address"),
    phone: z
      .union([z.string().trim().max(30), z.null(), z.undefined()])
      .optional()
      .transform((value) => (typeof value === "string" && value.trim().length > 0 ? value.trim() : null)),
    organization: z
      .union([z.string().trim().max(120), z.null(), z.undefined()])
      .optional()
      .transform((value) => (typeof value === "string" && value.trim().length > 0 ? value.trim() : null)),
    notes: z
      .union([z.string().trim().max(2000), z.null(), z.undefined()])
      .optional()
      .transform((value) => (typeof value === "string" && value.trim().length > 0 ? value.trim() : null)),
    selectedEventRoleIds: z.array(z.number().int().positive()).min(1, "Please select at least one sign-up slot."),
  });
  const eventSignupManageCancelSchema = z.object({
    token: z.string().trim().min(1),
  });
  const adminEventSignupUpdateSchema = z.object({
    firstName: z.string().trim().min(1, "First name is required").max(80),
    lastName: z.string().trim().min(1, "Last name is required").max(80),
    email: z.string().trim().email("Please enter a valid email address"),
    phone: z
      .union([z.string().trim().max(30), z.null(), z.undefined()])
      .optional()
      .transform((value) => (typeof value === "string" && value.trim().length > 0 ? value.trim() : null)),
    organization: z
      .union([z.string().trim().max(120), z.null(), z.undefined()])
      .optional()
      .transform((value) => (typeof value === "string" && value.trim().length > 0 ? value.trim() : null)),
    notes: z
      .union([z.string().trim().max(2000), z.null(), z.undefined()])
      .optional()
      .transform((value) => (typeof value === "string" && value.trim().length > 0 ? value.trim() : null)),
    selectedEventRoleIds: z.array(z.number().int().positive()).default([]),
  });

  const parseEnabledCategories = (raw: string | null | undefined): string[] => {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim().toUpperCase())
        .filter((value) => value.length > 0);
    } catch {
      return [];
    }
  };

  const parseNeedCategorySelections = (
    raw: string | null | undefined,
    fallbackCategory: string | null | undefined,
  ): string[] => {
    const fallback = (fallbackCategory || "").trim().toUpperCase();
    if (!raw) return fallback ? [fallback] : [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return fallback ? [fallback] : [];
      const values = parsed
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim().toUpperCase())
        .filter((value) => value.length > 0);
      if (values.length === 0 && fallback) return [fallback];
      return Array.from(new Set(values));
    } catch {
      return fallback ? [fallback] : [];
    }
  };

  const getAdminsForNotification = async (
    need: Pick<Need, "category" | "categorySelections">,
  ): Promise<string[]> => {
    const needCategories = parseNeedCategorySelections(need.categorySelections, need.category);
    const { db } = await import("./db");
    const { users, adminNotificationPreferences } = await import("@shared/schema");

    const admins = await db
      .select({
        id: users.id,
        username: users.username,
      })
      .from(users)
      .where(eq(users.isAdmin, true));

    if (admins.length === 0) {
      return [];
    }

    const preferences = await db
      .select({
        userId: adminNotificationPreferences.userId,
        receiveAllNotifications: adminNotificationPreferences.receiveAllNotifications,
        enabledCategories: adminNotificationPreferences.enabledCategories,
      })
      .from(adminNotificationPreferences)
      .where(
        inArray(
          adminNotificationPreferences.userId,
          admins.map((admin) => admin.id),
        ),
      );

    const preferenceByUserId = new Map(preferences.map((pref) => [pref.userId, pref]));

    return admins
      .filter((admin) => {
        const preference = preferenceByUserId.get(admin.id);
        if (!preference || preference.receiveAllNotifications) {
          // Backward compatibility: missing row means "receive everything".
          return true;
        }

        const enabledCategories = parseEnabledCategories(preference.enabledCategories);
        if (enabledCategories.length === 0) {
          // Explicit mute when "receive all" is off and no categories selected.
          return false;
        }
        return needCategories.some((category) => enabledCategories.includes(category));
      })
      .map((admin) => admin.username)
      .filter((email): email is string => Boolean(email));
  };

  const sendEventSignupChangeNotifications = async (
    need: Pick<Need, "id" | "title" | "eventLocation" | "category" | "categorySelections">,
    pledge: PledgeWithEventRoles,
    changeType: "updated" | "canceled",
  ): Promise<void> => {
    const signerEmail = pledge.email.trim().toLowerCase();
    const adminRecipients = Array.from(
      new Set(
        (await getAdminsForNotification(need))
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean),
      ),
    ).filter((email) => email !== signerEmail);

    const sendTasks: Promise<boolean>[] = [
      sendEventSignupChangeConfirmation(
        { id: need.id, title: need.title, eventLocation: need.eventLocation },
        pledge,
        changeType,
        signerEmail,
        "volunteer",
      ),
    ];

    if (adminRecipients.length > 0) {
      sendTasks.push(
        sendEventSignupChangeConfirmation(
          { id: need.id, title: need.title, eventLocation: need.eventLocation },
          pledge,
          changeType,
          adminRecipients,
          "admin",
        ),
      );
    }

    const results = await Promise.all(sendTasks);
    if (results.some((result) => !result)) {
      console.warn(
        `Event sign-up ${changeType} notification had one or more delivery failures for pledge ${pledge.id}`,
      );
    }
  };

  const normalizeNeedMutationPayload = (payload: NeedMutationInput): NeedMutationInput => {
    const next: NeedMutationInput = { ...payload };
    const isEventNeed = next.needType === NeedType.EVENT;

    if (isEventNeed) {
      next.allowItemDonations = false;
      next.allowMoneyDonations = false;
      next.status =
        next.status === NeedStatus.DRAFT
          ? NeedStatus.DRAFT
          : next.status === NeedStatus.PLEDGED
            ? NeedStatus.PLEDGED
            : NeedStatus.FLOATING;
    }

    return next;
  };

  const isPublishedEventNeed = (need?: Pick<Need, "needType" | "status"> | null): boolean => {
    if (!need) return false;
    return (
      need.needType === NeedType.EVENT &&
      need.status !== NeedStatus.DRAFT &&
      need.status !== NeedStatus.UNFULFILLED
    );
  };

  const enqueueCalendarSyncForNeedTransition = async (
    previousNeed: Need | undefined | null,
    nextNeed: Need | undefined | null,
  ): Promise<void> => {
    const previousPublishedEvent = isPublishedEventNeed(previousNeed);
    const nextPublishedEvent = isPublishedEventNeed(nextNeed);

    if (nextPublishedEvent && nextNeed) {
      await enqueueNeedCalendarSync(nextNeed);
      await triggerImmediateCalendarSync(nextNeed.id);
      return;
    }

    if (previousPublishedEvent && previousNeed) {
      await enqueueNeedCalendarDelete(previousNeed.id);
      await triggerImmediateCalendarSync(previousNeed.id);
    }
  };

  const validateEventNeedPayload = (payload: NeedMutationInput): string | null => {
    if (payload.needType !== NeedType.EVENT) return null;

    const startDate = typeof payload.eventDate === "string" ? payload.eventDate.trim() : "";
    const endDate = typeof payload.endDate === "string" ? payload.endDate.trim() : "";

    if (!startDate && endDate) {
      return "Event start date is required when end date is provided.";
    }

    if (startDate && endDate && endDate < startDate) {
      return "Event end date must be on or after start date.";
    }

    const spansMultipleDays = Boolean(startDate && endDate && endDate > startDate);
    if (!spansMultipleDays && !isTimeRangeOrdered(payload.eventStartTime, payload.eventEndTime)) {
      return "Event end time must be after start time.";
    }

    if (!Array.isArray(payload.eventRoles)) return null;

    for (const role of payload.eventRoles) {
      if (!isTimeRangeOrdered(role.startTime, role.endTime)) {
        return `Role "${role.name || "Unnamed"}" must have an end time after start time.`;
      }

      if (role.capacity !== null && role.capacity !== undefined && role.capacity <= 0) {
        return `Role "${role.name || "Unnamed"}" capacity must be greater than 0 when provided.`;
      }
    }

    return null;
  };

  // Simple in-memory cache for expensive endpoints (serverless-friendly).
  // Each cold start gets a fresh cache; within a warm invocation window,
  // repeated requests return instantly instead of hitting the DB.
  let statsCache: { data: any; timestamp: number } | null = null;
  const STATS_CACHE_TTL = 30_000; // 30 seconds

  // Auto-invalidate stats cache on any mutation to needs or pledges
  app.use('/api/needs', (req, _res, next) => {
    if (req.method !== 'GET') statsCache = null;
    next();
  });
  app.use('/api/pledges', (req, _res, next) => {
    if (req.method !== 'GET') statsCache = null;
    next();
  });

  // Diagnostic endpoint — returns DB connection status (no auth required)
  app.get("/api/health", async (_req, res) => {
    try {
      const { db } = await import('./db');
      const result = await db.execute('SELECT 1 as ok');
      res.json({ status: "ok", db: "connected", result: result?.[0] ?? null, timestamp: new Date().toISOString() });
    } catch (err: any) {
      res.status(500).json({ status: "error", db: "failed", error: err?.message, code: err?.code, timestamp: new Date().toISOString() });
    }
  });

  app.post("/api/cron/calendar-sync", async (req, res) => {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return res.status(500).json({ message: "CRON_SECRET not configured" });
    }

    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const rawLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
    const parsedLimit = rawLimit ? Number(rawLimit) : 25;
    const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(100, Math.floor(parsedLimit))) : 25;

    try {
      const result = await processCalendarSyncQueue(limit);
      return res.json({
        success: true,
        ...result,
        limit,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Calendar sync cron failed:", error);
      return res.status(500).json({ message: "Calendar sync cron failed" });
    }
  });

  app.get("/api/cron/event-signup-reminders", async (req, res) => {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return res.status(500).json({ message: "CRON_SECRET not configured" });
    }

    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const reminderType = "FIRST_SLOT_DAY_BEFORE_10AM_ET";
    const reminderSendTimeLocal = "10:00";

    try {
      const { db } = await import("./db");
      const { pledges, needs, eventSignupReminders } = await import("@shared/schema");

      const pledgeRows = await db
        .select({
          pledgeId: pledges.id,
          needId: needs.id,
          needTitle: needs.title,
          needEventLocation: needs.eventLocation,
          needEventDate: needs.eventDate,
          firstName: pledges.firstName,
          email: pledges.email,
        })
        .from(pledges)
        .innerJoin(needs, eq(pledges.needId, needs.id))
        .where(
          and(
            eq(needs.needType, NeedType.EVENT),
            ne(needs.status, NeedStatus.DRAFT),
            ne(needs.status, NeedStatus.FULFILLED),
          ),
        );

      if (pledgeRows.length === 0) {
        return res.json({
          success: true,
          scheduled: 0,
          skipped: 0,
          failed: 0,
          message: "No event sign-ups eligible for reminders.",
        });
      }

      const selectionsByPledgeId = await storage.getEventRoleSelectionsByPledgeIds(
        pledgeRows.map((row) => row.pledgeId),
      );

      type ReminderRole = EventRoleSummary;
      type ReminderGroup = {
        needId: number;
        needTitle: string;
        needEventLocation: string | null;
        email: string;
        normalizedEmail: string;
        firstName: string | null;
        roles: Map<number, ReminderRole>;
        firstSlotAt: Date | null;
      };

      const grouped = new Map<string, ReminderGroup>();

      for (const row of pledgeRows) {
        const selectedRoles = selectionsByPledgeId.get(row.pledgeId) || [];
        if (selectedRoles.length === 0) continue;

        const normalizedEmail = row.email.trim().toLowerCase();
        const key = `${row.needId}:${normalizedEmail}`;
        const existing = grouped.get(key);

        const group: ReminderGroup = existing || {
          needId: row.needId,
          needTitle: row.needTitle,
          needEventLocation: row.needEventLocation,
          email: row.email,
          normalizedEmail,
          firstName: row.firstName || null,
          roles: new Map<number, ReminderRole>(),
          firstSlotAt: null,
        };

        if (!group.firstName && row.firstName) {
          group.firstName = row.firstName;
        }

        for (const role of selectedRoles) {
          const effectiveSlotDate = role.slotDate || row.needEventDate || null;
          const roleForReminder: ReminderRole = {
            ...role,
            slotDate: effectiveSlotDate,
          };

          group.roles.set(roleForReminder.id, roleForReminder);

          if (effectiveSlotDate) {
            const slotAt = newYorkDateTimeToUtc(effectiveSlotDate, roleForReminder.startTime);
            if (slotAt && (!group.firstSlotAt || slotAt.getTime() < group.firstSlotAt.getTime())) {
              group.firstSlotAt = slotAt;
            }
          }
        }

        grouped.set(key, group);
      }

      const now = new Date();
      const nowNy = getNewYorkLocalParts(now);
      const todayNyDate = toIsoDate(nowNy);
      const tomorrowNyDate = getNewYorkIsoDate(
        new Date(Date.UTC(nowNy.year, nowNy.month - 1, nowNy.day + 1, 12, 0, 0)),
      );
      const reminderSendAtUtc = newYorkDateTimeToUtc(todayNyDate, reminderSendTimeLocal);
      const sendAtUnix =
        reminderSendAtUtc && reminderSendAtUtc.getTime() > now.getTime() + 60_000
          ? Math.floor(reminderSendAtUtc.getTime() / 1000)
          : undefined;

      let scheduled = 0;
      let skipped = 0;
      let failed = 0;

      for (const group of Array.from(grouped.values())) {
        if (!group.firstSlotAt) {
          skipped += 1;
          continue;
        }

        const firstSlotNyDate = getNewYorkIsoDate(group.firstSlotAt);
        if (firstSlotNyDate !== tomorrowNyDate) {
          skipped += 1;
          continue;
        }

        const [reservation] = await db
          .insert(eventSignupReminders)
          .values({
            needId: group.needId,
            signerEmail: group.normalizedEmail,
            firstSlotAt: group.firstSlotAt,
            reminderType,
            sentAt: new Date(),
          })
          .onConflictDoNothing()
          .returning({ id: eventSignupReminders.id });

        if (!reservation) {
          skipped += 1;
          continue;
        }

        const reminderSent = await sendEventSignupReminder(
          {
            id: group.needId,
            title: group.needTitle,
            eventLocation: group.needEventLocation,
          },
          {
            email: group.email,
            firstName: group.firstName,
          },
          Array.from(group.roles.values()),
          {
            sendAtUnix,
          },
        );

        if (!reminderSent) {
          failed += 1;
          await db.delete(eventSignupReminders).where(eq(eventSignupReminders.id, reservation.id));
          continue;
        }

        scheduled += 1;
      }

      return res.json({
        success: true,
        scheduled,
        skipped,
        failed,
        groupedCandidates: grouped.size,
        todayNyDate,
        tomorrowNyDate,
        reminderScheduledForIso: reminderSendAtUtc?.toISOString() || null,
      });
    } catch (error) {
      console.error("Event signup reminder cron failed:", error);
      return res.status(500).json({ message: "Event signup reminder cron failed" });
    }
  });

  // Set up static file serving for uploaded images
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsDir));

  // Ensure runtime compat never blocks app boot in serverless.
  try {
    await ensureAuthCompatibility();
  } catch (error) {
    console.warn("Skipping runtime auth compatibility due to startup error:", error);
  }

  try {
    await ensureEmailDeliverySettings();
  } catch (error) {
    console.warn("Skipping email delivery settings bootstrap due to startup error:", error);
  }

  // Set up authentication routes
  setupAuth(app);

  const hasCalendarAdminAccess = (req: Request): boolean => {
    return Boolean(req.isAuthenticated?.() && req.user?.isAdmin);
  };

  const getRequestSearchParams = (req: Request): URLSearchParams => {
    const queryIndex = req.originalUrl.indexOf("?");
    const query = queryIndex >= 0 ? req.originalUrl.slice(queryIndex + 1) : "";
    return new URLSearchParams(query);
  };

  const getCalendarNativeError = (error: unknown): string => {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return "Unknown native calendar handler error";
  };

  const getCalendarRequestPath = (req: Request): string => {
    const queryIndex = req.originalUrl.indexOf("?");
    return queryIndex >= 0 ? req.originalUrl.slice(0, queryIndex) : req.originalUrl;
  };

  const getCalendarIdempotencyKey = (req: Request): string | null => {
    const header = req.header("Idempotency-Key");
    if (!header) return null;
    const key = header.trim();
    return key.length > 0 ? key : null;
  };

  const getCalendarAdminOrgId = (): string => getCalendarOrgId();

  app.get("/api/public/events", async (req, res) => {
    try {
      const payload = await getNativePublicCalendarEventsResponse(getRequestSearchParams(req));
      return res.json(payload);
    } catch (error) {
      console.warn(
        "Native /api/public/events failed; falling back to compatibility proxy:",
        getCalendarNativeError(error),
      );
      await proxyCalendarRequest(req, res);
    }
  });

  app.get("/api/v1/calendar/events", async (req, res) => {
    if (!hasCalendarAdminAccess(req)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    try {
      const payload = await getNativeCalendarEventsResponse({
        searchParams: getRequestSearchParams(req),
      });
      return res.json(payload);
    } catch (error) {
      console.warn(
        "Native GET /api/v1/calendar/events failed; falling back to compatibility proxy:",
        getCalendarNativeError(error),
      );
      await proxyCalendarRequest(req, res);
    }
  });

  app.post("/api/v1/calendar/events", async (req, res) => {
    if (!hasCalendarAdminAccess(req)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const orgId = getCalendarAdminOrgId();
    const path = "/api/v1/calendar/events";
    const idempotencyKey = getCalendarIdempotencyKey(req);

    try {
      const replay = await getCalendarIdempotentReplay({
        orgId,
        key: idempotencyKey,
        method: "POST",
        path,
      });
      if (replay) {
        return res.status(replay.status).json(replay.payload);
      }

      const parsed = calendarEventInputSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: parsed.error.flatten(),
        });
      }

      const payload = await createNativeCalendarSeries({
        orgId,
        createdBy: req.user?.id ?? null,
        input: parsed.data,
      });

      await appendCalendarAuditLog({
        orgId,
        eventType: "calendar.event.created",
        entityType: "calendar_event_series",
        entityId: payload.eventSeries.id,
        payload,
        idempotencyKey,
        requestPath: path,
        httpMethod: "POST",
        responseStatus: 201,
        responsePayload: payload,
        webhookStatus: "local",
      });

      await storeCalendarIdempotentReplay({
        orgId,
        key: idempotencyKey,
        method: "POST",
        path,
        status: 201,
        payload,
      });

      return res.status(201).json(payload);
    } catch (error) {
      console.error("Native POST /api/v1/calendar/events failed:", error);
      return res.status(500).json({
        error: "Failed to save event",
        details: getCalendarAdminErrorMessage(error),
      });
    }
  });

  app.post("/api/v1/calendar/events/occurrence", async (req, res) => {
    if (!hasCalendarAdminAccess(req)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const orgId = getCalendarAdminOrgId();
    const path = "/api/v1/calendar/events/occurrence";
    const idempotencyKey = getCalendarIdempotencyKey(req);

    try {
      const replay = await getCalendarIdempotentReplay({
        orgId,
        key: idempotencyKey,
        method: "POST",
        path,
      });
      if (replay) {
        return res.status(replay.status).json(replay.payload);
      }

      const parsed = calendarOccurrenceCancelSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: parsed.error.flatten(),
        });
      }

      const payload = await cancelNativeCalendarOccurrence({
        orgId,
        input: parsed.data,
      });
      if (!payload) {
        return res.status(404).json({ error: "Event series not found" });
      }

      await appendCalendarAuditLog({
        orgId,
        eventType: "calendar.event.occurrence.deleted",
        entityType: "calendar_events",
        entityId: payload.occurrence.id,
        payload,
        idempotencyKey,
        requestPath: path,
        httpMethod: "POST",
        responseStatus: 200,
        responsePayload: payload,
        webhookStatus: "local",
      });

      await storeCalendarIdempotentReplay({
        orgId,
        key: idempotencyKey,
        method: "POST",
        path,
        status: 200,
        payload,
      });

      return res.json(payload);
    } catch (error) {
      console.error("Native POST /api/v1/calendar/events/occurrence failed:", error);
      return res.status(500).json({
        error: "Failed to cancel occurrence",
        details: getCalendarAdminErrorMessage(error),
      });
    }
  });

  app.patch("/api/v1/calendar/events/occurrence", async (req, res) => {
    if (!hasCalendarAdminAccess(req)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const orgId = getCalendarAdminOrgId();
    const path = "/api/v1/calendar/events/occurrence";
    const idempotencyKey = getCalendarIdempotencyKey(req);

    try {
      const replay = await getCalendarIdempotentReplay({
        orgId,
        key: idempotencyKey,
        method: "PATCH",
        path,
      });
      if (replay) {
        return res.status(replay.status).json(replay.payload);
      }

      const parsed = calendarOccurrenceMoveSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: parsed.error.flatten(),
        });
      }

      const payload = await moveNativeCalendarOccurrence({
        orgId,
        input: parsed.data,
      });
      if (!payload) {
        return res.status(404).json({ error: "Event series not found" });
      }

      const movedOccurrence = "occurrence" in payload ? payload.occurrence : null;
      const movedEntityId = movedOccurrence
        ? movedOccurrence.id
        : "eventSeries" in payload
          ? payload.eventSeries?.id ?? null
          : null;

      await appendCalendarAuditLog({
        orgId,
        eventType: "calendar.event.occurrence.updated",
        entityType: movedOccurrence ? "calendar_events" : "calendar_event_series",
        entityId: movedEntityId,
        payload,
        idempotencyKey,
        requestPath: path,
        httpMethod: "PATCH",
        responseStatus: 200,
        responsePayload: payload,
        webhookStatus: "local",
      });

      await storeCalendarIdempotentReplay({
        orgId,
        key: idempotencyKey,
        method: "PATCH",
        path,
        status: 200,
        payload,
      });

      return res.json(payload);
    } catch (error) {
      console.error("Native PATCH /api/v1/calendar/events/occurrence failed:", error);
      return res.status(500).json({
        error: "Failed to move occurrence",
        details: getCalendarAdminErrorMessage(error),
      });
    }
  });

  app.put("/api/v1/calendar/events/:id", async (req, res) => {
    if (!hasCalendarAdminAccess(req)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const orgId = getCalendarAdminOrgId();
    const idempotencyKey = getCalendarIdempotencyKey(req);
    const path = getCalendarRequestPath(req);

    try {
      const replay = await getCalendarIdempotentReplay({
        orgId,
        key: idempotencyKey,
        method: "PUT",
        path,
      });
      if (replay) {
        return res.status(replay.status).json(replay.payload);
      }

      const parsed = calendarEventInputSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: parsed.error.flatten(),
        });
      }

      const payload = await updateNativeCalendarSeries({
        id: req.params.id,
        orgId,
        input: parsed.data,
      });
      if (!payload) {
        return res.status(404).json({ error: "Event series not found" });
      }

      await appendCalendarAuditLog({
        orgId,
        eventType: "calendar.event.updated",
        entityType: "calendar_event_series",
        entityId: payload.eventSeries.id,
        payload,
        idempotencyKey,
        requestPath: path,
        httpMethod: "PUT",
        responseStatus: 200,
        responsePayload: payload,
        webhookStatus: "local",
      });

      await storeCalendarIdempotentReplay({
        orgId,
        key: idempotencyKey,
        method: "PUT",
        path,
        status: 200,
        payload,
      });

      return res.json(payload);
    } catch (error) {
      console.error("Native PUT /api/v1/calendar/events/:id failed:", error);
      return res.status(500).json({
        error: "Failed to update event",
        details: getCalendarAdminErrorMessage(error),
      });
    }
  });

  app.delete("/api/v1/calendar/events/:id", async (req, res) => {
    if (!hasCalendarAdminAccess(req)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const orgId = getCalendarAdminOrgId();
    const idempotencyKey = getCalendarIdempotencyKey(req);
    const path = getCalendarRequestPath(req);

    try {
      const replay = await getCalendarIdempotentReplay({
        orgId,
        key: idempotencyKey,
        method: "DELETE",
        path,
      });
      if (replay) {
        return res.status(replay.status).json(replay.payload);
      }

      const payload = await deleteNativeCalendarSeries({
        id: req.params.id,
        orgId,
      });

      await appendCalendarAuditLog({
        orgId,
        eventType: "calendar.event.deleted",
        entityType: "calendar_event_series",
        entityId: req.params.id,
        payload,
        idempotencyKey,
        requestPath: path,
        httpMethod: "DELETE",
        responseStatus: 200,
        responsePayload: payload,
        webhookStatus: "local",
      });

      await storeCalendarIdempotentReplay({
        orgId,
        key: idempotencyKey,
        method: "DELETE",
        path,
        status: 200,
        payload,
      });

      return res.json(payload);
    } catch (error) {
      console.error("Native DELETE /api/v1/calendar/events/:id failed:", error);
      return res.status(500).json({
        error: "Failed to delete event",
        details: getCalendarAdminErrorMessage(error),
      });
    }
  });

  app.get("/api/v1/calendar/export", async (req, res) => {
    if (!hasCalendarAdminAccess(req)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    try {
      const payload = await getNativeCalendarExportBundle();
      return res.json(payload);
    } catch (error) {
      console.warn(
        "Native GET /api/v1/calendar/export failed; falling back to compatibility proxy:",
        getCalendarNativeError(error),
      );
      await proxyCalendarRequest(req, res);
    }
  });

  app.all("/api/v1/calendar", async (req, res) => {
    if (!hasCalendarAdminAccess(req)) {
      return res.status(403).json({ message: "Not authorized" });
    }
    await proxyCalendarRequest(req, res);
  });

  app.all("/api/v1/calendar/*", async (req, res) => {
    if (!hasCalendarAdminAccess(req)) {
      return res.status(403).json({ message: "Not authorized" });
    }
    await proxyCalendarRequest(req, res);
  });

  app.post("/api/admin/calendar/transfer", async (req, res) => {
    if (!hasCalendarAdminAccess(req)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const parsed = z
      .object({
        mode: z.enum(["merge", "replace"]).optional(),
        sourceBaseUrl: z.string().trim().min(1).optional(),
        sourceOrgId: z.string().trim().min(1).optional(),
      })
      .safeParse(req.body ?? {});

    if (!parsed.success) {
      return res.status(400).json({
        message: "Invalid transfer payload",
        errors: fromZodError(parsed.error),
      });
    }

    try {
      const result = await transferCalendarDataFromSource({
        mode: parsed.data.mode,
        sourceBaseUrl: parsed.data.sourceBaseUrl,
        sourceOrgId: parsed.data.sourceOrgId,
      });

      return res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Admin calendar transfer failed:", error);
      return res.status(500).json({
        success: false,
        message: "Calendar transfer failed",
        details: error instanceof Error ? error.message : "Unknown transfer error",
      });
    }
  });

  app.post("/api/cron/calendar-transfer", async (req, res) => {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return res.status(500).json({ message: "CRON_SECRET not configured" });
    }

    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const modeRaw = Array.isArray(req.query.mode) ? req.query.mode[0] : req.query.mode;
    const mode = modeRaw === "replace" ? "replace" : "merge";

    try {
      const result = await transferCalendarDataFromSource({ mode });
      return res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Calendar transfer cron failed:", error);
      return res.status(500).json({
        success: false,
        message: "Calendar transfer cron failed",
        details: error instanceof Error ? error.message : "Unknown transfer error",
      });
    }
  });

  // Public route: subscribe to supporter updates
  app.post("/api/subscribe", async (req, res) => {
    try {
      const parsed = publicSubscriberSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid subscription data",
          errors: fromZodError(parsed.error),
        });
      }

      const payload = parsed.data;
      const subscribed = await addSubscriber(payload.email, payload.firstName, payload.lastName, {
        phone: payload.phone,
        groupId: process.env.MAILERLITE_SUPPORTERS_GROUP_ID,
        groupName: "Supporters",
      });

      if (!subscribed) {
        return res.status(503).json({
          message: "Unable to subscribe right now. Please try again in a moment.",
        });
      }

      res.set("Cache-Control", "no-store");
      return res.json({
        message: "You're subscribed to new needs updates.",
      });
    } catch (error) {
      console.error("Error subscribing supporter:", error);
      return res.status(500).json({ message: "Failed to subscribe" });
    }
  });
  
  // Admin routes - protected for admin users only
  app.get("/api/admin/users", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      // Use db directly to get all users
      const { db } = await import('./db');
      const { users } = await import('@shared/schema');
      
      const allUsers = await db.select().from(users);
      
      // Filter out password field for security
      const sanitizedUsers = allUsers.map(({ password, ...user }) => user);
      
      res.json(sanitizedUsers);
    } catch (error) {
      console.error("Error fetching admin users:", error);
      res.status(500).json({ message: "Failed to retrieve users" });
    }
  });
  
  // Natural-language assistant for the admin home "ask or do" bar
  app.post("/api/admin/assistant", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const query = typeof req.body?.query === "string" ? req.body.query.trim() : "";
      if (!query) {
        return res.status(400).json({ message: "Missing query" });
      }

      let categoryNames: string[] = [];
      try {
        const { db } = await import("./db");
        const rows = await db.select().from(categories);
        categoryNames = rows.map((row) => row.name).filter((name): name is string => Boolean(name));
      } catch (contextError) {
        console.warn("assistant: could not load categories for context", contextError);
      }

      const action = await interpretAssistantQuery(query, { categories: categoryNames });
      res.json(action);
    } catch (error) {
      console.error("Error handling assistant query:", error);
      res.status(503).json({ message: "Assistant is unavailable right now." });
    }
  });

  // Create new admin user - protected for admin users only
  app.post("/api/admin/create", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const result = insertUserSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: "Invalid user data", 
          errors: fromZodError(result.error)
        });
      }
      
      // Check if user already exists
      const existingUser = await storage.getUserByUsername(result.data.username);
      if (existingUser) {
        return res.status(400).json({ message: "Email already in use" });
      }
      
      // Create the user with admin privileges
      const newAdminData = { ...result.data, isAdmin: true };
      
      // Hash the password (auth.ts has the function)
      const hashedPassword = await import("./auth").then(auth => auth.hashPassword(newAdminData.password));
      newAdminData.password = hashedPassword;
      
      const user = await storage.createUser(newAdminData);
      
      // Remove password from response
      const { password, ...safeUser } = user;
      
      res.status(201).json(safeUser);
    } catch (error) {
      console.error("Error creating admin user:", error);
      res.status(500).json({ message: "Failed to create admin user" });
    }
  });

  // Admin-initiated password reset
  app.post("/api/admin/users/:id/reset-password", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const parsed = resetAdminPasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid reset payload",
          errors: fromZodError(parsed.error),
        });
      }

      const targetUser = await storage.getUser(id);
      if (!targetUser || !targetUser.isAdmin) {
        return res.status(404).json({ message: "Admin user not found" });
      }

      const sameCanonicalUsers = await storage.getUsersByCanonicalUsername(targetUser.username);
      const targetUserIds = sameCanonicalUsers.map((user) => user.id);

      const hashedPassword = await import("./auth").then((auth) =>
        auth.hashPassword(parsed.data.newPassword),
      );

      const { db } = await import("./db");
      const { users, authEvents } = await import("@shared/schema");

      await db
        .update(users)
        .set({
          password: hashedPassword,
          failedLoginAttempts: 0,
          lockedUntil: null,
          passwordUpdatedAt: new Date(),
        })
        .where(inArray(users.id, targetUserIds));

      const ip = req.headers["x-forwarded-for"] || req.ip || null;
      const userAgent = req.headers["user-agent"] || null;
      await db.insert(authEvents).values({
        userId: targetUser.id,
        usernameAttempt: targetUser.username,
        eventType: "PASSWORD_RESET_ADMIN",
        ip: typeof ip === "string" ? ip : Array.isArray(ip) ? ip[0] : null,
        userAgent: typeof userAgent === "string" ? userAgent : null,
        metadata: JSON.stringify({
          actorUserId: req.user.id,
          notifyUser: parsed.data.notifyUser ?? true,
          updatedUserIds: targetUserIds,
        }),
      });

      let notificationSent = false;
      if (parsed.data.notifyUser ?? true) {
        notificationSent = await sendEmail({
          to: targetUser.username,
          from: process.env.DEFAULT_FROM_EMAIL?.trim() || "communications@vfwharrisonoh.org",
          subject: "Your admin password was reset",
          text:
            `An administrator reset your password for VFW Post 7570.\n\n` +
            `Temporary password: ${parsed.data.newPassword}\n\n` +
            `Please sign in and update it after logging in.`,
          html: `
            <p>An administrator reset your password for VFW Post 7570.</p>
            <p><strong>Temporary password:</strong> ${parsed.data.newPassword}</p>
            <p>Please sign in and update it after logging in.</p>
          `,
        });
      }

      res.set("Cache-Control", "private, no-store");
      return res.json({
        message: "Password reset successfully",
        notificationSent,
      });
    } catch (error) {
      console.error("Error resetting admin password:", error);
      return res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // One-time helper endpoint: normalize usernames and report collisions
  app.post("/api/admin/users/normalize-usernames", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const { db } = await import("./db");
      const { users } = await import("@shared/schema");
      const allUsers = await db.select({ id: users.id, username: users.username }).from(users);

      const grouped = new Map<string, Array<{ id: number; username: string }>>();
      for (const user of allUsers) {
        const normalized = user.username.trim().toLowerCase();
        const group = grouped.get(normalized) || [];
        group.push(user);
        grouped.set(normalized, group);
      }

      const collisions = Array.from(grouped.entries())
        .filter(([, group]) => group.length > 1)
        .map(([normalized, group]) => ({
          normalized,
          users: group,
        }));

      if (collisions.length > 0) {
        return res.status(409).json({
          message: "Username collisions detected. Resolve duplicates manually first.",
          collisions,
        });
      }

      let updatedCount = 0;
      const changes: Array<{ id: number; from: string; to: string }> = [];
      for (const user of allUsers) {
        const normalized = user.username.trim().toLowerCase();
        if (normalized !== user.username) {
          await db.update(users).set({ username: normalized }).where(eq(users.id, user.id));
          updatedCount += 1;
          changes.push({ id: user.id, from: user.username, to: normalized });
        }
      }

      res.set("Cache-Control", "private, no-store");
      return res.json({
        message: "Usernames normalized",
        updatedCount,
        changes,
      });
    } catch (error) {
      console.error("Error normalizing usernames:", error);
      return res.status(500).json({ message: "Failed to normalize usernames" });
    }
  });

  // Read current admin's email notification preferences
  app.get("/api/admin/notification-preferences", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const { db } = await import("./db");
      const { adminNotificationPreferences } = await import("@shared/schema");

      const rows = await db
        .select({
          receiveAllNotifications: adminNotificationPreferences.receiveAllNotifications,
          enabledCategories: adminNotificationPreferences.enabledCategories,
        })
        .from(adminNotificationPreferences)
        .where(eq(adminNotificationPreferences.userId, req.user.id))
        .limit(1);

      const preference = rows[0];
      return res.json({
        receiveAllNotifications: preference?.receiveAllNotifications ?? true,
        enabledCategories: parseEnabledCategories(preference?.enabledCategories),
      });
    } catch (error) {
      console.error("Error reading notification preferences:", error);
      return res.status(500).json({ message: "Failed to read notification preferences" });
    }
  });

  // Update current admin's email notification preferences
  app.put("/api/admin/notification-preferences", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const parsed = notificationPreferencesSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid notification preferences",
          errors: fromZodError(parsed.error),
        });
      }

      const enabledCategories = Array.from(
        new Set(
          parsed.data.enabledCategories
            .map((slug) => slug.trim().toUpperCase())
            .filter((slug) => slug.length > 0),
        ),
      );

      const payload = {
        userId: req.user.id,
        receiveAllNotifications: parsed.data.receiveAllNotifications,
        enabledCategories: JSON.stringify(enabledCategories),
        updatedAt: new Date(),
      };

      const { db } = await import("./db");
      const { adminNotificationPreferences } = await import("@shared/schema");
      await db
        .insert(adminNotificationPreferences)
        .values(payload)
        .onConflictDoUpdate({
          target: adminNotificationPreferences.userId,
          set: {
            receiveAllNotifications: payload.receiveAllNotifications,
            enabledCategories: payload.enabledCategories,
            updatedAt: payload.updatedAt,
          },
        });

      return res.json({
        receiveAllNotifications: payload.receiveAllNotifications,
        enabledCategories,
      });
    } catch (error) {
      console.error("Error updating notification preferences:", error);
      return res.status(500).json({ message: "Failed to update notification preferences" });
    }
  });

  // ===== Category routes =====

  // Get all categories (public)
  app.get("/api/categories", async (req, res) => {
    try {
      const { db } = await import('./db');
      const allCategories = await db.select().from(categories).orderBy(asc(categories.displayOrder));

      // If no categories exist, seed with defaults
      if (allCategories.length === 0) {
        const defaults = [
          { name: "Food", slug: "FOOD", icon: "ShoppingCart", displayOrder: 0, isEvent: false },
          { name: "Clothing", slug: "CLOTHING", icon: "Shirt", displayOrder: 1, isEvent: false },
          { name: "Service", slug: "SERVICE", icon: "Users", displayOrder: 2, isEvent: false },
          { name: "Education", slug: "EDUCATION", icon: "BookOpen", displayOrder: 3, isEvent: false },
          { name: "Housing", slug: "HOUSING", icon: "Home", displayOrder: 4, isEvent: false },
          { name: "Events", slug: "EVENT", icon: "Calendar", displayOrder: 5, isEvent: true },
          { name: "Other", slug: "OTHER", icon: "Heart", displayOrder: 6, isEvent: false },
        ];
        const inserted = await db.insert(categories).values(defaults).returning();
        res.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
        return res.json(inserted);
      }

      // Edge-cache public read for 60s (categories change rarely)
      res.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
      res.json(allCategories);
    } catch (error) {
      console.error("Error getting categories:", error);
      res.status(500).json({ message: "Failed to retrieve categories" });
    }
  });

  // Create a category (admin only)
  app.post("/api/categories", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const result = insertCategorySchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid data", errors: fromZodError(result.error) });
      }
      const { db } = await import('./db');
      const [created] = await db.insert(categories).values(result.data).returning();
      res.status(201).json(created);
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(500).json({ message: "Failed to create category" });
    }
  });

  // Update a category (admin only)
  app.put("/api/categories/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const id = parseInt(req.params.id);
      const { db } = await import('./db');
      const [updated] = await db
        .update(categories)
        .set({ name: req.body.name, slug: req.body.slug, icon: req.body.icon, isEvent: req.body.isEvent ?? false })
        .where(eq(categories.id, id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Category not found" });
      res.json(updated);
    } catch (error) {
      console.error("Error updating category:", error);
      res.status(500).json({ message: "Failed to update category" });
    }
  });

  // Delete a category (admin only)
  app.delete("/api/categories/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const id = parseInt(req.params.id);
      const { db } = await import('./db');
      const [deleted] = await db.delete(categories).where(eq(categories.id, id)).returning();
      if (!deleted) return res.status(404).json({ message: "Category not found" });
      res.json({ message: "Category deleted" });
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ message: "Failed to delete category" });
    }
  });

  // Reorder categories (admin only)
  app.post("/api/categories/reorder", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const { order } = req.body; // Array of { id, displayOrder }
      if (!Array.isArray(order)) {
        return res.status(400).json({ message: "Invalid order data" });
      }
      const { db } = await import('./db');
      for (const item of order) {
        await db.update(categories).set({ displayOrder: item.displayOrder }).where(eq(categories.id, item.id));
      }
      const updated = await db.select().from(categories).orderBy(asc(categories.displayOrder));
      res.json(updated);
    } catch (error) {
      console.error("Error reordering categories:", error);
      res.status(500).json({ message: "Failed to reorder categories" });
    }
  });

  // Reorder needs (admin only)
  app.post("/api/needs/reorder", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const { order } = req.body; // Array of { id, displayOrder }
      if (!Array.isArray(order)) {
        return res.status(400).json({ message: "Invalid order data" });
      }
      const { db } = await import('./db');
      const { needs } = await import('@shared/schema');
      for (const item of order) {
        await db.update(needs).set({ displayOrder: item.displayOrder }).where(eq(needs.id, item.id));
      }
      res.json({ message: "Order updated" });
    } catch (error) {
      console.error("Error reordering needs:", error);
      res.status(500).json({ message: "Failed to reorder needs" });
    }
  });

  // Get all needs
  app.get("/api/needs", async (req, res) => {
    try {
      await storage.markExpiredFloatingNeedsUnfulfilled();
      await storage.markExpiredEventNeedsFulfilled();
      const allNeeds = await storage.getAllNeeds();
      const isAdminRequest = req.isAuthenticated() && req.user?.isAdmin;

      // Keep drafts/admin-only data private. Public users should only receive
      // published needs and can be edge-cached.
      const visibleNeeds = isAdminRequest
        ? allNeeds
        : allNeeds.filter((need) => !isNeedHiddenFromPublic(need));

      if (isAdminRequest) {
        res.set("Cache-Control", "private, no-store");
      } else {
        res.set("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
      }

      res.json(visibleNeeds);
    } catch (error) {
      console.error("Error getting needs:", error);
      res.status(500).json({ message: "Failed to retrieve needs" });
    }
  });

  // Get a single need by ID
  app.get("/api/needs/:id", async (req, res) => {
    try {
      await storage.markExpiredFloatingNeedsUnfulfilled();
      await storage.markExpiredEventNeedsFulfilled();
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid need ID" });
      }

      const need = await storage.getNeed(id);
      if (!need) {
        return res.status(404).json({ message: "Need not found" });
      }

      const isAdminRequest = req.isAuthenticated() && req.user?.isAdmin;
      if (
        !isAdminRequest &&
        (need.status === NeedStatus.DRAFT || need.status === NeedStatus.UNFULFILLED)
      ) {
        return res.status(404).json({ message: "Need not found" });
      }

      if (isAdminRequest) {
        res.set("Cache-Control", "private, no-store");
      } else {
        res.set("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
      }

      res.json(need);
    } catch (error) {
      console.error("Error getting need:", error);
      res.status(500).json({ message: "Failed to retrieve need" });
    }
  });

  // Get event roles for a need, including fill stats (public for published needs)
  app.get("/api/needs/:id/event-roles", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid need ID" });
      }

      const need = await storage.getNeed(id);
      if (!need) {
        return res.status(404).json({ message: "Need not found" });
      }

      const isAdminRequest = req.isAuthenticated() && req.user?.isAdmin;
      if (
        !isAdminRequest &&
        (need.status === NeedStatus.DRAFT || need.status === NeedStatus.UNFULFILLED)
      ) {
        return res.status(404).json({ message: "Need not found" });
      }

      const roles = await storage.getEventRolesWithStatsByNeedId(id, Boolean(isAdminRequest));
      const visibleRoles = isAdminRequest
        ? roles
        : roles.filter((role) => !isEventRoleHiddenFromPublic(need, role));
      if (isAdminRequest) {
        res.set("Cache-Control", "private, no-store");
      } else {
        res.set("Cache-Control", "public, s-maxage=15, stale-while-revalidate=30");
      }
      return res.json(visibleRoles);
    } catch (error) {
      console.error("Error getting event roles:", error);
      return res.status(500).json({ message: "Failed to retrieve event roles" });
    }
  });

  // Get event signup summary (slots + unique people).
  app.get("/api/needs/:id/event-signup-summary", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid need ID" });
      }

      const need = await storage.getNeed(id);
      if (!need) {
        return res.status(404).json({ message: "Need not found" });
      }

      const isAdminRequest = req.isAuthenticated() && req.user?.isAdmin;
      if (
        !isAdminRequest &&
        (need.status === NeedStatus.DRAFT || need.status === NeedStatus.UNFULFILLED)
      ) {
        return res.status(404).json({ message: "Need not found" });
      }

      const summary = await storage.getEventSignupSummaryByNeedId(id);
      if (isAdminRequest) {
        res.set("Cache-Control", "private, no-store");
      } else {
        res.set("Cache-Control", "public, s-maxage=15, stale-while-revalidate=30");
      }
      return res.json(summary);
    } catch (error) {
      console.error("Error getting event signup summary:", error);
      return res.status(500).json({ message: "Failed to retrieve event signup summary" });
    }
  });

  // Create a new need (protected route)
  app.post("/api/needs", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      // Log request body to debug recipient info
      console.log('POST /api/needs - Request Body:', JSON.stringify({
        title: req.body.title,
        recipientName: req.body.recipientName,
        recipientPhone: req.body.recipientPhone,
        recipientEmail: req.body.recipientEmail,
        recipientAddress: req.body.recipientAddress,
        recipientNotes: req.body.recipientNotes
      }, null, 2));

      const result = needMutationSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: "Invalid need data", 
          errors: fromZodError(result.error)
        });
      }

      const validationError = validateEventNeedPayload(result.data);
      if (validationError) {
        return res.status(400).json({ message: validationError });
      }

      // Check if a status was specified in the request body for creating draft needs
      const status = req.body.status ? req.body.status as NeedStatus : undefined;
      const normalizedPayload = normalizeNeedMutationPayload(result.data);
      const need = await storage.createNeed(normalizedPayload, status);

      try {
        await enqueueCalendarSyncForNeedTransition(null, need);
      } catch (syncError) {
        console.error("Failed to enqueue calendar sync after need create:", syncError);
      }

      res.status(201).json(need);
    } catch (error) {
      console.error("Error creating need:", error);
      res.status(500).json({ message: "Failed to create need" });
    }
  });

  // Toggle need highlighted status (protected route)
  app.patch("/api/needs/:id/highlight", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid need ID" });
      }

      // Get the need
      const existingNeed = await storage.getNeed(id);
      if (!existingNeed) {
        return res.status(404).json({ message: "Need not found" });
      }
      
      // Toggle the highlighted status
      const isHighlighted = !existingNeed.isHighlighted;
      
      // Update the need with the new highlighted status
      const { db } = await import('./db');
      const { needs } = await import('@shared/schema');
      const [updatedNeed] = await db
        .update(needs)
        .set({ isHighlighted })
        .where(eq(needs.id, id))
        .returning();
      
      if (!updatedNeed) {
        return res.status(500).json({ message: "Failed to update need highlighted status" });
      }
      
      res.json(updatedNeed);
    } catch (error) {
      console.error("Error toggling need highlight status:", error);
      res.status(500).json({ message: "Failed to update need highlighted status" });
    }
  });

  // Update need status (protected route)
  app.patch("/api/needs/:id/status", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid need ID" });
      }

      const { status } = req.body;
      if (!Object.values(NeedStatus).includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      // Get the need before update to check its current status
      const existingNeed = await storage.getNeed(id);
      if (!existingNeed) {
        return res.status(404).json({ message: "Need not found" });
      }
      
      // Update need status
      const updatedNeed = await storage.updateNeedStatus(id, status);
      if (!updatedNeed) {
        return res.status(404).json({ message: "Failed to update need status" });
      }

      try {
        await enqueueCalendarSyncForNeedTransition(existingNeed, updatedNeed);
      } catch (syncError) {
        console.error("Failed to enqueue calendar sync after status update:", syncError);
      }
      
      // Send email notification if status changed from FLOATING to PLEDGED
      if (existingNeed.status === NeedStatus.FLOATING && status === NeedStatus.PLEDGED) {
        try {
          // Get the latest pledges for this need
          const pledges = await storage.getPledgesByNeedId(id);
          
          if (pledges.length > 0) {
            // Get the most recent pledge (the one that triggered the status change)
            const latestPledge = pledges.sort((a, b) => 
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )[0];
            
            const adminEmails = await getAdminsForNotification(updatedNeed);
            if (adminEmails.length > 0) {
              // Send notification email
              await sendPledgeNotification(updatedNeed, latestPledge, adminEmails);
              console.log(`Sent pledge notification emails to ${adminEmails.length} admin(s)`);
            }
          }
        } catch (emailError) {
          // Log the error but don't fail the request
          console.error("Error sending notification email:", emailError);
        }
      }

      res.json(updatedNeed);
    } catch (error) {
      console.error("Error updating need status:", error);
      res.status(500).json({ message: "Failed to update need status" });
    }
  });

  // Update a need (protected route)
  app.put("/api/needs/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const withTimeout = async <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          return await Promise.race([
            promise,
            new Promise<T>((_, reject) => {
              timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
            }),
          ]);
        } finally {
          if (timer) clearTimeout(timer);
        }
      };

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid need ID" });
      }

      // Check if need exists
      const existingNeed = await withTimeout(storage.getNeed(id), 12_000, "Load need");
      if (!existingNeed) {
        return res.status(404).json({ message: "Need not found" });
      }

      // Log request body to see what's being received
      console.log('PUT /api/needs/:id - Request Body:', JSON.stringify({
        title: req.body.title,
        recipientName: req.body.recipientName,
        recipientPhone: req.body.recipientPhone,
        recipientEmail: req.body.recipientEmail,
        recipientAddress: req.body.recipientAddress,
        recipientNotes: req.body.recipientNotes
      }, null, 2));

      // Validate request data
      const result = needMutationSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: "Invalid need data", 
          errors: fromZodError(result.error)
        });
      }

      const validationError = validateEventNeedPayload(result.data);
      if (validationError) {
        return res.status(400).json({ message: validationError });
      }

      // Get the status from request body or keep existing
      const status = req.body.status ? req.body.status as NeedStatus : existingNeed.status;
      const normalizedPayload = normalizeNeedMutationPayload(result.data);

      // Update the need with validated data, preserving the resolved status
      const updatedNeed = await withTimeout(
        storage.updateNeed(id, { ...normalizedPayload, status }),
        15_000,
        "Save need"
      );

      if (!updatedNeed) {
        return res.status(404).json({ message: "Need not found" });
      }

      try {
        await enqueueCalendarSyncForNeedTransition(existingNeed, updatedNeed);
      } catch (syncError) {
        console.error("Failed to enqueue calendar sync after need update:", syncError);
      }
      
      res.json(updatedNeed);
    } catch (error) {
      console.error("Error updating need:", error);
      res.status(500).json({ message: "Failed to update need" });
    }
  });

  app.delete("/api/needs/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid need ID" });
      }

      const existingNeed = await storage.getNeed(id);
      if (!existingNeed) {
        return res.status(404).json({ message: "Need not found" });
      }

      const success = await storage.deleteNeed(id);
      if (!success) {
        return res.status(404).json({ message: "Need not found" });
      }

      try {
        await enqueueCalendarSyncForNeedTransition(existingNeed, null);
      } catch (syncError) {
        console.error("Failed to enqueue calendar sync delete:", syncError);
      }

      res.status(204).end();
    } catch (error) {
      console.error("Error deleting need:", error);
      res.status(500).json({ message: "Failed to delete need" });
    }
  });

  // Create a pledge
  app.post("/api/pledges", async (req, res) => {
    try {
      const result = pledgeMutationSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: "Invalid pledge data", 
          errors: fromZodError(result.error)
        });
      }

      const need = await storage.getNeed(result.data.needId);
      if (!need) {
        return res.status(404).json({ message: "Need not found" });
      }

      if (result.data.donationType === "money") {
        return res.status(400).json({ message: "Financial contributions are not accepted through this app." });
      }

      if (need.needType !== NeedType.EVENT && result.data.donationType === "signup") {
        return res.status(400).json({ message: "Sign-up pledges are only valid for event needs." });
      }

      const allowsAdditionalGroupSignup =
        need.needType === NeedType.GROUP && need.status === NeedStatus.PLEDGED;

      if (need.needType === NeedType.EVENT && isEventHiddenFromPublic(need)) {
        return res.status(400).json({ message: "This event has ended and is no longer accepting sign-ups." });
      }

      if (!allowsAdditionalGroupSignup && need.status !== NeedStatus.FLOATING && need.status !== NeedStatus.RECURRING) {
        return res.status(400).json({ message: "This need has already been pledged or fulfilled" });
      }

      const pledgePayload =
        need.needType === NeedType.EVENT
          ? { ...result.data, donationType: "signup" as const }
          : result.data;

      // Create the pledge
      const pledge: PledgeWithEventRoles = await storage.createPledge(pledgePayload);

      // Create a copy of the response to be sent
      const responseData = { ...pledge };

      try {
        // Send confirmation email to the donor
        await sendPledgeConfirmation(need, pledge);
        console.log(`Confirmation email sent to donor: ${pledge.email}`);
        
        // If user opted in for email subscription, add them to MailerLite
        if (pledge.subscribeToEmails) {
          try {
            const subscriptionResult = await addSubscriber(
              pledge.email,
              pledge.firstName,
              pledge.lastName
            );
            
            if (subscriptionResult) {
              console.log(`Added ${pledge.email} to MailerLite subscribers`);
            } else {
              console.warn(`Failed to add ${pledge.email} to MailerLite subscribers`);
            }
          } catch (subscribeError) {
            console.error('Error subscribing to MailerLite:', subscribeError);
            // Don't throw error so pledge processing continues
          }
        }
        
        // Only update status to PLEDGED for non-recurring, non-group needs
        // (GROUP needs have their status managed in storage.createPledge based on volunteer limits)
        if (
          need.status === NeedStatus.FLOATING &&
          need.needType !== NeedType.GROUP &&
          need.needType !== NeedType.EVENT
        ) {
          // Update the need status
          const updatedNeed = await storage.updateNeedStatus(need.id, NeedStatus.PLEDGED);
          
          if (updatedNeed) {
            const adminEmails = await getAdminsForNotification(updatedNeed);
            if (adminEmails.length > 0) {
              // Send notification email with new pledge information
              await sendPledgeNotification(updatedNeed, pledge, adminEmails);
              console.log(`Pledge created, need status updated, and notification sent to ${adminEmails.length} admin(s)`);
            }
          }
        } else if (
          need.status === NeedStatus.RECURRING ||
          need.needType === NeedType.GROUP ||
          need.needType === NeedType.EVENT
        ) {
          // Re-fetch group/event need to get updated status/count from storage.createPledge
          const currentNeed = need.needType === NeedType.GROUP || need.needType === NeedType.EVENT
            ? (await storage.getNeed(need.id)) || need
            : need;

          const adminEmails = await getAdminsForNotification(currentNeed);
          if (adminEmails.length > 0) {
            await sendPledgeNotification(currentNeed, pledge, adminEmails);
            const label =
              need.needType === NeedType.GROUP
                ? "Group"
                : need.needType === NeedType.EVENT
                  ? "Event"
                  : "Recurring";
            console.log(`${label} need pledge created and notification sent to ${adminEmails.length} admin(s)`);
          }
        }
      } catch (error) {
        // Log the error but continue with the response
        console.error("Error processing pledge:", error);
      }
      
      res.status(201).json(responseData);
    } catch (error) {
      if (error instanceof EventSlotConflictError || error instanceof EventSignupValidationError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      console.error("Error creating pledge:", error);
      res.status(500).json({ message: "Failed to create pledge" });
    }
  });

  // Get pledges for a need (protected route)
  app.get("/api/needs/:id/pledges", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid need ID" });
      }

      // Set cache control headers to prevent caching of pledge data
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      const pledges = await storage.getPledgesByNeedId(id);
      const selectionsByPledgeId = await storage.getEventRoleSelectionsByPledgeIds(
        pledges.map((pledge) => pledge.id),
      );
      const pledgesWithSelections = pledges.map((pledge) => ({
        ...pledge,
        selectedEventRoles: selectionsByPledgeId.get(pledge.id) || [],
      }));
      console.log(`Fetched ${pledgesWithSelections.length} pledges for need ID ${id}`);
      res.json(pledgesWithSelections);
    } catch (error) {
      console.error("Error getting pledges:", error);
      res.status(500).json({ message: "Failed to retrieve pledges" });
    }
  });
  
  // Get all pledges grouped by need ID (protected route)
  app.get("/api/all-pledges", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }

      // Set cache control headers to prevent caching
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      // Single query to fetch ALL pledges (instead of N+1 per-need queries)
      const { db } = await import('./db');
      const { pledges } = await import('@shared/schema');
      const allPledges = await db.select().from(pledges);
      const selectionsByPledgeId = await storage.getEventRoleSelectionsByPledgeIds(
        allPledges.map((pledge) => pledge.id),
      );
      const allPledgesWithSelections = allPledges.map((pledge) => ({
        ...pledge,
        selectedEventRoles: selectionsByPledgeId.get(pledge.id) || [],
      }));

      // Group in JavaScript — fast since data is already in memory
      const pledgesByNeedId: Record<string, PledgeWithEventRoles[]> = {};
      for (const pledge of allPledgesWithSelections) {
        const key = String(pledge.needId);
        if (!pledgesByNeedId[key]) pledgesByNeedId[key] = [];
        pledgesByNeedId[key].push(pledge);
      }

      res.json(pledgesByNeedId);
    } catch (error) {
      console.error("Error getting all pledges:", error);
      res.status(500).json({ message: "Failed to retrieve all pledges" });
    }
  });

  app.get("/api/event-signup/manage/:token", async (req, res) => {
    try {
      const token = req.params.token;
      if (!token) {
        return res.status(400).json({ valid: false, message: "No token provided." });
      }

      const { needId: pledgeId, action, valid } = verifySecureToken(token);
      if (!valid || action !== "manage_signup") {
        return res.status(200).json({
          valid: false,
          message: "This sign-up link is no longer valid. It may have expired.",
        });
      }

      const pledge = await storage.getPledge(pledgeId);
      if (!pledge) {
        return res.status(200).json({
          valid: false,
          message: "The sign-up record could not be found.",
        });
      }

      const need = await storage.getNeed(pledge.needId);
      if (!need || need.needType !== NeedType.EVENT) {
        return res.status(200).json({
          valid: false,
          message: "This sign-up can only be managed for event needs.",
        });
      }

      const selectedByPledge = await storage.getEventRoleSelectionsByPledgeIds([pledge.id]);
      const selectedEventRoles = selectedByPledge.get(pledge.id) || [];
      const availableRoles = await storage.getEventRolesWithStatsByNeedId(need.id, false);

      res.set("Cache-Control", "private, no-store");
      return res.status(200).json({
        valid: true,
        pledge: {
          id: pledge.id,
          firstName: pledge.firstName,
          lastName: pledge.lastName,
          email: pledge.email,
          phone: pledge.phone,
          organization: pledge.organization,
          notes: pledge.notes,
          selectedRoleIds: selectedEventRoles.map((role) => role.id),
          selectedEventRoles,
        },
        need: {
          id: need.id,
          title: need.title,
          eventDate: need.eventDate,
          eventLocation: need.eventLocation,
          status: need.status,
        },
        availableRoles,
      });
    } catch (error) {
      console.error("Error loading event sign-up management payload:", error);
      return res.status(500).json({
        valid: false,
        message: "An error occurred while loading your sign-up details.",
      });
    }
  });

  app.post("/api/event-signup/manage/update", async (req, res) => {
    try {
      const parsed = eventSignupManageUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid sign-up data",
          errors: fromZodError(parsed.error),
        });
      }

      const { token, ...updates } = parsed.data;
      const { needId: pledgeId, action, valid } = verifySecureToken(token);
      if (!valid || action !== "manage_signup") {
        return res.status(400).json({
          message: "Invalid or expired sign-up link. Please use the latest email link.",
        });
      }

      const updatedPledge = await storage.updateEventSignupByPledgeId(pledgeId, updates);
      const updatedNeed = await storage.getNeed(updatedPledge.needId);
      statsCache = null;

      if (updatedNeed) {
        try {
          await sendEventSignupChangeNotifications(updatedNeed, updatedPledge, "updated");
        } catch (notificationError) {
          console.error("Error sending event sign-up update notifications:", notificationError);
        }
      }

      return res.status(200).json({
        success: true,
        message: "Your sign-up details were updated.",
        pledge: updatedPledge,
        need: updatedNeed
          ? {
              id: updatedNeed.id,
              title: updatedNeed.title,
              status: updatedNeed.status,
            }
          : null,
      });
    } catch (error) {
      if (error instanceof EventSlotConflictError || error instanceof EventSignupValidationError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      console.error("Error updating managed event sign-up:", error);
      return res.status(500).json({ message: "Failed to update sign-up details." });
    }
  });

  app.post("/api/event-signup/manage/cancel", async (req, res) => {
    try {
      const parsed = eventSignupManageCancelSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid request",
          errors: fromZodError(parsed.error),
        });
      }

      const { token } = parsed.data;
      const { needId: pledgeId, action, valid } = verifySecureToken(token);
      if (!valid || action !== "manage_signup") {
        return res.status(400).json({
          message: "Invalid or expired sign-up link. Please use the latest email link.",
        });
      }

      const existingPledge = await storage.getPledge(pledgeId);
      let canceledPledgeForEmail: PledgeWithEventRoles | null = null;
      let needForEmail = existingPledge ? await storage.getNeed(existingPledge.needId) : undefined;

      if (existingPledge) {
        const selectedByPledge = await storage.getEventRoleSelectionsByPledgeIds([existingPledge.id]);
        canceledPledgeForEmail = {
          ...existingPledge,
          selectedEventRoles: selectedByPledge.get(existingPledge.id) || [],
        };
      }

      const updatedNeed = await storage.cancelEventSignupByPledgeId(pledgeId);
      statsCache = null;

      if (!needForEmail) {
        needForEmail = updatedNeed;
      }
      if (needForEmail && canceledPledgeForEmail) {
        try {
          await sendEventSignupChangeNotifications(needForEmail, canceledPledgeForEmail, "canceled");
        } catch (notificationError) {
          console.error("Error sending event sign-up cancellation notifications:", notificationError);
        }
      }

      return res.status(200).json({
        success: true,
        message: "Your event sign-up has been canceled.",
        need: {
          id: updatedNeed.id,
          title: updatedNeed.title,
          status: updatedNeed.status,
        },
      });
    } catch (error) {
      if (error instanceof EventSlotConflictError || error instanceof EventSignupValidationError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      console.error("Error canceling managed event sign-up:", error);
      return res.status(500).json({ message: "Failed to cancel sign-up." });
    }
  });

  app.patch("/api/admin/event-signups/:pledgeId", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const pledgeId = parseInt(req.params.pledgeId);
      if (Number.isNaN(pledgeId) || pledgeId <= 0) {
        return res.status(400).json({ message: "Invalid sign-up ID" });
      }

      const parsed = adminEventSignupUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid sign-up data",
          errors: fromZodError(parsed.error),
        });
      }

      const updatedPledge = await storage.updateEventSignupByPledgeId(pledgeId, parsed.data);
      const updatedNeed = await storage.getNeed(updatedPledge.needId);
      statsCache = null;

      if (updatedNeed) {
        try {
          await sendEventSignupChangeNotifications(updatedNeed, updatedPledge, "updated");
        } catch (notificationError) {
          console.error("Error sending admin-managed event sign-up update notifications:", notificationError);
        }
      }

      return res.status(200).json({
        success: true,
        message: "Sign-up updated successfully.",
        pledge: updatedPledge,
        need: updatedNeed
          ? {
              id: updatedNeed.id,
              title: updatedNeed.title,
              status: updatedNeed.status,
            }
          : null,
      });
    } catch (error) {
      if (error instanceof EventSlotConflictError || error instanceof EventSignupValidationError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      console.error("Error updating admin event sign-up:", error);
      return res.status(500).json({ message: "Failed to update sign-up." });
    }
  });

  app.delete("/api/admin/event-signups/:pledgeId", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const pledgeId = parseInt(req.params.pledgeId);
      if (Number.isNaN(pledgeId) || pledgeId <= 0) {
        return res.status(400).json({ message: "Invalid sign-up ID" });
      }

      const existingPledge = await storage.getPledge(pledgeId);
      let canceledPledgeForEmail: PledgeWithEventRoles | null = null;
      let needForEmail = existingPledge ? await storage.getNeed(existingPledge.needId) : undefined;

      if (existingPledge) {
        const selectedByPledge = await storage.getEventRoleSelectionsByPledgeIds([existingPledge.id]);
        canceledPledgeForEmail = {
          ...existingPledge,
          selectedEventRoles: selectedByPledge.get(existingPledge.id) || [],
        };
      }

      const updatedNeed = await storage.cancelEventSignupByPledgeId(pledgeId);
      statsCache = null;

      if (!needForEmail) {
        needForEmail = updatedNeed;
      }
      if (needForEmail && canceledPledgeForEmail) {
        try {
          await sendEventSignupChangeNotifications(needForEmail, canceledPledgeForEmail, "canceled");
        } catch (notificationError) {
          console.error("Error sending admin-managed event sign-up cancellation notifications:", notificationError);
        }
      }

      return res.status(200).json({
        success: true,
        message: "Sign-up removed successfully.",
        need: {
          id: updatedNeed.id,
          title: updatedNeed.title,
          status: updatedNeed.status,
        },
      });
    } catch (error) {
      if (error instanceof EventSlotConflictError || error instanceof EventSignupValidationError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      console.error("Error removing admin event sign-up:", error);
      return res.status(500).json({ message: "Failed to remove sign-up." });
    }
  });
  
  // Verify token and provide token info
  app.get("/api/verify-token/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      if (!token) {
        return res.status(400).json({ valid: false, message: "No token provided" });
      }
      
      // Verify the token
      const { needId, action, valid } = verifySecureToken(token);
      
      // If token is invalid, return error
      if (!valid) {
        return res.status(200).json({ 
          valid: false, 
          message: "This link is no longer valid. It may have expired or already been used."
        });
      }
      
      // Get need information
      const need = await storage.getNeed(needId);
      
      if (!need) {
        return res.status(200).json({ 
          valid: false, 
          message: "The requested need could not be found in our system." 
        });
      }
      
      // Return token information
      return res.status(200).json({
        valid: true,
        needId,
        action,
        need: {
          id: need.id,
          title: need.title,
          category: need.category,
          status: need.status
        }
      });
    } catch (error) {
      console.error("Error verifying token:", error);
      return res.status(500).json({ 
        valid: false, 
        message: "An error occurred while verifying the token." 
      });
    }
  });
  
  // Action endpoint for fulfilling needs via token (API endpoint for AJAX calls)
  app.post("/api/fulfill-need", async (req, res) => {
    try {
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({ success: false, message: "No token provided" });
      }
      
      // Verify the token
      const { needId, action, valid } = verifySecureToken(token);
      
      // If token is invalid, return error
      if (!valid) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid or expired token. Please request a new one." 
        });
      }
      
      // Process the action
      if (action === 'fulfill' && needId > 0) {
        // Get the need
        const need = await storage.getNeed(needId);
        
        if (!need) {
          return res.status(404).json({ 
            success: false, 
            message: "Need not found" 
          });
        }
        
        // Check if need is in proper state to be fulfilled
        const canFulfillFromEmail =
          need.status === NeedStatus.PLEDGED ||
          need.status === NeedStatus.RECURRING ||
          (need.needType === NeedType.GROUP && need.status === NeedStatus.FLOATING);

        if (!canFulfillFromEmail) {
          return res.status(400).json({ 
            success: false, 
            message: `This need cannot be fulfilled because it is in ${need.status} state.`
          });
        }
        
        // Update the need to FULFILLED
        const updatedNeed = await storage.updateNeedStatus(needId, NeedStatus.FULFILLED);
        
        if (!updatedNeed) {
          return res.status(500).json({ 
            success: false, 
            message: "Failed to update need status" 
          });
        }

        try {
          await enqueueCalendarSyncForNeedTransition(need, updatedNeed);
        } catch (syncError) {
          console.error("Failed to enqueue calendar sync after token fulfill:", syncError);
        }
        
        // Return success response
        return res.status(200).json({
          success: true,
          message: "Need successfully marked as fulfilled!",
          need: {
            id: updatedNeed.id,
            title: updatedNeed.title,
            category: updatedNeed.category,
            status: updatedNeed.status
          }
        });
      } else {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid action specified in token" 
        });
      }
    } catch (error) {
      console.error("Error fulfilling need:", error);
      return res.status(500).json({ 
        success: false, 
        message: "An error occurred while processing your request." 
      });
    }
  });

  // Duplicate a need to a draft (protected route)
  app.post("/api/needs/:id/duplicate", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid need ID" });
      }

      // Get the original need
      const originalNeed = await storage.getNeed(id);
      if (!originalNeed) {
        return res.status(404).json({ message: "Need not found" });
      }

      const originalEventRoles =
        originalNeed.needType === NeedType.EVENT
          ? await storage.getEventRolesByNeedId(originalNeed.id, true)
          : [];

      // Create a new need based on the original, but with a DRAFT status
      const { id: _, ...needData } = originalNeed;
      const newNeed = await storage.createNeed({
        ...needData,
        title: `${originalNeed.title} (Copy)`,
        eventRoles: originalEventRoles.map((role) => ({
          name: role.name,
          slotDate: role.slotDate,
          startTime: role.startTime,
          endTime: role.endTime,
          capacity: role.capacity,
          displayOrder: role.displayOrder,
          isActive: role.isActive,
        })),
      }, NeedStatus.DRAFT);

      res.status(201).json(newNeed);
    } catch (error) {
      console.error("Error duplicating need:", error);
      res.status(500).json({ message: "Failed to duplicate need" });
    }
  });
  
  // Image upload for needs (protected route)
  app.post("/api/upload/image", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      if (!req.body || !req.body.image) {
        return res.status(400).json({ message: "No image data provided" });
      }
      
      // Extract the base64 data and file type
      const imageData = req.body.image;
      const matches = imageData.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
      
      if (!matches || matches.length !== 3) {
        return res.status(400).json({ message: "Invalid image data format" });
      }
      
      const fileType = matches[1];
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Check file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(fileType)) {
        return res.status(400).json({ 
          message: "Invalid file type. Allowed types: JPEG, PNG, GIF, WebP" 
        });
      }
      
      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      // Generate a unique filename
      const extension = fileType.split('/')[1];
      const filename = `${randomUUID()}.${extension}`;
      const filepath = path.join(uploadsDir, filename);
      
      // Write the file
      fs.writeFileSync(filepath, buffer);
      
      // Return the URL to access the file
      const fileUrl = `/uploads/${filename}`;
      res.status(201).json({ url: fileUrl });
    } catch (error) {
      console.error("Error uploading image:", error);
      res.status(500).json({ message: "Failed to upload image" });
    }
  });
  
  // Dashboard stats endpoint (admin only)
  app.get("/api/stats", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        res.set("Cache-Control", "private, no-store");
        return res.status(403).json({ message: "Not authorized" });
      }

      res.set("Cache-Control", "private, no-store");

      // Return cached result if still fresh
      if (statsCache && (Date.now() - statsCache.timestamp) < STATS_CACHE_TTL) {
        return res.json(statsCache.data);
      }

      const { db } = await import('./db');
      const { pledges } = await import('@shared/schema');

      const withTimeout = async <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          return await Promise.race([
            promise,
            new Promise<T>((_, reject) => {
              timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
            }),
          ]);
        } finally {
          if (timer) clearTimeout(timer);
        }
      };

      // IMPORTANT: run sequentially to avoid possible connection contention
      // on single-connection serverless poolers.
      const allNeeds = await withTimeout(storage.getAllNeeds(), 12_000, "Needs query");
      const allPledges = await withTimeout(db.select().from(pledges), 12_000, "Pledges query");

      const published = allNeeds.filter(n => n.status !== NeedStatus.DRAFT && n.status !== NeedStatus.UNFULFILLED);

      // Status counts
      const totalProjects = published.length;
      const openNeeds = published.filter(n => n.status === NeedStatus.FLOATING || n.status === NeedStatus.RECURRING).length;
      const pledgedNeeds = published.filter(n => n.status === NeedStatus.PLEDGED).length;
      const fulfilledNeeds = published.filter(n => n.status === NeedStatus.FULFILLED).length;
      const unfulfilledNeeds = allNeeds.filter(n => n.status === NeedStatus.UNFULFILLED).length;
      const recurringNeeds = published.filter(n => n.status === NeedStatus.RECURRING).length;
      const draftNeeds = allNeeds.filter(n => n.status === NeedStatus.DRAFT).length;

      // Pledge stats
      const totalPledges = allPledges.length;
      const uniqueDonors = new Set(allPledges.map(p => p.email.toLowerCase())).size;

      // Demographic counts
      const widows = published.filter(n => n.recipientIsWidow === true).length;
      const singleParents = published.filter(n => n.recipientIsSingleParent === true).length;

      // Government assistance counts
      const govAssistance = {
        medicaid: published.filter(n => n.recipientMedicaid === true).length,
        medicare: published.filter(n => n.recipientMedicare === true).length,
        socialSecurity: published.filter(n => n.recipientSocialSecurity === true).length,
        snap: published.filter(n => n.recipientSnap === true).length,
        disability: published.filter(n => n.recipientDisability === true).length,
      };

      // Age distribution (from DOB)
      const ageRanges = { under18: 0, '18-34': 0, '35-54': 0, '55-64': 0, '65plus': 0, unknown: 0 };
      const now = new Date();
      for (const n of published) {
        if (n.recipientDob) {
          const dob = new Date(n.recipientDob);
          const age = Math.floor((now.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
          if (age < 18) ageRanges.under18++;
          else if (age < 35) ageRanges['18-34']++;
          else if (age < 55) ageRanges['35-54']++;
          else if (age < 65) ageRanges['55-64']++;
          else ageRanges['65plus']++;
        } else {
          ageRanges.unknown++;
        }
      }

      // Needs by category
      const categoryMap: Record<string, number> = {};
      for (const n of published) {
        categoryMap[n.category] = (categoryMap[n.category] || 0) + 1;
      }
      const needsByCategory = Object.entries(categoryMap)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count);

      // Recent pledges (last 5) — build needId→title lookup map instead of .find() per pledge
      const needTitleMap = new Map(allNeeds.map(n => [n.id, n.title]));
      const recentPledges = allPledges
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5)
        .map(p => ({
          id: p.id,
          name: `${p.firstName} ${p.lastName}`,
          needTitle: needTitleMap.get(p.needId) || 'Unknown',
          needId: p.needId,
          donationType: p.donationType,
          date: p.createdAt,
        }));

      const result = {
        totalProjects,
        openNeeds,
        pledgedNeeds,
        fulfilledNeeds,
        unfulfilledNeeds,
        recurringNeeds,
        draftNeeds,
        totalPledges,
        uniqueDonors,
        demographics: {
          widows,
          singleParents,
          govAssistance,
          ageRanges,
        },
        needsByCategory,
        recentPledges,
      };

      // Cache the result
      statsCache = { data: result, timestamp: Date.now() };

      res.json(result);
    } catch (error) {
      console.error("Error getting stats:", error);
      res.status(500).json({ message: "Failed to retrieve stats" });
    }
  });

  // MailerLite connection status (admin only)
  app.get("/api/email/status", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const apiKey = process.env.MAILERLITE_API_KEY;
      const mailerliteGroupId = process.env.MAILERLITE_SUPPORTERS_GROUP_ID;
      const mailersendToken = process.env.MAILERSEND_API_TOKEN || process.env.MAILERSEND_API_KEY;
      // MailerLite subscriber count
      let mailerliteConnected = false;
      let subscriberCount = 0;
      let groupName = '';

      if (apiKey && mailerliteGroupId) {
        try {
          const groupRes = await fetch(`https://api.mailerlite.com/api/v2/groups/${mailerliteGroupId}`, {
            headers: { 'X-MailerLite-ApiKey': apiKey, 'Content-Type': 'application/json' },
          });
          if (groupRes.ok) {
            const groupData = await groupRes.json() as any;
            mailerliteConnected = true;
            subscriberCount = groupData.active_count || groupData.total || 0;
            groupName = groupData.name || '';
          }
        } catch (e) {
          console.error('MailerLite status check failed:', e);
        }
      }

      // Last campaign sent via MailerLite
      let lastCampaign: { subject: string; sentAt: string; opens: number; clicks: number } | null = null;

      if (apiKey && mailerliteConnected) {
        try {
          const campRes = await fetch('https://api.mailerlite.com/api/v2/campaigns/sent?limit=1', {
            headers: { 'X-MailerLite-ApiKey': apiKey, 'Content-Type': 'application/json' },
          });
          if (campRes.ok) {
            const campaigns = await campRes.json() as any[];
            if (campaigns && campaigns.length > 0) {
              const c = campaigns[0];
              lastCampaign = {
                subject: c.subject || '',
                sentAt: c.date_send || c.created_at || '',
                opens: c.opened?.count || 0,
                clicks: c.clicked?.count || 0,
              };
            }
          }
        } catch (e) {
          console.error('MailerLite campaigns check failed:', e);
        }
      }

      res.json({
        mailerlite: {
          connected: mailerliteConnected,
          apiKeySet: !!apiKey,
          subscriberCount,
          groupName,
          lastCampaign,
        },
        mailersend: {
          connected: !!mailersendToken,
        },
      });
    } catch (error) {
      console.error("Error getting email status:", error);
      res.status(500).json({ message: "Failed to retrieve email status" });
    }
  });

  // Contact form submission endpoint
  app.post("/api/contact", async (req, res) => {
    try {
      // Validate contact form data
      const contactSchema = z.object({
        name: z.string().min(2, "Name is required"),
        email: z.string().email("Valid email is required"),
        subject: z.string().min(2, "Subject is required"),
        message: z.string().min(10, "Message must be at least 10 characters")
      });
      
      const result = contactSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: "Invalid contact form data", 
          errors: fromZodError(result.error)
        });
      }
      
      // Import here to avoid circular dependency
      const { sendContactMessage } = await import("./contact");
      
      // Send email using MailerSend
      const success = await sendContactMessage(result.data);
      
      if (success) {
        res.status(200).json({ message: "Message sent successfully" });
      } else {
        res.status(500).json({ message: "Failed to send message" });
      }
    } catch (error) {
      console.error("Error sending contact message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

}
