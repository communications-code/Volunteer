var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  NeedCategory: () => NeedCategory,
  NeedStatus: () => NeedStatus,
  NeedType: () => NeedType,
  adminMagicLoginTokens: () => adminMagicLoginTokens,
  adminNotificationPreferences: () => adminNotificationPreferences,
  authEvents: () => authEvents,
  calendarSyncQueue: () => calendarSyncQueue,
  categories: () => categories,
  emailDeliverySettings: () => emailDeliverySettings,
  eventRoleSignups: () => eventRoleSignups,
  eventRoleSignupsRelations: () => eventRoleSignupsRelations,
  eventRoles: () => eventRoles,
  eventRolesRelations: () => eventRolesRelations,
  eventSignupReminders: () => eventSignupReminders,
  insertAdminMagicLoginTokenSchema: () => insertAdminMagicLoginTokenSchema,
  insertAdminNotificationPreferencesSchema: () => insertAdminNotificationPreferencesSchema,
  insertAuthEventSchema: () => insertAuthEventSchema,
  insertCalendarSyncQueueSchema: () => insertCalendarSyncQueueSchema,
  insertCategorySchema: () => insertCategorySchema,
  insertEmailDeliverySettingsSchema: () => insertEmailDeliverySettingsSchema,
  insertEventRoleSchema: () => insertEventRoleSchema,
  insertEventRoleSignupSchema: () => insertEventRoleSignupSchema,
  insertEventSignupReminderSchema: () => insertEventSignupReminderSchema,
  insertNeedSchema: () => insertNeedSchema,
  insertPledgeSchema: () => insertPledgeSchema,
  insertUserSchema: () => insertUserSchema,
  needs: () => needs,
  needsRelations: () => needsRelations,
  pledges: () => pledges,
  pledgesRelations: () => pledgesRelations,
  users: () => users,
  usersRelations: () => usersRelations
});
import { pgTable, text, serial, date, timestamp, boolean, integer, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
var users, usersRelations, insertUserSchema, adminNotificationPreferences, insertAdminNotificationPreferencesSchema, emailDeliverySettings, insertEmailDeliverySettingsSchema, adminMagicLoginTokens, insertAdminMagicLoginTokenSchema, authEvents, insertAuthEventSchema, NeedStatus, NeedCategory, categories, insertCategorySchema, NeedType, needs, needsRelations, insertNeedSchema, pledges, pledgesRelations, insertPledgeSchema, eventRoles, insertEventRoleSchema, eventRoleSignups, insertEventRoleSignupSchema, eventSignupReminders, insertEventSignupReminderSchema, calendarSyncQueue, insertCalendarSyncQueueSchema, eventRolesRelations, eventRoleSignupsRelations;
var init_schema = __esm({
  "shared/schema.ts"() {
    "use strict";
    users = pgTable("users", {
      id: serial("id").primaryKey(),
      username: text("username").notNull().unique(),
      password: text("password").notNull(),
      isAdmin: boolean("is_admin").notNull().default(false),
      failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
      lockedUntil: timestamp("locked_until"),
      lastLoginAt: timestamp("last_login_at"),
      passwordUpdatedAt: timestamp("password_updated_at")
    });
    usersRelations = relations(users, ({ many }) => ({
      needs: many(needs)
    }));
    insertUserSchema = createInsertSchema(users).pick({
      username: true,
      password: true,
      isAdmin: true
    });
    adminNotificationPreferences = pgTable("admin_notification_preferences", {
      id: serial("id").primaryKey(),
      userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
      receiveAllNotifications: boolean("receive_all_notifications").notNull().default(true),
      enabledCategories: text("enabled_categories").notNull().default("[]"),
      // JSON array string of category slugs
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    insertAdminNotificationPreferencesSchema = createInsertSchema(
      adminNotificationPreferences
    ).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    emailDeliverySettings = pgTable("email_delivery_settings", {
      key: text("key").primaryKey(),
      emailsEnabled: boolean("emails_enabled").notNull().default(true),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    insertEmailDeliverySettingsSchema = createInsertSchema(emailDeliverySettings);
    adminMagicLoginTokens = pgTable("admin_magic_login_tokens", {
      id: serial("id").primaryKey(),
      userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
      tokenHash: text("token_hash").notNull(),
      expiresAt: timestamp("expires_at").notNull(),
      usedAt: timestamp("used_at"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      createdIp: text("created_ip"),
      createdUserAgent: text("created_user_agent")
    });
    insertAdminMagicLoginTokenSchema = createInsertSchema(adminMagicLoginTokens).omit({
      id: true,
      createdAt: true
    });
    authEvents = pgTable("auth_events", {
      id: serial("id").primaryKey(),
      userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
      usernameAttempt: text("username_attempt"),
      eventType: text("event_type").notNull(),
      ip: text("ip"),
      userAgent: text("user_agent"),
      metadata: text("metadata"),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    insertAuthEventSchema = createInsertSchema(authEvents).omit({
      id: true,
      createdAt: true
    });
    NeedStatus = /* @__PURE__ */ ((NeedStatus2) => {
      NeedStatus2["DRAFT"] = "DRAFT";
      NeedStatus2["FLOATING"] = "FLOATING";
      NeedStatus2["PLEDGED"] = "PLEDGED";
      NeedStatus2["FULFILLED"] = "FULFILLED";
      NeedStatus2["UNFULFILLED"] = "UNFULFILLED";
      NeedStatus2["RECURRING"] = "RECURRING";
      return NeedStatus2;
    })(NeedStatus || {});
    NeedCategory = /* @__PURE__ */ ((NeedCategory2) => {
      NeedCategory2["FOOD"] = "FOOD";
      NeedCategory2["CLOTHING"] = "CLOTHING";
      NeedCategory2["SERVICE"] = "SERVICE";
      NeedCategory2["EDUCATION"] = "EDUCATION";
      NeedCategory2["HOUSING"] = "HOUSING";
      NeedCategory2["EVENT"] = "EVENT";
      NeedCategory2["OTHER"] = "OTHER";
      return NeedCategory2;
    })(NeedCategory || {});
    categories = pgTable("categories", {
      id: serial("id").primaryKey(),
      name: text("name").notNull(),
      // Display name, e.g. "Food"
      slug: text("slug").notNull().unique(),
      // Stored on needs.category, e.g. "FOOD"
      icon: text("icon").notNull().default("Heart"),
      // Lucide icon name
      displayOrder: integer("display_order").notNull().default(0),
      isEvent: boolean("is_event").notNull().default(false),
      // Enables event-specific fields
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    insertCategorySchema = createInsertSchema(categories).omit({
      id: true,
      createdAt: true
    });
    NeedType = /* @__PURE__ */ ((NeedType2) => {
      NeedType2["ONETIME"] = "ONETIME";
      NeedType2["ONGOING"] = "ONGOING";
      NeedType2["GROUP"] = "GROUP";
      NeedType2["EVENT"] = "EVENT";
      return NeedType2;
    })(NeedType || {});
    needs = pgTable("needs", {
      id: serial("id").primaryKey(),
      title: text("title").notNull(),
      description: text("description").notNull(),
      category: text("category").notNull(),
      categorySelections: text("category_selections").notNull().default("[]"),
      // JSON array string of selected category slugs
      neededBy: date("needed_by"),
      eventDate: date("event_date"),
      // For EVENT category and GROUP type, specific date when the event/service project occurs
      eventTime: text("event_time"),
      // For EVENT category, to store time information (e.g., "7:00 PM")
      eventStartTime: text("event_start_time"),
      // HH:mm (24-hour) overall event start time
      eventEndTime: text("event_end_time"),
      // HH:mm (24-hour) overall event end time
      eventLocation: text("event_location"),
      // For EVENT category, to store location details
      status: text("status").notNull().default("FLOATING" /* FLOATING */),
      estimatedCost: integer("estimated_cost"),
      allowItemDonations: boolean("allow_item_donations").notNull().default(true),
      // Public users can pledge item support
      allowMoneyDonations: boolean("allow_money_donations").notNull().default(false),
      // Financial contributions are disabled for VFW
      needType: text("need_type").notNull().default("ONETIME" /* ONETIME */),
      startDate: date("start_date"),
      endDate: date("end_date"),
      imageUrl: text("image_url"),
      redirectUrl: text("redirect_url"),
      // For EVENT category sign-up button redirection
      volunteersNeeded: integer("volunteers_needed"),
      // For GROUP type, track how many volunteers are needed
      volunteersCount: integer("volunteers_count").default(0),
      // Current count of volunteers signed up
      isHighlighted: boolean("is_highlighted").default(false),
      // For starred/highlighted needs
      // Admin-only recipient contact information fields
      recipientName: text("recipient_name"),
      // Name of who the need is for (admin-only)
      recipientPhone: text("recipient_phone"),
      // Contact phone number (admin-only)
      recipientEmail: text("recipient_email"),
      // Contact email (admin-only)
      recipientAddress: text("recipient_address"),
      // Address information (admin-only)
      recipientNotes: text("recipient_notes"),
      // Additional admin notes about the recipient
      // Demographic data (admin-only)
      recipientDob: date("recipient_dob"),
      // Date of birth for age tracking
      recipientIsWidow: boolean("recipient_is_widow"),
      // Widow/widower status
      recipientIsSingleParent: boolean("recipient_is_single_parent"),
      // Single parent status
      recipientInsurance: text("recipient_insurance"),
      // Legacy field, kept for backward compat
      // Government assistance programs (admin-only)
      recipientMedicaid: boolean("recipient_medicaid"),
      // Receives Medicaid
      recipientMedicare: boolean("recipient_medicare"),
      // Receives Medicare
      recipientSocialSecurity: boolean("recipient_social_security"),
      // Receives Social Security
      recipientSnap: boolean("recipient_snap"),
      // Receives SNAP (food assistance)
      recipientDisability: boolean("recipient_disability"),
      // Receives Disability
      excludeFromEmail: boolean("exclude_from_email").default(false),
      // Opt out of auto-share email newsletter
      displayOrder: integer("display_order").notNull().default(0),
      // Admin-controlled sort order
      sharedAt: timestamp("shared_at"),
      // When need was auto-shared to Facebook/MailerLite (null = not yet shared)
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    needsRelations = relations(needs, ({ many }) => ({
      pledges: many(pledges),
      eventRoles: many(eventRoles),
      eventRoleSignups: many(eventRoleSignups)
    }));
    insertNeedSchema = createInsertSchema(needs).omit({
      id: true,
      sharedAt: true,
      createdAt: true,
      updatedAt: true
    });
    pledges = pgTable("pledges", {
      id: serial("id").primaryKey(),
      needId: integer("need_id").notNull().references(() => needs.id, { onDelete: "cascade" }),
      firstName: text("first_name").notNull(),
      lastName: text("last_name").notNull(),
      email: text("email").notNull(),
      phone: text("phone"),
      organization: text("organization"),
      notes: text("notes"),
      donationType: text("donation_type").notNull(),
      isOngoingCommitment: boolean("is_ongoing_commitment"),
      subscribeToEmails: boolean("subscribe_to_emails").default(true),
      paymentCompleted: boolean("payment_completed").default(false),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    pledgesRelations = relations(pledges, ({ one, many }) => ({
      need: one(needs, {
        fields: [pledges.needId],
        references: [needs.id]
      }),
      eventRoleSignups: many(eventRoleSignups)
    }));
    insertPledgeSchema = createInsertSchema(pledges).omit({
      id: true,
      createdAt: true
    });
    eventRoles = pgTable("event_roles", {
      id: serial("id").primaryKey(),
      needId: integer("need_id").notNull().references(() => needs.id, { onDelete: "cascade" }),
      name: text("name").notNull(),
      slotDate: date("slot_date"),
      // Optional per-slot date for multi-day events
      startTime: text("start_time").notNull(),
      // HH:mm
      endTime: text("end_time").notNull(),
      // HH:mm
      capacity: integer("capacity"),
      // null = unlimited
      displayOrder: integer("display_order").notNull().default(0),
      isActive: boolean("is_active").notNull().default(true),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    insertEventRoleSchema = createInsertSchema(eventRoles).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    eventRoleSignups = pgTable(
      "event_role_signups",
      {
        id: serial("id").primaryKey(),
        pledgeId: integer("pledge_id").notNull().references(() => pledges.id, { onDelete: "cascade" }),
        needId: integer("need_id").notNull().references(() => needs.id, { onDelete: "cascade" }),
        eventRoleId: integer("event_role_id").notNull().references(() => eventRoles.id, { onDelete: "cascade" }),
        signerEmail: text("signer_email").notNull(),
        quantity: integer("quantity").notNull().default(1),
        createdAt: timestamp("created_at").notNull().defaultNow()
      },
      (table) => ({
        eventRoleSignupUniqueEmailIdx: uniqueIndex("event_role_signups_role_email_idx").on(
          table.eventRoleId,
          table.signerEmail
        )
      })
    );
    insertEventRoleSignupSchema = createInsertSchema(eventRoleSignups).omit({
      id: true,
      createdAt: true
    });
    eventSignupReminders = pgTable(
      "event_signup_reminders",
      {
        id: serial("id").primaryKey(),
        needId: integer("need_id").notNull().references(() => needs.id, { onDelete: "cascade" }),
        signerEmail: text("signer_email").notNull(),
        firstSlotAt: timestamp("first_slot_at").notNull(),
        reminderType: text("reminder_type").notNull().default("FIRST_SLOT_24H"),
        sentAt: timestamp("sent_at").notNull().defaultNow(),
        createdAt: timestamp("created_at").notNull().defaultNow()
      },
      (table) => ({
        uniqueReminderIdx: uniqueIndex("event_signup_reminders_unique_idx").on(
          table.needId,
          table.signerEmail,
          table.firstSlotAt,
          table.reminderType
        ),
        firstSlotIdx: index("idx_event_signup_reminders_first_slot_at").on(table.firstSlotAt)
      })
    );
    insertEventSignupReminderSchema = createInsertSchema(eventSignupReminders).omit({
      id: true,
      createdAt: true
    });
    calendarSyncQueue = pgTable(
      "calendar_sync_queue",
      {
        needId: integer("need_id").primaryKey(),
        action: text("action").notNull(),
        // UPSERT | DELETE
        payload: text("payload").notNull(),
        // JSON string payload
        idempotencyKey: text("idempotency_key").notNull(),
        attempts: integer("attempts").notNull().default(0),
        nextAttemptAt: timestamp("next_attempt_at").notNull().defaultNow(),
        lastAttemptAt: timestamp("last_attempt_at"),
        lastError: text("last_error"),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        updatedAt: timestamp("updated_at").notNull().defaultNow()
      },
      (table) => ({
        nextAttemptIdx: index("idx_calendar_sync_queue_next_attempt_at").on(table.nextAttemptAt)
      })
    );
    insertCalendarSyncQueueSchema = createInsertSchema(calendarSyncQueue).omit({
      createdAt: true,
      updatedAt: true
    });
    eventRolesRelations = relations(eventRoles, ({ one, many }) => ({
      need: one(needs, {
        fields: [eventRoles.needId],
        references: [needs.id]
      }),
      signups: many(eventRoleSignups)
    }));
    eventRoleSignupsRelations = relations(eventRoleSignups, ({ one }) => ({
      need: one(needs, {
        fields: [eventRoleSignups.needId],
        references: [needs.id]
      }),
      pledge: one(pledges, {
        fields: [eventRoleSignups.pledgeId],
        references: [pledges.id]
      }),
      eventRole: one(eventRoles, {
        fields: [eventRoleSignups.eventRoleId],
        references: [eventRoles.id]
      })
    }));
  }
});

// server/db.ts
var db_exports = {};
__export(db_exports, {
  db: () => db,
  queryClient: () => queryClient
});
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
var queryClient, db;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    queryClient = postgres(process.env.DATABASE_URL, {
      ssl: "require",
      prepare: false,
      // Keep this small for serverless, but >1 to reduce head-of-line blocking
      // when one request is slow (e.g. cold-start + pooler latency).
      max: 2,
      idle_timeout: 20,
      // Close idle connections after 20s
      connect_timeout: 10
      // Fail fast on connection issues
    });
    db = drizzle(queryClient);
  }
});

// server/timezone.ts
function parseDateForDisplay(date2) {
  if (!date2) return null;
  if (date2 instanceof Date) {
    return Number.isNaN(date2.getTime()) ? null : date2;
  }
  const trimmed = date2.trim();
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const monthIndex = Number(dateOnlyMatch[2]) - 1;
    const day = Number(dateOnlyMatch[3]);
    return new Date(Date.UTC(year, monthIndex, day, 12, 0, 0));
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function formatDateInNewYork(date2, options) {
  const parsed = parseDateForDisplay(date2);
  if (!parsed) return "";
  return parsed.toLocaleDateString("en-US", {
    timeZone: SITE_TIME_ZONE,
    ...options
  });
}
function formatTimeInNewYork(date2, options) {
  const parsed = parseDateForDisplay(date2);
  if (!parsed) return "";
  return parsed.toLocaleTimeString("en-US", {
    timeZone: SITE_TIME_ZONE,
    ...options
  });
}
function getCurrentDateInNewYork(now = /* @__PURE__ */ new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SITE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error("Failed to format current date in New York");
  }
  return `${year}-${month}-${day}`;
}
function parseTimeToMinutes(rawTime) {
  if (!rawTime) return null;
  const trimmed = rawTime.trim();
  const match24 = TIME_24_PATTERN.exec(trimmed);
  if (match24) {
    const hours = Number(match24[1]);
    const minutes = Number(match24[2]);
    return hours * 60 + minutes;
  }
  const normalized12 = trimmed.replace(/\./g, "").replace(/\s+/g, "").toLowerCase();
  const match12 = TIME_12_PATTERN.exec(normalized12);
  if (match12) {
    const hour12 = Number(match12[1]);
    const minutes = Number(match12[2]);
    const meridiem = match12[3];
    const hour24 = hour12 % 12 + (meridiem === "p" ? 12 : 0);
    return hour24 * 60 + minutes;
  }
  return null;
}
function formatMinutesAs12Hour(totalMinutes) {
  const normalized = (totalMinutes % 1440 + 1440) % 1440;
  const hours24 = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const suffix = hours24 >= 12 ? "pm" : "am";
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${String(minutes).padStart(2, "0")}${suffix}`;
}
function formatClockTimeForDisplay(time) {
  const parsedMinutes = parseTimeToMinutes(time);
  if (parsedMinutes === null) return time?.trim() || "";
  return formatMinutesAs12Hour(parsedMinutes);
}
function formatTimeRangeForDisplay(startTime, endTime) {
  if (!startTime && !endTime) return "";
  if (startTime && endTime) {
    return `${formatClockTimeForDisplay(startTime)} - ${formatClockTimeForDisplay(endTime)}`;
  }
  return formatClockTimeForDisplay(startTime || endTime || "");
}
var SITE_TIME_ZONE, TIME_24_PATTERN, TIME_12_PATTERN;
var init_timezone = __esm({
  "server/timezone.ts"() {
    "use strict";
    SITE_TIME_ZONE = "America/New_York";
    TIME_24_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
    TIME_12_PATTERN = /^(1[0-2]|0?[1-9]):([0-5]\d)\s*([ap])m?$/i;
  }
});

// server/storage.ts
import { eq, and, sql, asc, desc, inArray } from "drizzle-orm";
import { randomBytes, scrypt } from "crypto";
import { promisify } from "util";
var scryptAsync, EventSignupValidationError, EventSlotConflictError, DatabaseStorage, storage;
var init_storage = __esm({
  "server/storage.ts"() {
    "use strict";
    init_schema();
    init_db();
    init_timezone();
    scryptAsync = promisify(scrypt);
    EventSignupValidationError = class extends Error {
      statusCode;
      constructor(message, statusCode = 400) {
        super(message);
        this.statusCode = statusCode;
        this.name = "EventSignupValidationError";
      }
    };
    EventSlotConflictError = class extends Error {
      statusCode;
      constructor(message, statusCode = 409) {
        super(message);
        this.statusCode = statusCode;
        this.name = "EventSlotConflictError";
      }
    };
    DatabaseStorage = class {
      _initialized = false;
      buildEventRolePreviewLabel(need, roles) {
        const slotMap = /* @__PURE__ */ new Map();
        for (const role of roles) {
          const slotDate = role.slotDate || need.eventDate || null;
          const key = [slotDate || "", role.startTime || "", role.endTime || ""].join("|");
          if (!slotMap.has(key)) {
            slotMap.set(key, {
              slotDate,
              startTime: role.startTime,
              endTime: role.endTime
            });
          }
        }
        const uniqueSlots = Array.from(slotMap.values()).sort((left, right) => {
          const leftDate = left.slotDate || "9999-12-31";
          const rightDate = right.slotDate || "9999-12-31";
          return leftDate.localeCompare(rightDate) || left.startTime.localeCompare(right.startTime) || left.endTime.localeCompare(right.endTime);
        });
        if (uniqueSlots.length > 0) {
          const distinctDateCount = new Set(
            uniqueSlots.map((slot) => slot.slotDate || "__no_date__")
          ).size;
          const primarySlot = uniqueSlots[0];
          const timeLabel = formatTimeRangeForDisplay(primarySlot.startTime, primarySlot.endTime);
          if (!timeLabel) return null;
          const includeDate = distinctDateCount > 1 && primarySlot.slotDate;
          const dateLabel = includeDate ? formatDateInNewYork(primarySlot.slotDate, {
            month: "short",
            day: "numeric"
          }) : "";
          const baseLabel = dateLabel ? `${dateLabel} ${timeLabel}` : timeLabel;
          return uniqueSlots.length > 1 ? `${baseLabel} +${uniqueSlots.length - 1} more` : baseLabel;
        }
        const overallTimeLabel = formatTimeRangeForDisplay(need.eventStartTime, need.eventEndTime);
        if (overallTimeLabel) return overallTimeLabel;
        const fallbackTime = need.eventTime?.trim();
        return fallbackTime || null;
      }
      getEventLastDate(need, roles = []) {
        if (need.needType !== "EVENT" /* EVENT */) {
          return null;
        }
        const candidateDates = [
          ...roles.map((role) => role.slotDate?.trim() || null),
          need.endDate?.trim() || null,
          need.eventDate?.trim() || null,
          need.neededBy?.trim() || null,
          need.startDate?.trim() || null
        ].filter((value) => Boolean(value));
        if (candidateDates.length === 0) {
          return null;
        }
        return candidateDates.reduce((latest, current) => current > latest ? current : latest);
      }
      isEventEnded(need, roles = []) {
        const eventLastDate = this.getEventLastDate(need, roles);
        if (!eventLastDate) {
          return false;
        }
        return getCurrentDateInNewYork() > eventLastDate;
      }
      isEventRoleEnded(need, role) {
        const slotDate = role.slotDate || need.eventDate || need.startDate || need.neededBy || null;
        return Boolean(slotDate && getCurrentDateInNewYork() > slotDate);
      }
      normalizeUsername(username) {
        return username.trim().toLowerCase();
      }
      async hashBootstrapPassword(password) {
        const salt = randomBytes(16).toString("hex");
        const buf = await scryptAsync(password, salt, 64);
        return `${buf.toString("hex")}.${salt}`;
      }
      constructor() {
        this.initializeAdminUser().catch((err) => {
          console.error("Non-fatal: admin user initialization failed (will retry on next cold start):", err.message);
        });
      }
      async initializeAdminUser() {
        if (this._initialized) return;
        try {
          const adminEmail = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
          const adminPassword = process.env.INITIAL_ADMIN_PASSWORD?.trim();
          if (!adminEmail && !adminPassword) {
            this._initialized = true;
            return;
          }
          if (!adminEmail || !adminPassword) {
            console.error("Skipping initial admin bootstrap: set both INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD.");
            this._initialized = true;
            return;
          }
          const existingAdmin = await this.getUserByUsername(adminEmail);
          if (!existingAdmin) {
            await this.createUser({
              username: adminEmail,
              password: await this.hashBootstrapPassword(adminPassword),
              isAdmin: true
            });
          }
          this._initialized = true;
        } catch (err) {
          throw err;
        }
      }
      // User methods
      async getUser(id) {
        const [user] = await db.select().from(users).where(eq(users.id, id));
        return user;
      }
      async getUserByUsername(username) {
        const matchingUsers = await this.getUsersByCanonicalUsername(username);
        return matchingUsers[0];
      }
      async getUsersByCanonicalUsername(username) {
        const normalizedUsername = this.normalizeUsername(username);
        return await db.select().from(users).where(sql`lower(trim(${users.username})) = ${normalizedUsername}`).orderBy(desc(users.id)).limit(20);
      }
      async createUser(insertUser) {
        const normalizedUsername = this.normalizeUsername(insertUser.username);
        const [user] = await db.insert(users).values({
          username: normalizedUsername,
          password: insertUser.password,
          isAdmin: insertUser.isAdmin === void 0 ? false : insertUser.isAdmin
        }).returning();
        return user;
      }
      formatEventTimeRange(startTime, endTime, fallback) {
        if (startTime && endTime) return `${startTime} - ${endTime}`;
        return fallback || null;
      }
      normalizeRoleCapacity(capacity) {
        if (capacity === null || capacity === void 0) return null;
        if (!Number.isFinite(capacity)) return null;
        const normalized = Math.max(0, Math.floor(capacity));
        return normalized === 0 ? null : normalized;
      }
      normalizeRoleInput(role, index2) {
        return {
          id: role.id,
          name: role.name.trim(),
          slotDate: role.slotDate?.trim() || null,
          startTime: role.startTime.trim(),
          endTime: role.endTime.trim(),
          capacity: this.normalizeRoleCapacity(role.capacity),
          displayOrder: typeof role.displayOrder === "number" ? role.displayOrder : index2,
          isActive: role.isActive ?? true
        };
      }
      normalizeEventRoleSelections(rawRoleIds) {
        return Array.from(
          new Set(
            (rawRoleIds || []).map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)
          )
        );
      }
      normalizeEventRoleQuantities(rawQuantities, selectedRoleIds, fallbackQuantities = /* @__PURE__ */ new Map()) {
        const quantitySource = rawQuantities && typeof rawQuantities === "object" ? rawQuantities : {};
        const normalized = /* @__PURE__ */ new Map();
        for (const roleId of selectedRoleIds) {
          const parsed = Number(quantitySource[String(roleId)]);
          if (Number.isInteger(parsed) && parsed > 0) {
            normalized.set(roleId, parsed);
            continue;
          }
          const fallbackQuantity = fallbackQuantities.get(roleId);
          if (typeof fallbackQuantity === "number" && fallbackQuantity > 0) {
            normalized.set(roleId, Math.floor(fallbackQuantity));
          } else {
            normalized.set(roleId, 1);
          }
        }
        return normalized;
      }
      normalizeSignerEmail(rawEmail) {
        return rawEmail.trim().toLowerCase();
      }
      normalizeNeedCategories(rawCategory, rawCategorySelections) {
        const fallbackCategory = (rawCategory || "").trim();
        let normalizedSelections = [];
        const rawSelections = (rawCategorySelections || "").trim();
        if (rawSelections) {
          try {
            const parsed = JSON.parse(rawSelections);
            if (Array.isArray(parsed)) {
              normalizedSelections = parsed.filter((value) => typeof value === "string").map((value) => value.trim()).filter((value) => value.length > 0);
            }
          } catch {
            normalizedSelections = rawSelections.split(",").map((value) => value.trim()).filter((value) => value.length > 0);
          }
        }
        if (normalizedSelections.length === 0 && fallbackCategory) {
          normalizedSelections = [fallbackCategory];
        }
        const uniqueSelections = Array.from(new Set(normalizedSelections));
        return {
          primaryCategory: uniqueSelections[0] || fallbackCategory,
          categorySelections: JSON.stringify(uniqueSelections)
        };
      }
      async getEventParticipantCountsByNeedIdsTx(tx, needIds) {
        const uniqueNeedIds = Array.from(
          new Set(needIds.filter((id) => Number.isInteger(id) && id > 0))
        );
        if (uniqueNeedIds.length === 0) {
          return /* @__PURE__ */ new Map();
        }
        const participantCountsByPledge = tx.select({
          needId: eventRoleSignups.needId,
          pledgeId: eventRoleSignups.pledgeId,
          participantCount: sql`
          max(
            case
              when ${eventRoleSignups.quantity} > 0 then ${eventRoleSignups.quantity}
              else 1
            end
          )::int
        `.as("participant_count")
        }).from(eventRoleSignups).where(inArray(eventRoleSignups.needId, uniqueNeedIds)).groupBy(eventRoleSignups.needId, eventRoleSignups.pledgeId).as("event_participant_counts_by_pledge");
        const rows = await tx.select({
          needId: participantCountsByPledge.needId,
          participantCount: sql`coalesce(sum(${participantCountsByPledge.participantCount}), 0)::int`
        }).from(participantCountsByPledge).groupBy(participantCountsByPledge.needId);
        return new Map(
          rows.map((row) => [
            Number(row.needId),
            Number(row.participantCount) || 0
          ])
        );
      }
      async getEventParticipantCountByNeedIdTx(tx, needId) {
        const countsByNeedId = await this.getEventParticipantCountsByNeedIdsTx(tx, [needId]);
        return countsByNeedId.get(needId) ?? 0;
      }
      async syncEventRolesForNeedTx(tx, needId, incomingRoles) {
        const normalizedRoles = incomingRoles.map((role, index2) => this.normalizeRoleInput(role, index2));
        const existing = await tx.select().from(eventRoles).where(eq(eventRoles.needId, needId));
        const existingById = new Map(existing.map((role) => [role.id, role]));
        const keepIds = /* @__PURE__ */ new Set();
        for (const role of normalizedRoles) {
          if (role.id && existingById.has(role.id)) {
            await tx.update(eventRoles).set({
              name: role.name,
              slotDate: role.slotDate,
              startTime: role.startTime,
              endTime: role.endTime,
              capacity: role.capacity,
              displayOrder: role.displayOrder,
              isActive: role.isActive,
              updatedAt: /* @__PURE__ */ new Date()
            }).where(and(eq(eventRoles.id, role.id), eq(eventRoles.needId, needId)));
            keepIds.add(role.id);
          } else {
            const [created] = await tx.insert(eventRoles).values({
              needId,
              name: role.name,
              slotDate: role.slotDate,
              startTime: role.startTime,
              endTime: role.endTime,
              capacity: role.capacity,
              displayOrder: role.displayOrder,
              isActive: role.isActive
            }).returning();
            keepIds.add(created.id);
          }
        }
        const rolesToDelete = existing.filter((role) => !keepIds.has(role.id)).map((role) => role.id);
        if (rolesToDelete.length > 0) {
          await tx.delete(eventRoles).where(inArray(eventRoles.id, rolesToDelete));
        }
        return await tx.select().from(eventRoles).where(eq(eventRoles.needId, needId)).orderBy(asc(eventRoles.displayOrder), asc(eventRoles.id));
      }
      async computeEventNeedStatusTx(tx, needId) {
        const roles = await tx.select().from(eventRoles).where(and(eq(eventRoles.needId, needId), eq(eventRoles.isActive, true)));
        const finiteRoles = roles.filter((role) => typeof role.capacity === "number" && role.capacity > 0);
        if (finiteRoles.length === 0) {
          return "FLOATING" /* FLOATING */;
        }
        const counts = await tx.select({
          eventRoleId: eventRoleSignups.eventRoleId,
          filledCount: sql`coalesce(sum(${eventRoleSignups.quantity}), 0)::int`
        }).from(eventRoleSignups).where(eq(eventRoleSignups.needId, needId)).groupBy(eventRoleSignups.eventRoleId);
        const countByRoleId = new Map(
          counts.map((row) => [row.eventRoleId, Number(row.filledCount) || 0])
        );
        const allFiniteSlotsFull = finiteRoles.every((role) => {
          const filledCount = Number(countByRoleId.get(role.id) ?? 0);
          const capacity = typeof role.capacity === "number" ? role.capacity : 0;
          return filledCount >= capacity;
        });
        return allFiniteSlotsFull ? "PLEDGED" /* PLEDGED */ : "FLOATING" /* FLOATING */;
      }
      async recalculateEventNeedStatsTx(tx, needId) {
        const [currentNeed] = await tx.select().from(needs).where(eq(needs.id, needId));
        if (!currentNeed) {
          throw new Error("Need not found");
        }
        const nextStatus = await this.computeEventNeedStatusTx(tx, needId);
        const volunteersCount = await this.getEventParticipantCountByNeedIdTx(tx, needId);
        const [updatedNeed] = await tx.update(needs).set({
          volunteersCount,
          status: nextStatus,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(needs.id, needId)).returning();
        return updatedNeed ?? currentNeed;
      }
      // Need methods
      async createNeed(insertNeed, status) {
        const needType = insertNeed.needType || "ONETIME" /* ONETIME */;
        const isEventNeed = needType === "EVENT" /* EVENT */;
        return await db.transaction(async (tx) => {
          const normalizedCategories = this.normalizeNeedCategories(
            insertNeed.category,
            insertNeed.categorySelections
          );
          const [need] = await tx.insert(needs).values({
            title: insertNeed.title,
            description: insertNeed.description,
            category: normalizedCategories.primaryCategory,
            categorySelections: normalizedCategories.categorySelections,
            neededBy: insertNeed.neededBy || null,
            eventDate: insertNeed.eventDate || null,
            eventTime: this.formatEventTimeRange(
              insertNeed.eventStartTime,
              insertNeed.eventEndTime,
              insertNeed.eventTime || null
            ),
            eventStartTime: insertNeed.eventStartTime || null,
            eventEndTime: insertNeed.eventEndTime || null,
            eventLocation: insertNeed.eventLocation || null,
            status: status || insertNeed.status || (insertNeed.needType === "ONGOING" /* ONGOING */ ? "RECURRING" /* RECURRING */ : "FLOATING" /* FLOATING */),
            estimatedCost: insertNeed.estimatedCost || null,
            allowItemDonations: isEventNeed ? false : insertNeed.allowItemDonations ?? true,
            allowMoneyDonations: false,
            needType,
            startDate: insertNeed.startDate || null,
            endDate: insertNeed.endDate || null,
            imageUrl: insertNeed.imageUrl || null,
            redirectUrl: insertNeed.redirectUrl || null,
            volunteersNeeded: insertNeed.volunteersNeeded || null,
            volunteersCount: 0,
            recipientName: insertNeed.recipientName || null,
            recipientPhone: insertNeed.recipientPhone || null,
            recipientEmail: insertNeed.recipientEmail || null,
            recipientAddress: insertNeed.recipientAddress || null,
            recipientNotes: insertNeed.recipientNotes || null,
            recipientDob: insertNeed.recipientDob || null,
            recipientIsWidow: insertNeed.recipientIsWidow ?? null,
            recipientIsSingleParent: insertNeed.recipientIsSingleParent ?? null,
            recipientInsurance: insertNeed.recipientInsurance || null,
            recipientMedicaid: insertNeed.recipientMedicaid ?? null,
            recipientMedicare: insertNeed.recipientMedicare ?? null,
            recipientSocialSecurity: insertNeed.recipientSocialSecurity ?? null,
            recipientSnap: insertNeed.recipientSnap ?? null,
            recipientDisability: insertNeed.recipientDisability ?? null,
            excludeFromEmail: insertNeed.excludeFromEmail ?? false
          }).returning();
          if (isEventNeed && Array.isArray(insertNeed.eventRoles)) {
            await this.syncEventRolesForNeedTx(tx, need.id, insertNeed.eventRoles);
          }
          return need;
        });
      }
      async getNeed(id) {
        const [need] = await db.select().from(needs).where(eq(needs.id, id));
        if (!need || need.needType !== "EVENT" /* EVENT */) {
          return need;
        }
        const activeRoles = await db.select({
          slotDate: eventRoles.slotDate,
          startTime: eventRoles.startTime,
          endTime: eventRoles.endTime
        }).from(eventRoles).where(and(eq(eventRoles.needId, need.id), eq(eventRoles.isActive, true))).orderBy(asc(eventRoles.displayOrder), asc(eventRoles.id));
        const volunteersCount = await this.getEventParticipantCountByNeedIdTx(db, need.id);
        return {
          ...need,
          volunteersCount,
          eventLastDate: this.getEventLastDate(need, activeRoles),
          eventRolePreviewLabel: this.buildEventRolePreviewLabel(need, activeRoles)
        };
      }
      async getAllNeeds() {
        const allNeeds = await db.select().from(needs).orderBy(asc(needs.displayOrder), desc(needs.createdAt));
        const eventNeedIds = allNeeds.filter((need) => need.needType === "EVENT" /* EVENT */).map((need) => need.id);
        const roleRows = eventNeedIds.length > 0 ? await db.select({
          needId: eventRoles.needId,
          slotDate: eventRoles.slotDate,
          startTime: eventRoles.startTime,
          endTime: eventRoles.endTime
        }).from(eventRoles).where(and(inArray(eventRoles.needId, eventNeedIds), eq(eventRoles.isActive, true))).orderBy(asc(eventRoles.needId), asc(eventRoles.displayOrder), asc(eventRoles.id)) : [];
        const rolesByNeedId = /* @__PURE__ */ new Map();
        for (const role of roleRows) {
          const existingRoles = rolesByNeedId.get(role.needId) ?? [];
          existingRoles.push({
            slotDate: role.slotDate,
            startTime: role.startTime,
            endTime: role.endTime
          });
          rolesByNeedId.set(role.needId, existingRoles);
        }
        if (eventNeedIds.length === 0) {
          return allNeeds;
        }
        const participantCountsByNeedId = await this.getEventParticipantCountsByNeedIdsTx(db, eventNeedIds);
        return allNeeds.map((need) => ({
          ...need,
          volunteersCount: need.needType === "EVENT" /* EVENT */ ? participantCountsByNeedId.get(need.id) ?? 0 : need.volunteersCount,
          eventLastDate: need.needType === "EVENT" /* EVENT */ ? this.getEventLastDate(need, rolesByNeedId.get(need.id) ?? []) : null,
          eventRolePreviewLabel: need.needType === "EVENT" /* EVENT */ ? this.buildEventRolePreviewLabel(need, rolesByNeedId.get(need.id) ?? []) : null
        }));
      }
      async markExpiredFloatingNeedsUnfulfilled() {
        const today = getCurrentDateInNewYork();
        const updatedRows = await db.update(needs).set({
          status: "UNFULFILLED" /* UNFULFILLED */,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(
          and(
            eq(needs.status, "FLOATING" /* FLOATING */),
            sql`${needs.needType} <> ${"EVENT" /* EVENT */}`,
            sql`${needs.endDate} IS NOT NULL`,
            sql`${needs.endDate} < ${today}`
          )
        ).returning({ id: needs.id });
        return updatedRows.length;
      }
      async markExpiredEventNeedsFulfilled() {
        const candidates = await db.select().from(needs).where(
          and(
            eq(needs.needType, "EVENT" /* EVENT */),
            inArray(needs.status, ["FLOATING" /* FLOATING */, "PLEDGED" /* PLEDGED */, "RECURRING" /* RECURRING */])
          )
        );
        if (candidates.length === 0) return 0;
        const candidateIds = candidates.map((need) => need.id);
        const roleRows = await db.select({ needId: eventRoles.needId, slotDate: eventRoles.slotDate }).from(eventRoles).where(and(inArray(eventRoles.needId, candidateIds), eq(eventRoles.isActive, true)));
        const rolesByNeedId = /* @__PURE__ */ new Map();
        for (const row of roleRows) {
          const list = rolesByNeedId.get(row.needId) ?? [];
          list.push({ slotDate: row.slotDate });
          rolesByNeedId.set(row.needId, list);
        }
        const expiredIds = candidates.filter((need) => this.isEventEnded(need, rolesByNeedId.get(need.id) ?? [])).map((need) => need.id);
        if (expiredIds.length === 0) return 0;
        const updatedRows = await db.update(needs).set({ status: "FULFILLED" /* FULFILLED */, updatedAt: /* @__PURE__ */ new Date() }).where(inArray(needs.id, expiredIds)).returning({ id: needs.id });
        return updatedRows.length;
      }
      async updateNeedStatus(id, status) {
        const now = /* @__PURE__ */ new Date();
        const [updatedNeed] = await db.update(needs).set({
          status,
          updatedAt: now
        }).where(eq(needs.id, id)).returning();
        return updatedNeed;
      }
      async updateNeed(id, updatedData) {
        return await db.transaction(async (tx) => {
          const [currentNeed] = await tx.select().from(needs).where(eq(needs.id, id));
          if (!currentNeed) return void 0;
          const now = /* @__PURE__ */ new Date();
          const nextNeedType = updatedData.needType || "ONETIME" /* ONETIME */;
          const isEventNeed = nextNeedType === "EVENT" /* EVENT */;
          const normalizedCategories = this.normalizeNeedCategories(
            updatedData.category,
            updatedData.categorySelections
          );
          const [updatedNeed] = await tx.update(needs).set({
            title: updatedData.title,
            description: updatedData.description,
            category: normalizedCategories.primaryCategory,
            categorySelections: normalizedCategories.categorySelections,
            neededBy: updatedData.neededBy || null,
            eventDate: updatedData.eventDate || null,
            eventTime: this.formatEventTimeRange(
              updatedData.eventStartTime,
              updatedData.eventEndTime,
              updatedData.eventTime || null
            ),
            eventStartTime: updatedData.eventStartTime || null,
            eventEndTime: updatedData.eventEndTime || null,
            eventLocation: updatedData.eventLocation || null,
            estimatedCost: updatedData.estimatedCost || null,
            allowItemDonations: isEventNeed ? false : updatedData.allowItemDonations ?? true,
            allowMoneyDonations: false,
            needType: nextNeedType,
            startDate: updatedData.startDate || null,
            endDate: updatedData.endDate || null,
            imageUrl: updatedData.imageUrl || null,
            redirectUrl: updatedData.redirectUrl || null,
            status: updatedData.status || "FLOATING" /* FLOATING */,
            volunteersNeeded: updatedData.volunteersNeeded || null,
            volunteersCount: currentNeed.volunteersCount || 0,
            recipientName: updatedData.recipientName || null,
            recipientPhone: updatedData.recipientPhone || null,
            recipientEmail: updatedData.recipientEmail || null,
            recipientAddress: updatedData.recipientAddress || null,
            recipientNotes: updatedData.recipientNotes || null,
            recipientDob: updatedData.recipientDob || null,
            recipientIsWidow: updatedData.recipientIsWidow ?? null,
            recipientIsSingleParent: updatedData.recipientIsSingleParent ?? null,
            recipientInsurance: updatedData.recipientInsurance || null,
            recipientMedicaid: updatedData.recipientMedicaid ?? null,
            recipientMedicare: updatedData.recipientMedicare ?? null,
            recipientSocialSecurity: updatedData.recipientSocialSecurity ?? null,
            recipientSnap: updatedData.recipientSnap ?? null,
            recipientDisability: updatedData.recipientDisability ?? null,
            excludeFromEmail: updatedData.excludeFromEmail ?? false,
            updatedAt: now
          }).where(eq(needs.id, id)).returning();
          if (isEventNeed) {
            if (Array.isArray(updatedData.eventRoles)) {
              await this.syncEventRolesForNeedTx(tx, id, updatedData.eventRoles);
            }
          } else {
            await tx.delete(eventRoles).where(eq(eventRoles.needId, id));
          }
          return updatedNeed;
        });
      }
      async deleteNeed(id) {
        await db.delete(pledges).where(eq(pledges.needId, id));
        const result = await db.delete(needs).where(eq(needs.id, id)).returning({ id: needs.id });
        return result.length > 0;
      }
      // Pledge methods
      async createPledge(insertPledge) {
        return await db.transaction(async (tx) => {
          const [need] = await tx.select().from(needs).where(eq(needs.id, insertPledge.needId));
          if (!need) {
            throw new Error("Need not found");
          }
          const normalizedEmail = insertPledge.email.trim().toLowerCase();
          const selectedRoleIds = this.normalizeEventRoleSelections(insertPledge.selectedEventRoleIds);
          const selectedRoleQuantities = this.normalizeEventRoleQuantities(
            insertPledge.selectedEventRoleQuantities,
            selectedRoleIds
          );
          let selectedRoles = [];
          if (need.needType === "EVENT" /* EVENT */) {
            const activeRoles = await tx.select().from(eventRoles).where(and(eq(eventRoles.needId, need.id), eq(eventRoles.isActive, true)));
            if (this.isEventEnded(need, activeRoles)) {
              throw new EventSignupValidationError("This event has ended and is no longer accepting sign-ups.");
            }
            const selectableRoles = activeRoles.filter((role) => !this.isEventRoleEnded(need, role));
            if (activeRoles.length > 0 && selectableRoles.length === 0) {
              throw new EventSignupValidationError("No current sign-up slots are available for this event.");
            }
            if (selectableRoles.length > 0 && selectedRoleIds.length === 0) {
              throw new EventSignupValidationError("Please select at least one sign-up slot.");
            }
            if (selectedRoleIds.length > 0) {
              const roles = selectableRoles.filter((role) => selectedRoleIds.includes(role.id));
              if (roles.length !== selectedRoleIds.length) {
                throw new EventSignupValidationError("One or more selected slots are no longer available.");
              }
              for (const role of roles) {
                const [existingSignup] = await tx.select({ id: eventRoleSignups.id }).from(eventRoleSignups).where(
                  and(
                    eq(eventRoleSignups.eventRoleId, role.id),
                    eq(eventRoleSignups.signerEmail, normalizedEmail)
                  )
                ).limit(1);
                if (existingSignup) {
                  throw new EventSlotConflictError(`You are already signed up for "${role.name}".`);
                }
                if (typeof role.capacity === "number" && role.capacity > 0) {
                  const [countRow] = await tx.select({ filledCount: sql`coalesce(sum(${eventRoleSignups.quantity}), 0)::int` }).from(eventRoleSignups).where(eq(eventRoleSignups.eventRoleId, role.id));
                  const requestedQuantity = selectedRoleQuantities.get(role.id) ?? 1;
                  const remainingCapacity = role.capacity - (countRow?.filledCount || 0);
                  if (remainingCapacity <= 0) {
                    throw new EventSlotConflictError(`"${role.name}" is full. Please choose another slot.`);
                  }
                  if (requestedQuantity > remainingCapacity) {
                    throw new EventSlotConflictError(
                      `Only ${remainingCapacity} spot${remainingCapacity === 1 ? "" : "s"} left for "${role.name}".`
                    );
                  }
                }
              }
              selectedRoles = roles.sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id).map((role) => ({
                id: role.id,
                name: role.name,
                slotDate: role.slotDate,
                startTime: role.startTime,
                endTime: role.endTime,
                quantity: selectedRoleQuantities.get(role.id) ?? 1
              }));
            }
          }
          const [pledge] = await tx.insert(pledges).values({
            needId: insertPledge.needId,
            firstName: insertPledge.firstName,
            lastName: insertPledge.lastName,
            email: insertPledge.email,
            phone: insertPledge.phone || null,
            organization: insertPledge.organization || null,
            notes: insertPledge.notes || null,
            donationType: insertPledge.donationType,
            isOngoingCommitment: insertPledge.isOngoingCommitment ?? null,
            subscribeToEmails: insertPledge.subscribeToEmails ?? true,
            paymentCompleted: insertPledge.paymentCompleted ?? false
          }).returning();
          if (need.needType === "EVENT" /* EVENT */) {
            if (selectedRoles.length > 0) {
              await tx.insert(eventRoleSignups).values(
                selectedRoles.map((role) => ({
                  pledgeId: pledge.id,
                  needId: need.id,
                  eventRoleId: role.id,
                  signerEmail: normalizedEmail,
                  quantity: role.quantity ?? 1
                }))
              );
            }
            await this.recalculateEventNeedStatsTx(tx, need.id);
            return {
              ...pledge,
              selectedEventRoles: selectedRoles
            };
          }
          if (need.needType === "GROUP" /* GROUP */) {
            const currentCount = (need.volunteersCount || 0) + 1;
            await tx.update(needs).set({
              volunteersCount: currentCount,
              updatedAt: /* @__PURE__ */ new Date(),
              // Requested volunteers are informational for group projects and should not cap sign-ups.
              status: "FLOATING" /* FLOATING */
            }).where(eq(needs.id, insertPledge.needId));
          } else if (need.status !== "RECURRING" /* RECURRING */) {
            await tx.update(needs).set({
              status: "PLEDGED" /* PLEDGED */,
              updatedAt: /* @__PURE__ */ new Date()
            }).where(eq(needs.id, insertPledge.needId));
          }
          return pledge;
        });
      }
      async getPledge(id) {
        const [pledge] = await db.select().from(pledges).where(eq(pledges.id, id));
        return pledge;
      }
      async getPledgesByNeedId(needId) {
        return await db.select().from(pledges).where(eq(pledges.needId, needId));
      }
      async updateEventSignupByPledgeId(pledgeId, updates) {
        return await db.transaction(async (tx) => {
          const [existingPledge] = await tx.select().from(pledges).where(eq(pledges.id, pledgeId)).limit(1);
          if (!existingPledge) {
            throw new EventSignupValidationError("Sign-up record not found.", 404);
          }
          const [need] = await tx.select().from(needs).where(eq(needs.id, existingPledge.needId)).limit(1);
          if (!need || need.needType !== "EVENT" /* EVENT */) {
            throw new EventSignupValidationError("This sign-up can only be managed for event needs.", 400);
          }
          const normalizedEmail = this.normalizeSignerEmail(updates.email);
          const selectedRoleIds = this.normalizeEventRoleSelections(updates.selectedEventRoleIds);
          const existingSignupRows = await tx.select({
            eventRoleId: eventRoleSignups.eventRoleId,
            quantity: eventRoleSignups.quantity
          }).from(eventRoleSignups).where(eq(eventRoleSignups.pledgeId, pledgeId));
          const existingQuantities = new Map(
            existingSignupRows.map((row) => [
              row.eventRoleId,
              Number.isInteger(row.quantity) && row.quantity > 0 ? row.quantity : 1
            ])
          );
          const selectedRoleQuantities = this.normalizeEventRoleQuantities(
            updates.selectedEventRoleQuantities,
            selectedRoleIds,
            existingQuantities
          );
          const activeRoles = await tx.select().from(eventRoles).where(and(eq(eventRoles.needId, need.id), eq(eventRoles.isActive, true)));
          if (activeRoles.length > 0 && selectedRoleIds.length === 0) {
            throw new EventSignupValidationError("Please select at least one sign-up slot.");
          }
          const selectedRoles = activeRoles.filter((role) => selectedRoleIds.includes(role.id));
          if (selectedRoles.length !== selectedRoleIds.length) {
            throw new EventSignupValidationError("One or more selected slots are no longer available.");
          }
          for (const role of selectedRoles) {
            const [existingConflict] = await tx.select({ id: eventRoleSignups.id }).from(eventRoleSignups).where(
              and(
                eq(eventRoleSignups.eventRoleId, role.id),
                eq(eventRoleSignups.signerEmail, normalizedEmail),
                sql`${eventRoleSignups.pledgeId} <> ${pledgeId}`
              )
            ).limit(1);
            if (existingConflict) {
              throw new EventSlotConflictError(`You are already signed up for "${role.name}".`);
            }
            if (typeof role.capacity === "number" && role.capacity > 0) {
              const [countRow] = await tx.select({ filledCount: sql`coalesce(sum(${eventRoleSignups.quantity}), 0)::int` }).from(eventRoleSignups).where(
                and(
                  eq(eventRoleSignups.eventRoleId, role.id),
                  sql`${eventRoleSignups.pledgeId} <> ${pledgeId}`
                )
              );
              const requestedQuantity = selectedRoleQuantities.get(role.id) ?? 1;
              const remainingCapacity = role.capacity - (countRow?.filledCount || 0);
              if (remainingCapacity <= 0) {
                throw new EventSlotConflictError(`"${role.name}" is full. Please choose another slot.`);
              }
              if (requestedQuantity > remainingCapacity) {
                throw new EventSlotConflictError(
                  `Only ${remainingCapacity} spot${remainingCapacity === 1 ? "" : "s"} left for "${role.name}".`
                );
              }
            }
          }
          await tx.delete(eventRoleSignups).where(eq(eventRoleSignups.pledgeId, pledgeId));
          const nextSelectedRoles = selectedRoles.sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id).map((role) => ({
            id: role.id,
            name: role.name,
            slotDate: role.slotDate,
            startTime: role.startTime,
            endTime: role.endTime,
            quantity: selectedRoleQuantities.get(role.id) ?? 1
          }));
          if (nextSelectedRoles.length > 0) {
            await tx.insert(eventRoleSignups).values(
              nextSelectedRoles.map((role) => ({
                pledgeId,
                needId: need.id,
                eventRoleId: role.id,
                signerEmail: normalizedEmail,
                quantity: role.quantity ?? 1
              }))
            );
          }
          const [updatedPledge] = await tx.update(pledges).set({
            firstName: updates.firstName.trim(),
            lastName: updates.lastName.trim(),
            email: updates.email.trim(),
            phone: updates.phone || null,
            organization: updates.organization || null,
            notes: updates.notes || null
          }).where(eq(pledges.id, pledgeId)).returning();
          if (!updatedPledge) {
            throw new EventSignupValidationError("Failed to update sign-up details.", 500);
          }
          await this.recalculateEventNeedStatsTx(tx, need.id);
          return {
            ...updatedPledge,
            selectedEventRoles: nextSelectedRoles
          };
        });
      }
      async cancelEventSignupByPledgeId(pledgeId) {
        return await db.transaction(async (tx) => {
          const [existingPledge] = await tx.select().from(pledges).where(eq(pledges.id, pledgeId)).limit(1);
          if (!existingPledge) {
            throw new EventSignupValidationError("Sign-up record not found.", 404);
          }
          const [need] = await tx.select().from(needs).where(eq(needs.id, existingPledge.needId)).limit(1);
          if (!need || need.needType !== "EVENT" /* EVENT */) {
            throw new EventSignupValidationError("This sign-up can only be canceled for event needs.", 400);
          }
          const deleted = await tx.delete(pledges).where(eq(pledges.id, pledgeId)).returning({ id: pledges.id });
          if (deleted.length === 0) {
            throw new EventSignupValidationError("Sign-up record not found.", 404);
          }
          return await this.recalculateEventNeedStatsTx(tx, need.id);
        });
      }
      async getEventRolesByNeedId(needId, includeInactive = false) {
        return await db.select().from(eventRoles).where(
          includeInactive ? eq(eventRoles.needId, needId) : and(eq(eventRoles.needId, needId), eq(eventRoles.isActive, true))
        ).orderBy(asc(eventRoles.displayOrder), asc(eventRoles.id));
      }
      async getEventRolesWithStatsByNeedId(needId, includeInactive = false) {
        const roles = await this.getEventRolesByNeedId(needId, includeInactive);
        if (roles.length === 0) return [];
        const counts = await db.select({
          eventRoleId: eventRoleSignups.eventRoleId,
          filledCount: sql`coalesce(sum(${eventRoleSignups.quantity}), 0)::int`
        }).from(eventRoleSignups).where(eq(eventRoleSignups.needId, needId)).groupBy(eventRoleSignups.eventRoleId);
        const countByRoleId = new Map(counts.map((row) => [row.eventRoleId, row.filledCount]));
        return roles.map((role) => {
          const filledCount = countByRoleId.get(role.id) || 0;
          const remainingCount = typeof role.capacity === "number" && role.capacity > 0 ? Math.max(role.capacity - filledCount, 0) : null;
          return {
            ...role,
            filledCount,
            remainingCount,
            isFull: remainingCount === 0
          };
        });
      }
      async getEventSignupSummaryByNeedId(needId) {
        const [roleMeta] = await db.select({
          roleCount: sql`count(*)::int`,
          unlimitedRoleCount: sql`count(*) filter (where ${eventRoles.capacity} is null)::int`,
          slotCapacityTotal: sql`coalesce(sum(${eventRoles.capacity}), 0)::int`
        }).from(eventRoles).where(and(eq(eventRoles.needId, needId), eq(eventRoles.isActive, true)));
        const hasRoleSlots = (roleMeta?.roleCount ?? 0) > 0;
        if (hasRoleSlots) {
          const [signupSummary] = await db.select({
            slotSignupsTotal: sql`coalesce(sum(${eventRoleSignups.quantity}), 0)::int`
          }).from(eventRoleSignups).where(eq(eventRoleSignups.needId, needId));
          const uniquePeopleTotal = await this.getEventParticipantCountByNeedIdTx(db, needId);
          return {
            slotSignupsTotal: signupSummary?.slotSignupsTotal ?? 0,
            slotCapacityTotal: (roleMeta?.unlimitedRoleCount ?? 0) > 0 ? null : roleMeta?.slotCapacityTotal ?? 0,
            uniquePeopleTotal,
            hasRoleSlots: true
          };
        }
        const [legacyNeed] = await db.select({
          volunteersNeeded: needs.volunteersNeeded
        }).from(needs).where(eq(needs.id, needId)).limit(1);
        const [legacySummary] = await db.select({
          slotSignupsTotal: sql`count(*)::int`,
          uniquePeopleTotal: sql`count(distinct lower(trim(${pledges.email})))::int`
        }).from(pledges).where(eq(pledges.needId, needId));
        return {
          slotSignupsTotal: legacySummary?.slotSignupsTotal ?? 0,
          slotCapacityTotal: legacyNeed?.volunteersNeeded ?? null,
          uniquePeopleTotal: legacySummary?.uniquePeopleTotal ?? 0,
          hasRoleSlots: false
        };
      }
      async getEventRoleSelectionsByPledgeIds(pledgeIds) {
        const uniquePledgeIds = Array.from(new Set(pledgeIds.filter((id) => Number.isInteger(id) && id > 0)));
        if (uniquePledgeIds.length === 0) return /* @__PURE__ */ new Map();
        const rows = await db.select({
          pledgeId: eventRoleSignups.pledgeId,
          roleId: eventRoles.id,
          roleName: eventRoles.name,
          slotDate: eventRoles.slotDate,
          startTime: eventRoles.startTime,
          endTime: eventRoles.endTime,
          quantity: eventRoleSignups.quantity,
          displayOrder: eventRoles.displayOrder
        }).from(eventRoleSignups).innerJoin(eventRoles, eq(eventRoleSignups.eventRoleId, eventRoles.id)).where(inArray(eventRoleSignups.pledgeId, uniquePledgeIds)).orderBy(asc(eventRoles.displayOrder), asc(eventRoles.id));
        const map = /* @__PURE__ */ new Map();
        for (const row of rows) {
          if (!map.has(row.pledgeId)) {
            map.set(row.pledgeId, []);
          }
          map.get(row.pledgeId).push({
            id: row.roleId,
            name: row.roleName,
            slotDate: row.slotDate,
            startTime: row.startTime,
            endTime: row.endTime,
            quantity: row.quantity
          });
        }
        return map;
      }
    };
    storage = new DatabaseStorage();
  }
});

// server/email-delivery-settings.ts
import { eq as eq2, sql as sql2 } from "drizzle-orm";
async function ensureEmailDeliverySettings() {
  if (emailDeliverySettingsEnsured) {
    return;
  }
  await db.execute(sql2.raw(`
    CREATE TABLE IF NOT EXISTS email_delivery_settings (
      key TEXT PRIMARY KEY,
      emails_enabled BOOLEAN NOT NULL DEFAULT true,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `));
  await db.execute(sql2.raw(`
    INSERT INTO email_delivery_settings (key, emails_enabled)
    VALUES ('default', true)
    ON CONFLICT (key) DO NOTHING;
  `));
  emailDeliverySettingsEnsured = true;
}
async function getEmailDeliverySettings() {
  await ensureEmailDeliverySettings();
  const [settings] = await db.select().from(emailDeliverySettings).where(eq2(emailDeliverySettings.key, DEFAULT_EMAIL_DELIVERY_SETTINGS_KEY)).limit(1);
  if (settings) {
    return settings;
  }
  const updatedAt = /* @__PURE__ */ new Date();
  await db.insert(emailDeliverySettings).values({
    key: DEFAULT_EMAIL_DELIVERY_SETTINGS_KEY,
    emailsEnabled: true,
    updatedAt
  }).onConflictDoNothing();
  return {
    key: DEFAULT_EMAIL_DELIVERY_SETTINGS_KEY,
    emailsEnabled: true,
    updatedAt
  };
}
async function areEmailsEnabled() {
  const settings = await getEmailDeliverySettings();
  return settings.emailsEnabled;
}
var DEFAULT_EMAIL_DELIVERY_SETTINGS_KEY, emailDeliverySettingsEnsured;
var init_email_delivery_settings = __esm({
  "server/email-delivery-settings.ts"() {
    "use strict";
    init_db();
    init_schema();
    DEFAULT_EMAIL_DELIVERY_SETTINGS_KEY = "default";
    emailDeliverySettingsEnsured = false;
  }
});

// server/email.ts
import fetch2 from "node-fetch";
import { createHmac } from "crypto";
function stripHtml(html) {
  return html.replace(/<br\s*\/?>/gi, " ").replace(/<\/p>\s*<p[^>]*>/gi, " ").replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/\s+/g, " ").trim();
}
function escapeHtml(text2) {
  return text2.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function getDonationTypeLabel(donationType) {
  if (donationType === "money") return "Financial Support";
  if (donationType === "signup") return "Event Sign-Up";
  return "Item Support";
}
function parseTimeToMinutes2(time) {
  if (!time) return Number.MAX_SAFE_INTEGER;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time.trim());
  if (!match) return Number.MAX_SAFE_INTEGER;
  return Number(match[1]) * 60 + Number(match[2]);
}
function formatRoleSlot(role) {
  const dateLabel = role.slotDate ? `${formatDateInNewYork(role.slotDate, {
    month: "2-digit",
    day: "2-digit",
    year: "2-digit"
  })} ` : "";
  const quantityLabel = typeof role.quantity === "number" && role.quantity > 1 ? ` x${role.quantity}` : "";
  return `${role.name}${quantityLabel} (${dateLabel}${formatTimeRangeForDisplay(role.startTime, role.endTime)})`;
}
function sortEventRoles(roles) {
  return [...roles].sort((a, b) => {
    const aDate = a.slotDate || "9999-12-31";
    const bDate = b.slotDate || "9999-12-31";
    if (aDate !== bDate) return aDate.localeCompare(bDate);
    const aStart = parseTimeToMinutes2(a.startTime);
    const bStart = parseTimeToMinutes2(b.startTime);
    if (aStart !== bStart) return aStart - bStart;
    return a.id - b.id;
  });
}
function renderSelectedSlotsHtml(selectedEventRoles) {
  if (!selectedEventRoles || selectedEventRoles.length === 0) return "";
  const rows = sortEventRoles(selectedEventRoles).map((role) => `<li style="margin: 0 0 4px 0;">${escapeHtml(formatRoleSlot(role))}</li>`).join("");
  return `<div style="margin-top: 8px;">
    <p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Selected Slots:</strong></p>
    <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #333;">${rows}</ul>
  </div>`;
}
function renderSelectedSlotsText(selectedEventRoles) {
  if (!selectedEventRoles || selectedEventRoles.length === 0) return "";
  const lines = sortEventRoles(selectedEventRoles).map((role) => `- ${formatRoleSlot(role)}`).join("\n");
  return `Selected Slots:
${lines}`;
}
function getEventAddress(need) {
  return need.eventLocation?.trim() || "";
}
function renderEventAddressHtml(need) {
  const address = getEventAddress(need);
  if (!address) return "";
  return `<p style="margin: 4px 0 0 0; font-size: 14px; color: #333;"><strong>Address:</strong> ${escapeHtml(address)}</p>`;
}
function renderEventAddressText(need) {
  const address = getEventAddress(need);
  return address ? `Address: ${address}` : "";
}
function wrapInEmailShell(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f4;">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%;">
          <tr>
            <td style="background-color: #991A1E; padding: 20px 24px; border-radius: 8px 8px 0 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="right">
                    <img
                      src="${BRAND_LOGO_URL}"
                      alt="VFW Post 7570"
                      width="200"
                      style="display: block; height: auto; max-width: 100%;"
                    />
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color: #ffffff; padding: 32px 24px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9f9f9; padding: 24px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0 0 4px 0; font-size: 13px; color: #888;">VFW Post 7570</p>
              <p style="margin: 0 0 4px 0; font-size: 13px; color: #888;">9160 Lawrenceburg Rd, Harrison, OH 45030</p>
              <p style="margin: 0; font-size: 13px; color: #888;">
                <a href="mailto:${CONTACT_EMAIL}" style="color: #164C83; text-decoration: none;">${CONTACT_EMAIL}</a>
                &nbsp;|&nbsp;
                <a href="tel:${CONTACT_PHONE}" style="color: #164C83; text-decoration: none;">${CONTACT_PHONE}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
function generateSecureToken(entityId, action) {
  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET environment variable must be set");
  }
  const expiryTime = Date.now() + 7 * 24 * 60 * 60 * 1e3;
  const payload = `${entityId}:${action}:${expiryTime}`;
  const hmac = createHmac("sha256", process.env.SESSION_SECRET);
  hmac.update(payload);
  const signature = hmac.digest("hex");
  return Buffer.from(`${payload}:${signature}`).toString("base64");
}
function buildEventSignupManageLink(pledgeId) {
  try {
    const token = generateSecureToken(pledgeId, "manage_signup");
    return `${HOST_URL}/signup/manage?token=${encodeURIComponent(token)}`;
  } catch (error) {
    console.error("Error generating manage-signup link token:", error);
    return null;
  }
}
function toRecipients(to) {
  return to.split(",").map((part) => part.trim()).filter(Boolean).map((email) => ({ email }));
}
async function sendEmail(params) {
  if (!params.ignoreEmailDeliveryPause) {
    try {
      const emailsEnabled = await areEmailsEnabled();
      if (!emailsEnabled) {
        console.log(`Email delivery paused; skipping "${params.subject}" to ${params.to}`);
        return false;
      }
    } catch (error) {
      console.warn("Email delivery settings check failed; continuing with send attempt:", error);
    }
  }
  if (!MAILERSEND_API_TOKEN) {
    console.error("MailerSend email error: MAILERSEND_API_TOKEN (or MAILERSEND_API_KEY) is not configured");
    return false;
  }
  const recipients = toRecipients(params.to);
  if (recipients.length === 0) {
    console.error("MailerSend email error: at least one recipient is required");
    return false;
  }
  const fromEmail = MAILERSEND_FROM_EMAIL || params.from;
  const payload = {
    from: { email: fromEmail, name: MAILERSEND_FROM_NAME },
    to: recipients,
    subject: params.subject,
    text: params.text || void 0,
    html: params.html || params.text || "",
    settings: {
      track_clicks: false,
      track_opens: false,
      track_content: false
    }
  };
  if (params.replyTo?.trim()) {
    payload.reply_to = { email: params.replyTo.trim() };
  } else if (fromEmail !== params.from && params.from.trim()) {
    payload.reply_to = { email: params.from.trim() };
  }
  if (typeof params.sendAtUnix === "number" && Number.isFinite(params.sendAtUnix)) {
    payload.send_at = Math.floor(params.sendAtUnix);
  }
  try {
    const response = await fetch2(`${MAILERSEND_API_BASE}email`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MAILERSEND_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`MailerSend email error (${response.status}):`, errorText);
      return false;
    }
    return true;
  } catch (error) {
    console.error("MailerSend email error:", error);
    return false;
  }
}
async function sendPledgeConfirmation(need, pledge) {
  const isEventSignup = need.needType === "EVENT" /* EVENT */ || pledge.donationType === "signup";
  const descriptionText = stripHtml(need.description || "No description provided");
  if (isEventSignup) {
    const subject2 = "Thanks for signing up for our event!";
    const manageLink = buildEventSignupManageLink(pledge.id);
    const bodyHtml2 = `
              <h2 style="margin: 0 0 8px 0; font-size: 22px; color: #231F20;">Thanks for signing up for our event!</h2>
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #555; line-height: 1.5;">
                We appreciate your willingness to serve with VFW Post 7570.
              </p>

              <p style="font-size: 15px; color: #333; line-height: 1.6; margin: 0 0 24px 0;">Dear ${escapeHtml(pledge.firstName)},</p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                <tr>
                  <td style="padding: 0;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9f9f9; border-radius: 8px; overflow: hidden;">
                      <tr>
                        <td style="padding: 20px 24px;">
                          <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #231F20; font-weight: bold;">Event You've Volunteered For</h3>
                          <p style="margin: 0; font-size: 14px; color: #333;"><strong>Title:</strong> ${escapeHtml(need.title)}</p>
                          ${renderEventAddressHtml(need)}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                <tr>
                  <td style="padding: 0;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9f9f9; border-radius: 8px; overflow: hidden;">
                      <tr>
                        <td style="padding: 20px 24px;">
                          <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #164C83; font-weight: bold;">Sign Up Details</h3>
                          <p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Name:</strong> ${escapeHtml(pledge.firstName)} ${escapeHtml(pledge.lastName)}</p>
                          <p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Email:</strong> ${escapeHtml(pledge.email)}</p>
                          ${pledge.phone ? `<p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Phone:</strong> ${escapeHtml(pledge.phone)}</p>` : ""}
                          ${pledge.organization ? `<p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Church / Organization:</strong> ${escapeHtml(pledge.organization)}</p>` : ""}
                          ${renderSelectedSlotsHtml(pledge.selectedEventRoles)}
                          ${pledge.notes ? `<p style="margin: 4px 0 0 0; font-size: 14px; color: #333;"><strong>Notes:</strong> ${escapeHtml(pledge.notes)}</p>` : ""}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${manageLink ? `
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px;">
                <tr>
                  <td align="center" style="padding: 8px 0;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background-color: #164C83; border-radius: 25px;">
                          <a href="${manageLink}" target="_blank" style="display: inline-block; padding: 12px 30px; font-size: 14px; font-weight: bold; color: #ffffff; text-decoration: none;">Change or Cancel Sign Up</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              ` : ""}

              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding: 8px 0 0 0;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background-color: #991A1E; border-radius: 25px;">
                          <a href="${PUBLIC_URL}" target="_blank" style="display: inline-block; padding: 14px 36px; font-size: 16px; font-weight: bold; color: #ffffff; text-decoration: none;">View Serving Network</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="font-size: 14px; color: #888; text-align: center; margin: 24px 0 0 0;">
                Questions? Contact us at
                <a href="mailto:${CONTACT_EMAIL}" style="color: #164C83; text-decoration: none;">${CONTACT_EMAIL}</a>
                or
                <a href="tel:${CONTACT_PHONE}" style="color: #164C83; text-decoration: none;">${CONTACT_PHONE}</a>
              </p>`;
    const html2 = wrapInEmailShell(subject2, bodyHtml2);
    const text3 = `THANKS FOR SIGNING UP FOR OUR EVENT!

Dear ${pledge.firstName},

We appreciate your willingness to serve with VFW Post 7570.

EVENT YOU'VE VOLUNTEERED FOR
Title: ${need.title}
${renderEventAddressText(need)}

SIGN UP DETAILS
Name: ${pledge.firstName} ${pledge.lastName}
Email: ${pledge.email}
${pledge.phone ? `Phone: ${pledge.phone}` : ""}
${pledge.organization ? `Church / Organization: ${pledge.organization}` : ""}
${renderSelectedSlotsText(pledge.selectedEventRoles)}
${pledge.notes ? `Notes: ${pledge.notes}` : ""}
${manageLink ? `
Change or cancel your sign up: ${manageLink}` : ""}

View the Serving Network: ${PUBLIC_URL}

Questions? Contact us at ${CONTACT_EMAIL} or ${CONTACT_PHONE}

VFW Post 7570
444 S State St, Harrison, OH 45030`;
    return await sendEmail({
      to: pledge.email,
      from: DEFAULT_FROM_EMAIL,
      subject: subject2,
      text: text3,
      html: html2
    });
  }
  const subject = "Thank you for your pledge to VFW Post 7570";
  const bodyHtml = `
              <h2 style="margin: 0 0 8px 0; font-size: 22px; color: #231F20;">Thank You for Your Pledge!</h2>
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #555; line-height: 1.5;">
                Your commitment to help makes a difference in our community.
              </p>

              <p style="font-size: 15px; color: #333; line-height: 1.6; margin: 0 0 8px 0;">Dear ${escapeHtml(pledge.firstName)},</p>
              <p style="font-size: 15px; color: #555; line-height: 1.6; margin: 0 0 8px 0;">
                Thank you for your generous pledge to help with a need in our community! We appreciate your willingness to serve and make a difference through VFW Post 7570.
              </p>
              <p style="font-size: 15px; color: #555; line-height: 1.6; margin: 0 0 24px 0;">
                Someone from our team will be in touch with you within 2-3 business days (if not sooner) to coordinate the details of fulfilling this need.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                <tr>
                  <td style="padding: 0;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9f9f9; border-radius: 8px; overflow: hidden;">
                      <tr>
                        <td style="padding: 20px 24px;">
                          <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #231F20; font-weight: bold;">Need You've Pledged to Help With</h3>
                          <p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Title:</strong> ${escapeHtml(need.title)}</p>
                          <p style="margin: 0 0 4px 0; font-size: 13px; color: #888; text-transform: uppercase; letter-spacing: 0.5px;">${escapeHtml(need.category)}</p>
                          <p style="margin: 0 0 4px 0; font-size: 14px; color: #555; line-height: 1.5;">${escapeHtml(descriptionText)}</p>
                          ${need.neededBy ? `<p style="margin: 4px 0 0 0; font-size: 14px; color: #333;"><strong>Needed By:</strong> ${formatDateInNewYork(need.neededBy, { month: "long", day: "numeric", year: "numeric" })}</p>` : ""}
                          ${need.estimatedCost ? `<p style="margin: 4px 0 0 0; font-size: 14px; color: #333;"><strong>Estimated Cost:</strong> $${(need.estimatedCost / 100).toFixed(2)}</p>` : ""}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                <tr>
                  <td style="padding: 0;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9f9f9; border-radius: 8px; overflow: hidden;">
                      <tr>
                        <td style="padding: 20px 24px;">
                          <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #164C83; font-weight: bold;">Your Pledge Details</h3>
                          <p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Name:</strong> ${escapeHtml(pledge.firstName)} ${escapeHtml(pledge.lastName)}</p>
                          <p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Email:</strong> ${escapeHtml(pledge.email)}</p>
                          ${pledge.phone ? `<p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Phone:</strong> ${escapeHtml(pledge.phone)}</p>` : ""}
                          ${pledge.organization ? `<p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Church / Organization:</strong> ${escapeHtml(pledge.organization)}</p>` : ""}
                          <p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Support Type:</strong> ${getDonationTypeLabel(pledge.donationType)}</p>
                          ${renderSelectedSlotsHtml(pledge.selectedEventRoles)}
                          ${pledge.notes ? `<p style="margin: 4px 0 0 0; font-size: 14px; color: #333;"><strong>Notes:</strong> ${escapeHtml(pledge.notes)}</p>` : ""}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding: 8px 0 0 0;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background-color: #991A1E; border-radius: 25px;">
                          <a href="${PUBLIC_URL}" target="_blank" style="display: inline-block; padding: 14px 36px; font-size: 16px; font-weight: bold; color: #ffffff; text-decoration: none;">View Serving Network</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="font-size: 14px; color: #888; text-align: center; margin: 24px 0 0 0;">
                Questions? Contact us at
                <a href="mailto:${CONTACT_EMAIL}" style="color: #164C83; text-decoration: none;">${CONTACT_EMAIL}</a>
                or
                <a href="tel:${CONTACT_PHONE}" style="color: #164C83; text-decoration: none;">${CONTACT_PHONE}</a>
              </p>`;
  const html = wrapInEmailShell(subject, bodyHtml);
  const text2 = `THANK YOU FOR YOUR PLEDGE!

Dear ${pledge.firstName},

Thank you for your generous pledge to help with a need in our community! We appreciate your willingness to serve and make a difference through VFW Post 7570.

Someone from our team will be in touch with you within 2-3 business days (if not sooner) to coordinate the details of fulfilling this need.

NEED YOU'VE PLEDGED TO HELP WITH
Title: ${need.title}
Category: ${need.category}
${descriptionText}
${need.neededBy ? `Needed By: ${formatDateInNewYork(need.neededBy, { month: "long", day: "numeric", year: "numeric" })}` : ""}
${need.estimatedCost ? `Estimated Cost: $${(need.estimatedCost / 100).toFixed(2)}` : ""}

YOUR PLEDGE DETAILS
Name: ${pledge.firstName} ${pledge.lastName}
Email: ${pledge.email}
${pledge.phone ? `Phone: ${pledge.phone}` : ""}
${pledge.organization ? `Church / Organization: ${pledge.organization}` : ""}
Support Type: ${getDonationTypeLabel(pledge.donationType)}
${renderSelectedSlotsText(pledge.selectedEventRoles)}
${pledge.notes ? `Notes: ${pledge.notes}` : ""}

View the Serving Network: ${PUBLIC_URL}

Questions? Contact us at ${CONTACT_EMAIL} or ${CONTACT_PHONE}

VFW Post 7570
444 S State St, Harrison, OH 45030`;
  return await sendEmail({
    to: pledge.email,
    from: DEFAULT_FROM_EMAIL,
    subject,
    text: text2,
    html
  });
}
async function sendPledgeNotification(need, pledge, adminEmails) {
  const to = Array.isArray(adminEmails) ? adminEmails : [adminEmails];
  const subject = `[VFW Post 7570] New Pledge for "${need.title}"`;
  let fulfillLink = "";
  try {
    const canGenerateFulfillLink = need.status === "PLEDGED" /* PLEDGED */ || need.needType === "GROUP" /* GROUP */ && need.status === "FLOATING" /* FLOATING */;
    if (canGenerateFulfillLink) {
      const fulfillToken = generateSecureToken(need.id, "fulfill");
      fulfillLink = `${HOST_URL}/fulfill?token=${fulfillToken}`;
    }
  } catch (error) {
    console.error("Error generating token for email:", error);
  }
  const descriptionText = stripHtml(need.description || "No description provided");
  const bodyHtml = `
              <h2 style="margin: 0 0 8px 0; font-size: 22px; color: #231F20;">New Pledge Received</h2>
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #555; line-height: 1.5;">
                A need has been pledged in the Serving Network. Please reach out to the donor to coordinate fulfillment.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                <tr>
                  <td style="padding: 0;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9f9f9; border-radius: 8px; overflow: hidden;">
                      <tr>
                        <td style="padding: 20px 24px;">
                          <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #231F20; font-weight: bold;">Need Details</h3>
                          <p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Title:</strong> ${escapeHtml(need.title)}</p>
                          <p style="margin: 0 0 4px 0; font-size: 13px; color: #888; text-transform: uppercase; letter-spacing: 0.5px;">${escapeHtml(need.category)}</p>
                          <p style="margin: 0 0 4px 0; font-size: 14px; color: #555; line-height: 1.5;">${escapeHtml(descriptionText)}</p>
                          ${need.neededBy ? `<p style="margin: 4px 0 0 0; font-size: 14px; color: #333;"><strong>Needed By:</strong> ${formatDateInNewYork(need.neededBy, { month: "long", day: "numeric", year: "numeric" })}</p>` : ""}
                          ${need.estimatedCost ? `<p style="margin: 4px 0 0 0; font-size: 14px; color: #333;"><strong>Estimated Cost:</strong> $${(need.estimatedCost / 100).toFixed(2)}</p>` : ""}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                <tr>
                  <td style="padding: 0;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9f9f9; border-radius: 8px; overflow: hidden;">
                      <tr>
                        <td style="padding: 20px 24px;">
                          <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #164C83; font-weight: bold;">Pledge Contact Information</h3>
                          <p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Name:</strong> ${escapeHtml(pledge.firstName)} ${escapeHtml(pledge.lastName)}</p>
                          <p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Email:</strong> <a href="mailto:${escapeHtml(pledge.email)}" style="color: #164C83; text-decoration: none;">${escapeHtml(pledge.email)}</a></p>
                          ${pledge.phone ? `<p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Phone:</strong> <a href="tel:${escapeHtml(pledge.phone)}" style="color: #164C83; text-decoration: none;">${escapeHtml(pledge.phone)}</a></p>` : ""}
                          ${pledge.organization ? `<p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Church / Organization:</strong> ${escapeHtml(pledge.organization)}</p>` : ""}
                          <p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Support Type:</strong> ${getDonationTypeLabel(pledge.donationType)}</p>
                          ${renderSelectedSlotsHtml(pledge.selectedEventRoles)}
                          ${pledge.notes ? `<p style="margin: 4px 0 0 0; font-size: 14px; color: #333;"><strong>Notes:</strong> ${escapeHtml(pledge.notes)}</p>` : ""}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${fulfillLink ? `
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 8px;">
                <tr>
                  <td align="center" style="padding: 8px 0;">
                    <p style="margin: 0 0 12px 0; font-size: 15px; color: #333; font-weight: bold;">Once the need has been fulfilled, click below:</p>
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background-color: #991A1E; border-radius: 25px;">
                          <a href="${fulfillLink}" target="_blank" style="display: inline-block; padding: 14px 36px; font-size: 16px; font-weight: bold; color: #ffffff; text-decoration: none;">Mark as Fulfilled</a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 10px 0 0 0; font-size: 12px; color: #888;">This link will expire in 7 days and can only be used once.</p>
                  </td>
                </tr>
              </table>
              ` : ""}`;
  const html = wrapInEmailShell(subject, bodyHtml);
  const text2 = `NEW PLEDGE RECEIVED

A need has been pledged in the Serving Network.

NEED DETAILS
Title: ${need.title}
Category: ${need.category}
${descriptionText}
${need.neededBy ? `Needed By: ${formatDateInNewYork(need.neededBy, { month: "long", day: "numeric", year: "numeric" })}` : ""}
${need.estimatedCost ? `Estimated Cost: $${(need.estimatedCost / 100).toFixed(2)}` : ""}

PLEDGE CONTACT INFORMATION
Name: ${pledge.firstName} ${pledge.lastName}
Email: ${pledge.email}
${pledge.phone ? `Phone: ${pledge.phone}` : ""}
${pledge.organization ? `Church / Organization: ${pledge.organization}` : ""}
Support Type: ${getDonationTypeLabel(pledge.donationType)}
${renderSelectedSlotsText(pledge.selectedEventRoles)}
${pledge.notes ? `Notes: ${pledge.notes}` : ""}
${fulfillLink ? `
MARK AS FULFILLED
Once the need has been fulfilled, visit this link:
${fulfillLink}
(This link will expire in 7 days and can only be used once)
` : ""}
Please reach out to the donor to coordinate fulfillment of this need.

VFW Post 7570
444 S State St, Harrison, OH 45030`;
  return await sendEmail({
    to: to.join(","),
    from: DEFAULT_FROM_EMAIL,
    subject,
    text: text2,
    html
  });
}
async function sendEventSignupChangeConfirmation(need, pledge, changeType, recipients, audience) {
  const to = (Array.isArray(recipients) ? recipients : [recipients]).map((value) => value.trim()).filter(Boolean);
  if (to.length === 0) {
    return false;
  }
  const sortedRoles = sortEventRoles(pledge.selectedEventRoles || []);
  const selectedSlotsHtml = sortedRoles.length > 0 ? renderSelectedSlotsHtml(sortedRoles) : '<p style="margin: 0; font-size: 14px; color: #333;"><strong>Selected Slots:</strong> None</p>';
  const selectedSlotsText = sortedRoles.length > 0 ? renderSelectedSlotsText(sortedRoles) : "Selected Slots: None";
  const isUpdated = changeType === "updated";
  const subject = isUpdated ? `Event sign-up updated: ${need.title}` : `Event sign-up canceled: ${need.title}`;
  const heading = isUpdated ? "Event Sign-Up Updated" : "Event Sign-Up Canceled";
  const intro = audience === "volunteer" ? isUpdated ? "This email confirms that your event sign-up details were updated." : "This email confirms that your event sign-up has been canceled." : isUpdated ? "A volunteer has updated their event sign-up details." : "A volunteer has canceled their event sign-up.";
  const detailHeading = isUpdated ? "Current Sign-Up Details" : "Canceled Sign-Up Details";
  const salutation = audience === "volunteer" ? pledge.firstName || "Volunteer" : "Admin Team";
  const bodyHtml = `
              <h2 style="margin: 0 0 8px 0; font-size: 22px; color: #231F20;">${heading}</h2>
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #555; line-height: 1.5;">
                ${intro}
              </p>

              <p style="font-size: 15px; color: #333; line-height: 1.6; margin: 0 0 16px 0;">Dear ${escapeHtml(salutation)},</p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                <tr>
                  <td style="padding: 0;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9f9f9; border-radius: 8px; overflow: hidden;">
                      <tr>
                        <td style="padding: 20px 24px;">
                          <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #231F20; font-weight: bold;">Event</h3>
                          <p style="margin: 0; font-size: 14px; color: #333;"><strong>Title:</strong> ${escapeHtml(need.title)}</p>
                          ${renderEventAddressHtml(need)}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                <tr>
                  <td style="padding: 0;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9f9f9; border-radius: 8px; overflow: hidden;">
                      <tr>
                        <td style="padding: 20px 24px;">
                          <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #164C83; font-weight: bold;">${detailHeading}</h3>
                          <p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Name:</strong> ${escapeHtml(pledge.firstName)} ${escapeHtml(pledge.lastName)}</p>
                          <p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Email:</strong> ${escapeHtml(pledge.email)}</p>
                          ${pledge.phone ? `<p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Phone:</strong> ${escapeHtml(pledge.phone)}</p>` : ""}
                          ${pledge.organization ? `<p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Church / Organization:</strong> ${escapeHtml(pledge.organization)}</p>` : ""}
                          ${selectedSlotsHtml}
                          ${pledge.notes ? `<p style="margin: 4px 0 0 0; font-size: 14px; color: #333;"><strong>Notes:</strong> ${escapeHtml(pledge.notes)}</p>` : ""}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding: 8px 0 0 0;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background-color: #991A1E; border-radius: 25px;">
                          <a href="${PUBLIC_URL}?need=${need.id}" target="_blank" style="display: inline-block; padding: 14px 36px; font-size: 16px; font-weight: bold; color: #ffffff; text-decoration: none;">View Event</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="font-size: 14px; color: #888; text-align: center; margin: 24px 0 0 0;">
                Questions? Contact us at
                <a href="mailto:${CONTACT_EMAIL}" style="color: #164C83; text-decoration: none;">${CONTACT_EMAIL}</a>
                or
                <a href="tel:${CONTACT_PHONE}" style="color: #164C83; text-decoration: none;">${CONTACT_PHONE}</a>
              </p>`;
  const html = wrapInEmailShell(subject, bodyHtml);
  const text2 = `${heading.toUpperCase()}

${intro}

Dear ${salutation},

EVENT
Title: ${need.title}
${renderEventAddressText(need)}

${detailHeading.toUpperCase()}
Name: ${pledge.firstName} ${pledge.lastName}
Email: ${pledge.email}
${pledge.phone ? `Phone: ${pledge.phone}` : ""}
${pledge.organization ? `Church / Organization: ${pledge.organization}` : ""}
${selectedSlotsText}
${pledge.notes ? `Notes: ${pledge.notes}` : ""}

View Event: ${PUBLIC_URL}?need=${need.id}

Questions? Contact us at ${CONTACT_EMAIL} or ${CONTACT_PHONE}

VFW Post 7570
444 S State St, Harrison, OH 45030`;
  return await sendEmail({
    to: to.join(","),
    from: DEFAULT_FROM_EMAIL,
    subject,
    text: text2,
    html
  });
}
async function sendEventSignupReminder(need, recipient, selectedEventRoles, options) {
  if (!selectedEventRoles || selectedEventRoles.length === 0) {
    return false;
  }
  const sortedRoles = sortEventRoles(selectedEventRoles);
  const firstSlot = sortedRoles[0];
  const firstSlotLabel = formatRoleSlot(firstSlot);
  const subject = `Reminder: ${need.title} is tomorrow`;
  const bodyHtml = `
              <h2 style="margin: 0 0 8px 0; font-size: 22px; color: #231F20;">Event Reminder</h2>
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #555; line-height: 1.5;">
                This is a reminder that your event is tomorrow.
              </p>

              <p style="font-size: 15px; color: #333; line-height: 1.6; margin: 0 0 16px 0;">Dear ${escapeHtml(recipient.firstName || "Volunteer")},</p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                <tr>
                  <td style="padding: 0;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9f9f9; border-radius: 8px; overflow: hidden;">
                      <tr>
                        <td style="padding: 20px 24px;">
                          <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #231F20; font-weight: bold;">Event</h3>
                          <p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Title:</strong> ${escapeHtml(need.title)}</p>
                          ${renderEventAddressHtml(need)}
                          <p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>First Slot:</strong> ${escapeHtml(firstSlotLabel)}</p>
                          ${renderSelectedSlotsHtml(sortedRoles)}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding: 8px 0 0 0;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background-color: #991A1E; border-radius: 25px;">
                          <a href="${PUBLIC_URL}?need=${need.id}" target="_blank" style="display: inline-block; padding: 14px 36px; font-size: 16px; font-weight: bold; color: #ffffff; text-decoration: none;">View Event</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="font-size: 14px; color: #888; text-align: center; margin: 24px 0 0 0;">
                Questions? Contact us at
                <a href="mailto:${CONTACT_EMAIL}" style="color: #164C83; text-decoration: none;">${CONTACT_EMAIL}</a>
                or
                <a href="tel:${CONTACT_PHONE}" style="color: #164C83; text-decoration: none;">${CONTACT_PHONE}</a>
              </p>`;
  const html = wrapInEmailShell(subject, bodyHtml);
  const text2 = `EVENT REMINDER

Dear ${recipient.firstName || "Volunteer"},

This is a reminder that your event is tomorrow.

EVENT
Title: ${need.title}
${renderEventAddressText(need)}
First Slot: ${firstSlotLabel}
${renderSelectedSlotsText(sortedRoles)}

View Event: ${PUBLIC_URL}?need=${need.id}

Questions? Contact us at ${CONTACT_EMAIL} or ${CONTACT_PHONE}

VFW Post 7570
444 S State St, Harrison, OH 45030`;
  return await sendEmail({
    to: recipient.email,
    from: DEFAULT_FROM_EMAIL,
    subject,
    text: text2,
    html,
    sendAtUnix: options?.sendAtUnix
  });
}
var MAILERSEND_API_TOKEN, MAILERSEND_API_BASE, DEFAULT_FROM_EMAIL, MAILERSEND_FROM_EMAIL, MAILERSEND_FROM_NAME, HOST_URL, PUBLIC_URL, CONTACT_EMAIL, CONTACT_PHONE, BRAND_LOGO_URL;
var init_email = __esm({
  "server/email.ts"() {
    "use strict";
    init_schema();
    init_timezone();
    init_email_delivery_settings();
    MAILERSEND_API_TOKEN = process.env.MAILERSEND_API_TOKEN?.trim() || process.env.MAILERSEND_API_KEY?.trim();
    MAILERSEND_API_BASE = "https://api.mailersend.com/v1/";
    DEFAULT_FROM_EMAIL = process.env.DEFAULT_FROM_EMAIL?.trim() || "communications@vfwharrisonoh.org";
    MAILERSEND_FROM_EMAIL = process.env.MAILERSEND_FROM_EMAIL?.trim();
    MAILERSEND_FROM_NAME = process.env.MAILERSEND_FROM_NAME?.trim() || "VFW Post 7570";
    HOST_URL = process.env.HOST_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://apps.vfwharrisonoh.org");
    PUBLIC_URL = process.env.PUBLIC_URL || "https://vfwharrisonoh.org/volunteer/";
    CONTACT_EMAIL = process.env.CONTACT_EMAIL?.trim() || "communications@vfwharrisonoh.org";
    CONTACT_PHONE = process.env.CONTACT_PHONE?.trim() || "513-367-7570";
    BRAND_LOGO_URL = process.env.BRAND_LOGO_URL?.trim() || `${HOST_URL}/assets/vfw-logo-full-color.svg`;
  }
});

// server/auth.ts
var auth_exports = {};
__export(auth_exports, {
  hashPassword: () => hashPassword,
  setupAuth: () => setupAuth
});
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import cookieSession from "cookie-session";
import { scrypt as scrypt2, randomBytes as randomBytes2, timingSafeEqual, createHash, createHmac as createHmac2 } from "crypto";
import { promisify as promisify2 } from "util";
import { and as and2, desc as desc2, eq as eq3, gt, isNull } from "drizzle-orm";
import { z } from "zod";
function normalizeUsername(username) {
  return username.trim().toLowerCase();
}
function getClientIp(req) {
  const forwardedFor = req.headers?.["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.length > 0) {
    return forwardedFor.split(",")[0].trim();
  }
  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return String(forwardedFor[0]).trim();
  }
  return req.ip || null;
}
function getUserAgent(req) {
  const ua = req.headers?.["user-agent"];
  return typeof ua === "string" ? ua : null;
}
function getHostUrl() {
  return process.env.HOST_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://apps.vfwharrisonoh.org");
}
async function logAuthEvent(params) {
  try {
    await db.insert(authEvents).values({
      userId: params.userId ?? null,
      usernameAttempt: params.usernameAttempt ?? null,
      eventType: params.eventType,
      ip: params.ip ?? null,
      userAgent: params.userAgent ?? null,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null
    });
  } catch (error) {
    console.error("Failed to write auth event:", error);
  }
}
async function hashPassword(password) {
  const salt = randomBytes2(16).toString("hex");
  const buf = await scryptAsync2(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}
async function comparePasswords(supplied, stored) {
  const parts = stored.split(".");
  const looksHashed = parts.length === 2 && /^[0-9a-f]{128}$/i.test(parts[0]) && /^[0-9a-f]{32}$/i.test(parts[1]);
  if (!looksHashed) {
    return supplied === stored;
  }
  const [hashed, salt] = parts;
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = await scryptAsync2(supplied, salt, 64);
  return timingSafeEqual(hashedBuf, suppliedBuf);
}
function hashMagicToken(token) {
  return createHash("sha256").update(token).digest("hex");
}
function getTokenSecret() {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret) {
    throw new Error("SESSION_SECRET environment variable must be set");
  }
  return secret;
}
function createAuthToken(userId) {
  const payload = {
    userId,
    exp: Date.now() + AUTH_TOKEN_TTL_HOURS * 60 * 60 * 1e3,
    v: 1
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac2("sha256", getTokenSecret()).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}
function verifyAuthToken(token) {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;
  const expectedSignature = createHmac2("sha256", getTokenSecret()).update(encodedPayload).digest("base64url");
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    if (typeof parsed.userId !== "number" || typeof parsed.exp !== "number") return null;
    if (parsed.exp <= Date.now()) return null;
    return { userId: parsed.userId };
  } catch {
    return null;
  }
}
function buildAuthResponse(user) {
  const { password, ...safeUser } = user;
  const authToken = createAuthToken(user.id);
  return { ...safeUser, authToken };
}
function setupAuth(app) {
  const sessionSecret = getTokenSecret();
  const isProduction = process.env.NODE_ENV === "production";
  app.set("trust proxy", 1);
  const sessionOptions = {
    name: "clh_session",
    keys: [sessionSecret],
    maxAge: 24 * 60 * 60 * 1e3,
    // 24 hours
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    // "none" required for iframe cross-origin cookies
    httpOnly: true
  };
  if (isProduction) {
    sessionOptions.partitioned = true;
  }
  app.use(cookieSession(sessionOptions));
  const ensurePassportSessionCompat = (req) => {
    if (!req.session) return;
    if (typeof req.session.regenerate !== "function") {
      Object.defineProperty(req.session, "regenerate", {
        value: (cb) => cb(),
        enumerable: false,
        configurable: true
      });
    }
    if (typeof req.session.save !== "function") {
      Object.defineProperty(req.session, "save", {
        value: (cb) => cb(),
        enumerable: false,
        configurable: true
      });
    }
  };
  app.use((req, _res, next) => {
    if (req.path === "/api/login" || req.path === "/api/register" || req.path === "/api/logout" || req.path === "/api/admin/auth/magic-link/verify") {
      ensurePassportSessionCompat(req);
    }
    next();
  });
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(async (req, _res, next) => {
    if (req.user) return next();
    const authHeader = req.headers?.authorization;
    if (typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
      return next();
    }
    const token = authHeader.slice("Bearer ".length).trim();
    const payload = verifyAuthToken(token);
    if (!payload) return next();
    try {
      const user = await storage.getUser(payload.userId);
      if (user) {
        req.user = user;
      }
    } catch (error) {
      console.error("Bearer auth user lookup failed:", error);
    }
    return next();
  });
  passport.use(
    new LocalStrategy(
      { usernameField: "username", passwordField: "password", passReqToCallback: true },
      async (req, username, password, done) => {
        const normalizedUsername = normalizeUsername(username);
        const ip = getClientIp(req);
        const userAgent = getUserAgent(req);
        try {
          const candidateUsers = await storage.getUsersByCanonicalUsername(normalizedUsername);
          const user = candidateUsers[0];
          if (!user) {
            await logAuthEvent({
              usernameAttempt: normalizedUsername,
              eventType: "LOGIN_FAIL",
              ip,
              userAgent,
              metadata: { reason: "USER_NOT_FOUND" }
            });
            return done(null, false, { message: "Invalid credentials" });
          }
          const nowMs = Date.now();
          let matchedUser = null;
          let matchedLockedUser = null;
          for (const candidate of candidateUsers) {
            const matches = await comparePasswords(password, candidate.password);
            if (!matches) continue;
            const isCandidateLocked = candidate.lockedUntil instanceof Date && candidate.lockedUntil.getTime() > nowMs;
            if (isCandidateLocked) {
              matchedLockedUser = candidate;
              continue;
            }
            matchedUser = candidate;
            break;
          }
          if (!matchedUser && matchedLockedUser) {
            await logAuthEvent({
              userId: matchedLockedUser.id,
              usernameAttempt: normalizedUsername,
              eventType: "LOCKOUT",
              ip,
              userAgent,
              metadata: {
                lockedUntil: matchedLockedUser.lockedUntil?.toISOString() ?? null,
                candidateCount: candidateUsers.length
              }
            });
            return done(null, false, {
              message: "Your account is temporarily locked due to repeated failed logins. Try again in 15 minutes or use magic link sign-in."
            });
          }
          if (!matchedUser) {
            const targetUser = candidateUsers.find(
              (candidate) => !(candidate.lockedUntil instanceof Date) || candidate.lockedUntil.getTime() <= nowMs
            ) || user;
            const nextAttempts = (targetUser.failedLoginAttempts ?? 0) + 1;
            const shouldLock = nextAttempts >= MAX_FAILED_ATTEMPTS;
            const lockedUntil = shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1e3) : null;
            await db.update(users).set({
              failedLoginAttempts: nextAttempts,
              lockedUntil
            }).where(eq3(users.id, targetUser.id));
            await logAuthEvent({
              userId: targetUser.id,
              usernameAttempt: normalizedUsername,
              eventType: shouldLock ? "LOCKOUT" : "LOGIN_FAIL",
              ip,
              userAgent,
              metadata: {
                reason: "PASSWORD_MISMATCH",
                failedAttempts: nextAttempts,
                lockedUntil: lockedUntil?.toISOString() ?? null,
                candidateCount: candidateUsers.length
              }
            });
            return done(null, false, {
              message: shouldLock ? "Too many failed logins. Account locked for 15 minutes. You can use a magic sign-in link now." : "Password login failed. Try magic link or contact an admin for reset."
            });
          }
          await db.update(users).set({
            failedLoginAttempts: 0,
            lockedUntil: null,
            lastLoginAt: /* @__PURE__ */ new Date()
          }).where(eq3(users.id, matchedUser.id));
          await logAuthEvent({
            userId: matchedUser.id,
            usernameAttempt: normalizedUsername,
            eventType: "LOGIN_SUCCESS",
            ip,
            userAgent,
            metadata: {
              candidateCount: candidateUsers.length,
              matchedUserId: matchedUser.id
            }
          });
          return done(null, matchedUser);
        } catch (error) {
          console.error("Authentication error:", error);
          return done(error);
        }
      }
    )
  );
  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });
  app.post("/api/register", async (req, res, next) => {
    try {
      const normalizedUsername = typeof req.body?.username === "string" ? req.body.username.trim().toLowerCase() : req.body?.username;
      req.body.username = normalizedUsername;
      if (req.body.isAdmin && (!req.user || !req.user.isAdmin)) {
        return res.status(403).json({ message: "Only admins can create admin accounts" });
      }
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      const user = await storage.createUser({
        ...req.body,
        password: await hashPassword(req.body.password)
      });
      ensurePassportSessionCompat(req);
      req.login(user, (err) => {
        if (err) return next(err);
        res.set("Cache-Control", "private, no-store");
        res.status(201).json(buildAuthResponse(user));
      });
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/login", (req, res, next) => {
    if (typeof req.body?.username === "string") {
      req.body.username = normalizeUsername(req.body.username);
    }
    passport.authenticate("local", (err, user, info) => {
      if (err) return next(err);
      if (!user) {
        res.set("Cache-Control", "private, no-store");
        return res.status(401).json({
          message: info?.message || "Password login failed. Try magic link or contact an admin for reset."
        });
      }
      ensurePassportSessionCompat(req);
      req.login(user, (err2) => {
        if (err2) return next(err2);
        res.set("Cache-Control", "private, no-store");
        res.json(buildAuthResponse(user));
      });
    })(req, res, next);
  });
  app.post("/api/admin/auth/magic-link/request", async (req, res) => {
    const parsed = magicLinkRequestSchema.safeParse(req.body);
    const ip = getClientIp(req);
    const userAgent = getUserAgent(req);
    const genericResponse = { message: GENERIC_MAGIC_LINK_RESPONSE };
    if (!parsed.success) {
      res.set("Cache-Control", "private, no-store");
      return res.status(200).json(genericResponse);
    }
    const normalizedUsername = normalizeUsername(parsed.data.username);
    try {
      const user = await storage.getUserByUsername(normalizedUsername);
      if (!user || !user.isAdmin) {
        await logAuthEvent({
          usernameAttempt: normalizedUsername,
          eventType: "MAGIC_LINK_SENT",
          ip,
          userAgent,
          metadata: { delivered: false, reason: "USER_NOT_FOUND_OR_NOT_ADMIN" }
        });
        res.set("Cache-Control", "private, no-store");
        return res.status(200).json(genericResponse);
      }
      const issuedAt = /* @__PURE__ */ new Date();
      const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MINUTES * 60 * 1e3);
      const rawToken = randomBytes2(32).toString("base64url");
      const tokenHash = hashMagicToken(rawToken);
      await db.transaction(async (tx) => {
        await tx.update(adminMagicLoginTokens).set({ usedAt: issuedAt }).where(
          and2(
            eq3(adminMagicLoginTokens.userId, user.id),
            isNull(adminMagicLoginTokens.usedAt),
            gt(adminMagicLoginTokens.expiresAt, issuedAt)
          )
        );
        await tx.insert(adminMagicLoginTokens).values({
          userId: user.id,
          tokenHash,
          expiresAt,
          createdIp: ip,
          createdUserAgent: userAgent
        });
      });
      const signInUrl = `${getHostUrl()}/auth?magic=${encodeURIComponent(rawToken)}`;
      const delivered = await sendEmail({
        to: user.username,
        from: AUTH_EMAIL_FROM,
        subject: "Your VFW Post 7570 admin sign-in link",
        ignoreEmailDeliveryPause: true,
        text: `Use this secure one-time sign-in link:

${signInUrl}

This link expires in ${MAGIC_LINK_TTL_MINUTES} minutes and can only be used once.`,
        html: `
          <p>Use this secure one-time sign-in link:</p>
          <p><a href="${signInUrl}">Sign in to Admin Dashboard</a></p>
          <p>This link expires in ${MAGIC_LINK_TTL_MINUTES} minutes and can only be used once.</p>
        `
      });
      await logAuthEvent({
        userId: user.id,
        usernameAttempt: normalizedUsername,
        eventType: "MAGIC_LINK_SENT",
        ip,
        userAgent,
        metadata: {
          delivered,
          expiresAt: expiresAt.toISOString()
        }
      });
    } catch (error) {
      console.error("Error creating magic link:", error);
      await logAuthEvent({
        usernameAttempt: normalizedUsername,
        eventType: "MAGIC_LINK_SENT",
        ip,
        userAgent,
        metadata: { delivered: false, reason: "SERVER_ERROR" }
      });
    }
    res.set("Cache-Control", "private, no-store");
    return res.status(200).json(genericResponse);
  });
  app.post("/api/admin/auth/magic-link/verify", async (req, res, next) => {
    const parsed = magicLinkVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      res.set("Cache-Control", "private, no-store");
      return res.status(400).json({
        message: "This sign-in link is invalid or expired. Please request a new link."
      });
    }
    const ip = getClientIp(req);
    const userAgent = getUserAgent(req);
    const tokenHash = hashMagicToken(parsed.data.token);
    const now = /* @__PURE__ */ new Date();
    try {
      const tokenRows = await db.select().from(adminMagicLoginTokens).where(
        and2(
          eq3(adminMagicLoginTokens.tokenHash, tokenHash),
          isNull(adminMagicLoginTokens.usedAt),
          gt(adminMagicLoginTokens.expiresAt, now)
        )
      ).orderBy(desc2(adminMagicLoginTokens.createdAt)).limit(1);
      const tokenRow = tokenRows[0];
      if (!tokenRow) {
        await logAuthEvent({
          eventType: "LOGIN_FAIL",
          ip,
          userAgent,
          metadata: { reason: "MAGIC_LINK_INVALID_OR_EXPIRED" }
        });
        res.set("Cache-Control", "private, no-store");
        return res.status(400).json({
          message: "This sign-in link is invalid or expired. Please request a new link."
        });
      }
      const consumed = await db.update(adminMagicLoginTokens).set({ usedAt: now }).where(
        and2(eq3(adminMagicLoginTokens.id, tokenRow.id), isNull(adminMagicLoginTokens.usedAt))
      ).returning({ id: adminMagicLoginTokens.id });
      if (consumed.length === 0) {
        res.set("Cache-Control", "private, no-store");
        return res.status(400).json({
          message: "This sign-in link has already been used. Please request a new link."
        });
      }
      const user = await storage.getUser(tokenRow.userId);
      if (!user || !user.isAdmin) {
        await logAuthEvent({
          userId: tokenRow.userId,
          eventType: "LOGIN_FAIL",
          ip,
          userAgent,
          metadata: { reason: "MAGIC_LINK_USER_NOT_FOUND_OR_NOT_ADMIN" }
        });
        res.set("Cache-Control", "private, no-store");
        return res.status(400).json({
          message: "This sign-in link is invalid or expired. Please request a new link."
        });
      }
      await db.update(users).set({
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: now
      }).where(eq3(users.id, user.id));
      await logAuthEvent({
        userId: user.id,
        usernameAttempt: normalizeUsername(user.username),
        eventType: "MAGIC_LINK_USED",
        ip,
        userAgent,
        metadata: { tokenId: tokenRow.id }
      });
      ensurePassportSessionCompat(req);
      req.login(user, (err) => {
        if (err) return next(err);
        res.set("Cache-Control", "private, no-store");
        return res.json(buildAuthResponse(user));
      });
    } catch (error) {
      console.error("Error verifying magic link:", error);
      res.set("Cache-Control", "private, no-store");
      return res.status(500).json({
        message: "Unable to sign in with link right now. Please try again."
      });
    }
  });
  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.set("Cache-Control", "private, no-store");
      res.status(200).json({ message: "Logged out successfully" });
    });
  });
  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      res.set("Cache-Control", "private, no-store");
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = req.user;
    const { password, ...safeUser } = user;
    res.set("Cache-Control", "private, no-store");
    res.json(safeUser);
  });
}
var scryptAsync2, MAX_FAILED_ATTEMPTS, LOCKOUT_MINUTES, MAGIC_LINK_TTL_MINUTES, AUTH_TOKEN_TTL_HOURS, AUTH_EMAIL_FROM, GENERIC_MAGIC_LINK_RESPONSE, magicLinkRequestSchema, magicLinkVerifySchema;
var init_auth = __esm({
  "server/auth.ts"() {
    "use strict";
    init_storage();
    init_schema();
    init_db();
    init_email();
    scryptAsync2 = promisify2(scrypt2);
    MAX_FAILED_ATTEMPTS = 5;
    LOCKOUT_MINUTES = 15;
    MAGIC_LINK_TTL_MINUTES = 15;
    AUTH_TOKEN_TTL_HOURS = 24;
    AUTH_EMAIL_FROM = process.env.DEFAULT_FROM_EMAIL?.trim() || "communications@vfwharrisonoh.org";
    GENERIC_MAGIC_LINK_RESPONSE = "If an admin account exists for that email, a sign-in link has been sent.";
    magicLinkRequestSchema = z.object({
      username: z.string().trim().email().max(320)
    });
    magicLinkVerifySchema = z.object({
      token: z.string().trim().min(20).max(512)
    });
  }
});

// server/contact.ts
var contact_exports = {};
__export(contact_exports, {
  sendContactMessage: () => sendContactMessage
});
async function sendContactMessage(data) {
  try {
    const { name, email, subject, message } = data;
    const contactEmail = process.env.CONTACT_EMAIL?.trim() || "communications@vfwharrisonoh.org";
    const fromEmail = process.env.DEFAULT_FROM_EMAIL?.trim() || contactEmail;
    const success = await sendEmail({
      to: contactEmail,
      from: fromEmail,
      replyTo: email,
      subject: `Contact Form: ${subject}`,
      text: `
Name: ${name}
Email: ${email}

Message:
${message}
      `,
      html: `
<h2>New Contact Form Submission</h2>
<p><strong>From:</strong> ${name} (${email})</p>
<p><strong>Subject:</strong> ${subject}</p>
<h3>Message:</h3>
<p>${message.replace(/\n/g, "<br>")}</p>
      `
    });
    if (success) {
      console.log(`Sent contact form email from ${email}`);
      return true;
    }
    console.error("MailerSend contact form email error: sendEmail returned false");
    return false;
  } catch (error) {
    console.error("MailerSend contact form email error:", error);
    return false;
  }
}
var init_contact = __esm({
  "server/contact.ts"() {
    "use strict";
    init_email();
  }
});

// server/api-handler.ts
import "dotenv/config";

// server/app.ts
import express2 from "express";
import { createServer } from "http";

// server/routes.ts
init_storage();
init_auth();
import express from "express";

// server/assistant.ts
import Anthropic from "@anthropic-ai/sdk";
var NAV_TARGETS = [
  "manage",
  "create",
  "drafts",
  "event-signups",
  "calendar",
  "overview"
];
var MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";
var client = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }
  if (!client) {
    client = new Anthropic();
  }
  return client;
}
var ROUTE_TOOL = {
  name: "route_request",
  description: "Decide how to handle the admin's request. Use 'navigate' to open a screen, 'search' to show a filtered list of needs, or 'answer' to reply with a short text answer.",
  input_schema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["search", "navigate", "answer"],
        description: "search = show a filtered needs list; navigate = open a screen; answer = reply in words."
      },
      search: {
        type: "string",
        description: "When action is 'search', concise keywords to filter published needs by title, description, or category."
      },
      target: {
        type: "string",
        enum: [...NAV_TARGETS],
        description: "When action is 'navigate': manage=needs list, create=post a new need, drafts=draft needs, event-signups=who signed up, calendar=events calendar, overview=reports."
      },
      answer: {
        type: "string",
        description: "When action is 'answer', a short (1-2 sentence) reply."
      }
    },
    required: ["action"]
  }
};
function buildSystemPrompt(context) {
  const categories2 = context.categories?.length ? ` Available need categories: ${context.categories.join(", ")}.` : "";
  return "You are the built-in assistant for the VFW Post 7570 serving-network admin dashboard. The admins are often non-technical volunteers; interpret a plain-English request and route it. Screens you can open (navigate): manage (published needs list), create (post a new need), drafts, event-signups (who volunteered), calendar (events), overview (reports & impact). If they want to find or filter needs, use 'search' with concise keywords. If they want to go somewhere or start a task (e.g. post a need), use 'navigate'. If they ask a general how-to question, use 'answer' with a short reply. Do NOT invent specific numbers, names, or data you were not given. If they ask for data you don't have, navigate or search to where they can see it instead of guessing." + categories2;
}
async function interpretAssistantQuery(query, context = {}) {
  const anthropic = getClient();
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: buildSystemPrompt(context),
    tools: [ROUTE_TOOL],
    tool_choice: { type: "tool", name: "route_request" },
    messages: [{ role: "user", content: query }]
  });
  const toolUse = response.content.find(
    (block) => block.type === "tool_use"
  );
  const input = toolUse?.input ?? {};
  if (input.action === "navigate" && input.target && NAV_TARGETS.includes(input.target)) {
    return { kind: "navigate", target: input.target };
  }
  if (input.action === "answer" && input.answer?.trim()) {
    return { kind: "answer", message: input.answer.trim() };
  }
  return { kind: "search", query: input.search?.trim() || query };
}

// server/routes.ts
init_schema();
init_email();
import { fromZodError } from "zod-validation-error";
import { z as z3 } from "zod";
import * as fs from "fs";
import * as path from "path";
import { createHmac as createHmac3 } from "crypto";

// server/mailerlite.ts
import fetch3 from "node-fetch";
var MAILERLITE_GROUP_ID = process.env.MAILERLITE_SUPPORTERS_GROUP_ID?.trim() || "";
function getHeaders(apiKey) {
  return {
    "X-MailerLite-ApiKey": apiKey,
    "Content-Type": "application/json"
  };
}
async function findGroupIdByName(apiKey, groupName) {
  try {
    const response = await fetch3("https://api.mailerlite.com/api/v2/groups?limit=100", {
      method: "GET",
      headers: getHeaders(apiKey)
    });
    if (!response.ok) {
      console.warn("Unable to list MailerLite groups:", response.status, await response.text());
      return null;
    }
    const payload = await response.json();
    const groups = Array.isArray(payload) ? payload : payload?.data && Array.isArray(payload.data) ? payload.data : [];
    const target = groups.find(
      (group) => group?.name?.trim().toLowerCase() === groupName.trim().toLowerCase()
    );
    if (!target) {
      return null;
    }
    return String(target.id);
  } catch (error) {
    console.warn("Error resolving MailerLite group by name:", error);
    return null;
  }
}
async function addSubscriber(email, firstName, lastName, options = {}) {
  const apiKey = process.env.MAILERLITE_API_KEY;
  if (!apiKey) {
    console.error("MAILERLITE_API_KEY environment variable is not set");
    return false;
  }
  try {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedPhone = options.phone?.trim();
    const payload = {
      email: trimmedEmail,
      name: trimmedFirstName,
      fields: {
        name: trimmedFirstName,
        last_name: trimmedLastName,
        ...trimmedPhone ? { phone: trimmedPhone } : {}
      }
    };
    const upsertResponse = await fetch3("https://api.mailerlite.com/api/v2/subscribers", {
      method: "POST",
      headers: getHeaders(apiKey),
      body: JSON.stringify({
        ...payload,
        resubscribe: true
      })
    });
    if (!upsertResponse.ok) {
      console.error("Failed to upsert subscriber profile:", await upsertResponse.text());
      return false;
    }
    let targetGroupId = options.groupId?.trim();
    if (!targetGroupId && options.groupName) {
      const resolvedGroupId = await findGroupIdByName(apiKey, options.groupName);
      if (resolvedGroupId) {
        targetGroupId = resolvedGroupId;
      }
    }
    if (!targetGroupId && options.requireGroupMatch) {
      console.error(`Required MailerLite group not found: ${options.groupName || "(unspecified)"}`);
      return false;
    }
    if (!targetGroupId && MAILERLITE_GROUP_ID) {
      targetGroupId = MAILERLITE_GROUP_ID;
    }
    if (!targetGroupId) {
      console.error("MAILERLITE_SUPPORTERS_GROUP_ID is not set");
      return false;
    }
    const groupResponse = await fetch3(`https://api.mailerlite.com/api/v2/groups/${targetGroupId}/subscribers`, {
      method: "POST",
      headers: getHeaders(apiKey),
      body: JSON.stringify({
        ...payload,
        resubscribe: true
        // Re-subscribe if they previously unsubscribed
      })
    });
    if (!groupResponse.ok) {
      const raw = await groupResponse.text();
      const normalizedError = raw.toLowerCase();
      const alreadyMember = groupResponse.status === 409 || /already subscribed|already a member|already exists|already in/i.test(normalizedError);
      if (alreadyMember) {
        return true;
      }
      console.error(`Failed to add subscriber to group ${targetGroupId}:`, raw);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Error subscribing email to MailerLite:", error);
    return false;
  }
}

// server/routes.ts
import { eq as eq5, asc as asc3, inArray as inArray2, and as and4, ne } from "drizzle-orm";

// server/auth-compat.ts
init_db();
import { sql as sql3 } from "drizzle-orm";
var authCompatibilityEnsured = false;
async function ensureAuthCompatibility() {
  if (authCompatibilityEnsured) return;
  const runtimeCompatEnabled = (process.env.RUNTIME_SCHEMA_COMPAT || "").trim().toLowerCase() === "true";
  if (!runtimeCompatEnabled) {
    authCompatibilityEnsured = true;
    return;
  }
  await db.execute(sql3.raw(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP,
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS password_updated_at TIMESTAMP;
  `));
  await db.execute(sql3.raw(`
    ALTER TABLE pledges
    ADD COLUMN IF NOT EXISTS organization TEXT;
  `));
  await db.execute(sql3.raw(`
    ALTER TABLE needs
    ADD COLUMN IF NOT EXISTS event_date DATE,
    ADD COLUMN IF NOT EXISTS end_date DATE,
    ADD COLUMN IF NOT EXISTS event_start_time TEXT,
    ADD COLUMN IF NOT EXISTS event_end_time TEXT,
    ADD COLUMN IF NOT EXISTS category_selections TEXT DEFAULT '[]';
  `));
  await db.execute(sql3.raw(`
    UPDATE needs
    SET category_selections = CASE
      WHEN category IS NULL OR trim(category) = '' THEN '[]'
      ELSE to_json(ARRAY[trim(category)])::text
    END
    WHERE category_selections IS NULL OR trim(category_selections) = '';
  `));
  await db.execute(sql3.raw(`
    ALTER TABLE needs
    ALTER COLUMN category_selections SET DEFAULT '[]',
    ALTER COLUMN category_selections SET NOT NULL;
  `));
  await db.execute(sql3.raw(`
    UPDATE users
    SET failed_login_attempts = 0
    WHERE failed_login_attempts IS NULL;
  `));
  await db.execute(sql3.raw(`
    ALTER TABLE users
    ALTER COLUMN failed_login_attempts SET DEFAULT 0,
    ALTER COLUMN failed_login_attempts SET NOT NULL;
  `));
  await db.execute(sql3.raw(`
    CREATE TABLE IF NOT EXISTS admin_magic_login_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      created_ip TEXT,
      created_user_agent TEXT
    );
  `));
  await db.execute(sql3.raw(`
    CREATE INDEX IF NOT EXISTS idx_admin_magic_login_tokens_user_id
    ON admin_magic_login_tokens(user_id);
  `));
  await db.execute(sql3.raw(`
    CREATE INDEX IF NOT EXISTS idx_admin_magic_login_tokens_token_hash
    ON admin_magic_login_tokens(token_hash);
  `));
  await db.execute(sql3.raw(`
    CREATE TABLE IF NOT EXISTS auth_events (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      username_attempt TEXT,
      event_type TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      metadata TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `));
  await db.execute(sql3.raw(`
    CREATE INDEX IF NOT EXISTS idx_auth_events_created_at
    ON auth_events(created_at DESC);
  `));
  await db.execute(sql3.raw(`
    CREATE TABLE IF NOT EXISTS admin_notification_preferences (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      receive_all_notifications BOOLEAN NOT NULL DEFAULT true,
      enabled_categories TEXT NOT NULL DEFAULT '[]',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `));
  await db.execute(sql3.raw(`
    CREATE INDEX IF NOT EXISTS idx_admin_notification_preferences_user_id
    ON admin_notification_preferences(user_id);
  `));
  await db.execute(sql3.raw(`
    CREATE TABLE IF NOT EXISTS event_roles (
      id SERIAL PRIMARY KEY,
      need_id INTEGER NOT NULL REFERENCES needs(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      slot_date DATE,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      capacity INTEGER,
      display_order INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `));
  await db.execute(sql3.raw(`
    ALTER TABLE event_roles
    ADD COLUMN IF NOT EXISTS name TEXT,
    ADD COLUMN IF NOT EXISTS slot_date DATE,
    ADD COLUMN IF NOT EXISTS start_time TEXT,
    ADD COLUMN IF NOT EXISTS end_time TEXT,
    ADD COLUMN IF NOT EXISTS capacity INTEGER,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();
  `));
  await db.execute(sql3.raw(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'event_roles' AND column_name = 'role_name'
      ) THEN
        EXECUTE 'UPDATE event_roles SET name = role_name WHERE name IS NULL AND role_name IS NOT NULL';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'event_roles' AND column_name = 'slots_needed'
      ) THEN
        EXECUTE 'UPDATE event_roles SET capacity = slots_needed WHERE capacity IS NULL AND slots_needed IS NOT NULL';
      END IF;
    END $$;
  `));
  await db.execute(sql3.raw(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'event_roles' AND column_name = 'role_name'
      ) THEN
        EXECUTE 'ALTER TABLE event_roles ALTER COLUMN role_name DROP NOT NULL';
      END IF;
    END $$;
  `));
  await db.execute(sql3.raw(`
    UPDATE event_roles
    SET
      name = COALESCE(name, 'General Volunteer'),
      start_time = COALESCE(start_time, '00:00'),
      end_time = COALESCE(end_time, '01:00'),
      updated_at = COALESCE(updated_at, NOW());
  `));
  await db.execute(sql3.raw(`
    UPDATE event_roles AS er
    SET slot_date = n.event_date
    FROM needs AS n
    WHERE er.need_id = n.id
      AND er.slot_date IS NULL
      AND n.event_date IS NOT NULL;
  `));
  await db.execute(sql3.raw(`
    ALTER TABLE event_roles
    ALTER COLUMN name SET NOT NULL,
    ALTER COLUMN start_time SET NOT NULL,
    ALTER COLUMN end_time SET NOT NULL,
    ALTER COLUMN is_active SET DEFAULT true,
    ALTER COLUMN updated_at SET DEFAULT NOW();
  `));
  await db.execute(sql3.raw(`
    CREATE INDEX IF NOT EXISTS idx_event_roles_need_id
    ON event_roles(need_id);
  `));
  await db.execute(sql3.raw(`
    CREATE TABLE IF NOT EXISTS event_role_signups (
      id SERIAL PRIMARY KEY,
      pledge_id INTEGER NOT NULL REFERENCES pledges(id) ON DELETE CASCADE,
      need_id INTEGER NOT NULL REFERENCES needs(id) ON DELETE CASCADE,
      event_role_id INTEGER NOT NULL REFERENCES event_roles(id) ON DELETE CASCADE,
      signer_email TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `));
  await db.execute(sql3.raw(`
    ALTER TABLE event_role_signups
    ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;
  `));
  await db.execute(sql3.raw(`
    UPDATE event_role_signups
    SET quantity = 1
    WHERE quantity IS NULL OR quantity <= 0;
  `));
  await db.execute(sql3.raw(`
    CREATE INDEX IF NOT EXISTS idx_event_role_signups_pledge_id
    ON event_role_signups(pledge_id);
  `));
  await db.execute(sql3.raw(`
    CREATE INDEX IF NOT EXISTS idx_event_role_signups_need_id
    ON event_role_signups(need_id);
  `));
  await db.execute(sql3.raw(`
    CREATE INDEX IF NOT EXISTS idx_event_role_signups_role_id
    ON event_role_signups(event_role_id);
  `));
  await db.execute(sql3.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_event_role_signups_role_email_unique
    ON event_role_signups(event_role_id, signer_email);
  `));
  await db.execute(sql3.raw(`
    CREATE TABLE IF NOT EXISTS event_signup_reminders (
      id SERIAL PRIMARY KEY,
      need_id INTEGER NOT NULL REFERENCES needs(id) ON DELETE CASCADE,
      signer_email TEXT NOT NULL,
      first_slot_at TIMESTAMP NOT NULL,
      reminder_type TEXT NOT NULL DEFAULT 'FIRST_SLOT_24H',
      sent_at TIMESTAMP NOT NULL DEFAULT NOW(),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `));
  await db.execute(sql3.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS event_signup_reminders_unique_idx
    ON event_signup_reminders(need_id, signer_email, first_slot_at, reminder_type);
  `));
  await db.execute(sql3.raw(`
    CREATE INDEX IF NOT EXISTS idx_event_signup_reminders_first_slot_at
    ON event_signup_reminders(first_slot_at);
  `));
  await db.execute(sql3.raw(`
    CREATE TABLE IF NOT EXISTS calendar_sync_queue (
      need_id INTEGER PRIMARY KEY,
      action TEXT NOT NULL CHECK (action IN ('UPSERT', 'DELETE')),
      payload TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TIMESTAMP NOT NULL DEFAULT NOW(),
      last_attempt_at TIMESTAMP,
      last_error TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `));
  await db.execute(sql3.raw(`
    CREATE INDEX IF NOT EXISTS idx_calendar_sync_queue_next_attempt_at
    ON calendar_sync_queue(next_attempt_at);
  `));
  if (process.env.RUNTIME_AUTH_HARDENING === "true") {
    try {
      await db.execute(sql3.raw(`
        ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS public."session" ENABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS public.pledges ENABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS public.needs ENABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS public.admin_magic_login_tokens ENABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS public.auth_events ENABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS public.event_roles ENABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS public.event_role_signups ENABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS public.event_signup_reminders ENABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS public.calendar_sync_queue ENABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS public.categories ENABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS public.admin_notification_preferences ENABLE ROW LEVEL SECURITY;
      `));
      await db.execute(sql3.raw(`
        DO $$
        DECLARE
          role_name TEXT;
          table_name TEXT;
          target_tables TEXT[] := ARRAY[
            'users',
            'session',
            'pledges',
            'needs',
            'admin_magic_login_tokens',
            'auth_events',
            'event_roles',
            'event_role_signups',
            'event_signup_reminders',
            'calendar_sync_queue',
            'categories',
            'admin_notification_preferences'
          ];
        BEGIN
          FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated']
          LOOP
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
              FOREACH table_name IN ARRAY target_tables
              LOOP
                IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
                  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', table_name, role_name);
                END IF;
              END LOOP;
            END IF;
          END LOOP;
        END $$;
      `));
    } catch (error) {
      console.warn("Runtime auth hardening skipped due to DDL conflict:", error);
    }
  }
  authCompatibilityEnsured = true;
}

// server/routes.ts
init_email_delivery_settings();

// server/calendar-sync.ts
init_db();
init_schema();
import { createHash as createHash2, randomUUID } from "crypto";
import { fromZonedTime } from "date-fns-tz";
import { and as and3, asc as asc2, eq as eq4, lte } from "drizzle-orm";
var CALENDAR_SYNC_SOURCE = "servingnetwork";
var CALENDAR_SYNC_ORG_ID = "vfw";
var DEFAULT_TIMEZONE = "America/New_York";
var MAX_ERROR_LENGTH = 1200;
var TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
var DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
var SERVE_SATURDAY_COLOR = "#b91c1c";
var DEFAULT_EVENT_COLOR = "#2563eb";
var DEFAULT_EVENT_TEXT_COLOR = "#ffffff";
function isSyncEnabled() {
  const raw = (process.env.CALENDAR_SYNC_ENABLED || "").trim().toLowerCase();
  if (!raw) return true;
  return raw === "true" || raw === "1" || raw === "yes";
}
function truncateError(message) {
  if (message.length <= MAX_ERROR_LENGTH) return message;
  return `${message.slice(0, MAX_ERROR_LENGTH - 3)}...`;
}
function toSyncErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown sync error";
}
function toSignupUrl(needId) {
  const publicUrl = process.env.PUBLIC_URL || "https://vfwharrisonoh.org/volunteer/";
  const separator = publicUrl.includes("?") ? "&" : "?";
  return `${publicUrl}${separator}need=${needId}`;
}
function normalizeDate(rawDate) {
  const trimmed = rawDate?.trim();
  if (!trimmed) return null;
  return DATE_PATTERN.test(trimmed) ? trimmed : null;
}
function normalizeTime(rawTime) {
  const trimmed = rawTime?.trim();
  if (!trimmed) return null;
  return TIME_PATTERN.test(trimmed) ? trimmed : null;
}
function buildDateTime(date2, time) {
  if (!date2 || !time) return null;
  return `${date2}T${time}:00`;
}
function isEligibleEventNeed(need) {
  return need.needType === "EVENT" /* EVENT */ && need.status !== "DRAFT" /* DRAFT */ && need.status !== "UNFULFILLED" /* UNFULFILLED */;
}
function computeIdempotencyKey(action, needId, payload) {
  const hash = createHash2("sha256").update(payload).digest("hex");
  return `servingnetwork:need:${needId}:${action}:${hash}`;
}
function buildDeletePayload(needId) {
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
      status: "DRAFT" /* DRAFT */,
      timezone: DEFAULT_TIMEZONE,
      signupUrl: toSignupUrl(needId),
      eventRoles: []
    }
  };
}
function appendSignupLink(descriptionHtml, needId) {
  const base = descriptionHtml || "";
  const separator = base.trim().length > 0 ? "\n\n" : "";
  return `${base}${separator}<p><a href="${toSignupUrl(needId)}">Click Here To Sign Up</a></p>`;
}
function normalizeCategoryKey(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}
function isServeSaturdayCategory(category) {
  return normalizeCategoryKey(category) === "servesaturday";
}
function toUtcIsoFromLocal(localDateTime, timezone) {
  return fromZonedTime(localDateTime, timezone).toISOString();
}
function addOneDay(date2) {
  const [year, month, day] = date2.split("-").map((value) => Number(value));
  const base = new Date(Date.UTC(year, month - 1, day));
  base.setUTCDate(base.getUTCDate() + 1);
  const y = base.getUTCFullYear();
  const m = String(base.getUTCMonth() + 1).padStart(2, "0");
  const d = String(base.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function resolveSeriesWindow(need) {
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
      timezone
    };
  }
  if (startTime && endTime) {
    const startsAt = toUtcIsoFromLocal(`${eventStartDate}T${startTime}:00`, timezone);
    const endsAt = toUtcIsoFromLocal(`${eventEndDate || eventStartDate}T${endTime}:00`, timezone);
    if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      throw new Error(
        "Calendar sync requires event end datetime to be after start datetime."
      );
    }
    return {
      allDay: false,
      startsAt,
      endsAt,
      timezone
    };
  }
  if (startTime) {
    const start2 = new Date(toUtcIsoFromLocal(`${eventStartDate}T${startTime}:00`, timezone));
    const end2 = new Date(start2.getTime() + 60 * 60 * 1e3);
    return {
      allDay: false,
      startsAt: start2.toISOString(),
      endsAt: end2.toISOString(),
      timezone
    };
  }
  const end = new Date(
    toUtcIsoFromLocal(`${eventEndDate || eventStartDate}T${endTime}:00`, timezone)
  );
  const start = new Date(end.getTime() - 60 * 60 * 1e3);
  return {
    allDay: false,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    timezone
  };
}
function parseQueuePayload(rawPayload) {
  const parsed = JSON.parse(rawPayload);
  if (!parsed || parsed.action !== "UPSERT" && parsed.action !== "DELETE" || !parsed.need || typeof parsed.need.id !== "number") {
    throw new Error("Invalid calendar sync queue payload.");
  }
  return parsed;
}
function toNullableIsoString(value) {
  if (value === null || value === void 0) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}
async function findExistingSeries(orgId, needId) {
  const integrationKey = `need:${needId}`;
  const rows = await queryClient`
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
    textColor: typeof row.text_color === "string" ? row.text_color : null
  };
}
async function applyDeleteToCalendar(orgId, needId) {
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
async function applyUpsertToCalendar(payload) {
  const orgId = payload.orgId || CALENDAR_SYNC_ORG_ID;
  const need = payload.need;
  const existing = await findExistingSeries(orgId, need.id);
  const category = (need.category || "").trim();
  const seriesWindow = resolveSeriesWindow(need);
  const integrationKey = `need:${need.id}`;
  const resolvedEventColor = isServeSaturdayCategory(category) ? SERVE_SATURDAY_COLOR : existing?.eventColor || DEFAULT_EVENT_COLOR;
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
async function buildUpsertPayload(need) {
  const eventStartDate = normalizeDate(need.eventDate);
  const eventEndDate = normalizeDate(need.endDate) || eventStartDate;
  const eventStartTime = normalizeTime(need.eventStartTime);
  const eventEndTime = normalizeTime(need.eventEndTime);
  const roleRows = await db.select({
    id: eventRoles.id,
    name: eventRoles.name,
    slotDate: eventRoles.slotDate,
    startTime: eventRoles.startTime,
    endTime: eventRoles.endTime,
    capacity: eventRoles.capacity,
    displayOrder: eventRoles.displayOrder,
    isActive: eventRoles.isActive
  }).from(eventRoles).where(and3(eq4(eventRoles.needId, need.id), eq4(eventRoles.isActive, true))).orderBy(asc2(eventRoles.displayOrder), asc2(eventRoles.id));
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
      eventRoles: roleRows
    }
  };
}
async function upsertQueueRow(params) {
  const payloadString = JSON.stringify(params.payload);
  const idempotencyKey = computeIdempotencyKey(params.action, params.needId, payloadString);
  const now = /* @__PURE__ */ new Date();
  await db.insert(calendarSyncQueue).values({
    needId: params.needId,
    action: params.action,
    payload: payloadString,
    idempotencyKey,
    attempts: 0,
    nextAttemptAt: now,
    lastAttemptAt: null,
    lastError: null,
    createdAt: now,
    updatedAt: now
  }).onConflictDoUpdate({
    target: calendarSyncQueue.needId,
    set: {
      action: params.action,
      payload: payloadString,
      idempotencyKey,
      attempts: 0,
      nextAttemptAt: now,
      lastAttemptAt: null,
      lastError: null,
      updatedAt: now
    }
  });
}
async function markFailedAttempt(row, errorMessage) {
  const now = /* @__PURE__ */ new Date();
  const attempts = (row.attempts || 0) + 1;
  const delaySeconds = Math.min(2 ** attempts * 60, 6 * 60 * 60);
  const nextAttemptAt = new Date(now.getTime() + delaySeconds * 1e3);
  await db.update(calendarSyncQueue).set({
    attempts,
    nextAttemptAt,
    lastAttemptAt: now,
    lastError: truncateError(errorMessage),
    updatedAt: now
  }).where(eq4(calendarSyncQueue.needId, row.needId));
}
async function dispatchQueueRow(row) {
  const payload = parseQueuePayload(row.payload);
  if (payload.action === "DELETE") {
    await applyDeleteToCalendar(payload.orgId || CALENDAR_SYNC_ORG_ID, payload.need.id);
  } else {
    await applyUpsertToCalendar(payload);
  }
  await db.delete(calendarSyncQueue).where(eq4(calendarSyncQueue.needId, row.needId));
}
async function processQueueRow(row) {
  try {
    await dispatchQueueRow(row);
    return "success";
  } catch (error) {
    const errorMessage = toSyncErrorMessage(error);
    await markFailedAttempt(row, errorMessage);
    return "failed";
  }
}
async function enqueueNeedCalendarSync(need) {
  if (!isSyncEnabled()) return;
  if (isEligibleEventNeed(need)) {
    const payload = await buildUpsertPayload(need);
    await upsertQueueRow({
      needId: need.id,
      action: "UPSERT",
      payload
    });
    return;
  }
  await enqueueNeedCalendarDelete(need.id);
}
async function enqueueNeedCalendarDelete(needId) {
  if (!isSyncEnabled()) return;
  await upsertQueueRow({
    needId,
    action: "DELETE",
    payload: buildDeletePayload(needId)
  });
}
async function processCalendarSyncQueue(limit = 25) {
  if (!isSyncEnabled()) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }
  const now = /* @__PURE__ */ new Date();
  const jobs = await db.select().from(calendarSyncQueue).where(lte(calendarSyncQueue.nextAttemptAt, now)).orderBy(asc2(calendarSyncQueue.nextAttemptAt)).limit(Math.max(1, limit));
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
    failed
  };
}
async function processCalendarSyncQueueForNeed(needId) {
  if (!isSyncEnabled()) return false;
  const [job] = await db.select().from(calendarSyncQueue).where(eq4(calendarSyncQueue.needId, needId)).limit(1);
  if (!job) return false;
  const result = await processQueueRow(job);
  return result === "success";
}
async function triggerImmediateCalendarSync(needId) {
  if (!isSyncEnabled()) return false;
  try {
    return await processCalendarSyncQueueForNeed(needId);
  } catch (error) {
    console.error("Immediate calendar sync failed:", error);
    return false;
  }
}

// server/calendar-transfer.ts
import postgres2 from "postgres";
var DEFAULT_SOURCE_BASE_URL = "https://clh-calendar.vercel.app";
var DEFAULT_SOURCE_ORG_ID = "clh";
var DEFAULT_TIMEOUT_MS = 2e4;
function getTimeoutMs(rawTimeout) {
  if (!rawTimeout || !Number.isFinite(rawTimeout)) {
    return DEFAULT_TIMEOUT_MS;
  }
  return Math.max(2e3, Math.floor(rawTimeout));
}
function truncateTrailingSlash(url) {
  return url.replace(/\/+$/, "");
}
async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store"
    });
  } finally {
    clearTimeout(timeout);
  }
}
async function fetchCalendarBundle(params) {
  const { baseUrl, timeoutMs } = params;
  const exportResponse = await fetchWithTimeout(
    `${baseUrl}/api/v1/calendar/export`,
    {
      method: "GET"
    },
    timeoutMs
  );
  if (!exportResponse.ok) {
    const details = (await exportResponse.text().catch(() => "")).trim();
    throw new Error(
      `Calendar export failed (${exportResponse.status})${details ? `: ${details.slice(0, 220)}` : ""}`
    );
  }
  const bundle = await exportResponse.json();
  if (!bundle || !Array.isArray(bundle.eventSeries) || !Array.isArray(bundle.events)) {
    throw new Error("Calendar export payload is invalid.");
  }
  return bundle;
}
async function ensureCalendarTables(sql4) {
  await sql4`create extension if not exists pgcrypto`;
  await sql4.unsafe(`
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
  await sql4.unsafe(`
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
  await sql4.unsafe(`
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
  await sql4.unsafe(`
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
  await sql4.unsafe(`
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
  await sql4.unsafe(`
    ALTER TABLE calendar_events
      ALTER COLUMN org_id SET DEFAULT 'clh',
      ALTER COLUMN status SET DEFAULT 'ACTIVE',
      ALTER COLUMN created_at SET DEFAULT NOW(),
      ALTER COLUMN updated_at SET DEFAULT NOW()
  `);
  await sql4.unsafe(`
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
  await sql4.unsafe(`
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
  await sql4.unsafe(`
    ALTER TABLE calendar_audit_log
      ALTER COLUMN org_id SET DEFAULT 'clh',
      ALTER COLUMN payload SET DEFAULT '{}'::jsonb,
      ALTER COLUMN created_at SET DEFAULT NOW()
  `);
  await sql4.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_calendar_event_series_org_starts
    ON calendar_event_series(org_id, starts_at)
  `);
  await sql4.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_calendar_event_series_recurrence
    ON calendar_event_series(org_id, recurrence_rule)
  `);
  await sql4.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_calendar_event_series_org_group_name
    ON calendar_event_series(org_id, group_name)
    WHERE group_name IS NOT NULL
  `);
  await sql4.unsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_event_series_integration_unique
    ON calendar_event_series(org_id, integration_source, integration_key)
    WHERE integration_source IS NOT NULL AND integration_key IS NOT NULL
  `);
  await sql4.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_calendar_events_org_occurrence
    ON calendar_events(org_id, occurrence_start)
  `);
  await sql4.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_calendar_audit_org_created
    ON calendar_audit_log(org_id, created_at DESC)
  `);
  await sql4.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_calendar_audit_idempotency
    ON calendar_audit_log(org_id, idempotency_key, http_method, request_path)
    WHERE idempotency_key IS NOT NULL
  `);
}
async function upsertSeries(sql4, rows) {
  for (const row of rows) {
    await sql4`
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
async function upsertEvents(sql4, rows) {
  for (const row of rows) {
    await sql4`
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
async function upsertAuditLog(sql4, rows) {
  for (const row of rows) {
    await sql4`
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
async function transferCalendarDataFromSource(options = {}) {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is required.");
  }
  const sourceBaseUrl = truncateTrailingSlash(
    options.sourceBaseUrl || process.env.CALENDAR_SOURCE_BASE_URL || DEFAULT_SOURCE_BASE_URL
  );
  const sourceOrgId = options.sourceOrgId || process.env.CALENDAR_SOURCE_ORG_ID || DEFAULT_SOURCE_ORG_ID;
  const timeoutMs = getTimeoutMs(
    options.timeoutMs ?? Number(process.env.CALENDAR_SOURCE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
  );
  const mode = options.mode || "merge";
  const bundle = await fetchCalendarBundle({
    baseUrl: sourceBaseUrl,
    timeoutMs
  });
  const filteredSeries = (bundle.eventSeries || []).filter((row) => row.org_id === sourceOrgId);
  const filteredEvents = (bundle.events || []).filter((row) => row.org_id === sourceOrgId);
  const filteredAudit = (bundle.auditLog || []).filter((row) => row.org_id === sourceOrgId);
  const targetSql = postgres2(process.env.DATABASE_URL, {
    ssl: "require",
    prepare: false,
    max: 1,
    connect_timeout: 12
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
    importedAuditLog: filteredAudit.length
  };
}
async function runFromCli() {
  const modeArg = process.argv.find((arg) => arg === "--replace");
  const mode = modeArg ? "replace" : "merge";
  const result = await transferCalendarDataFromSource({ mode });
  console.log(JSON.stringify({ success: true, ...result }, null, 2));
}
if (import.meta.url === `file://${process.argv[1]}`) {
  runFromCli().catch((error) => {
    console.error("Calendar transfer failed:", error);
    process.exit(1);
  });
}

// server/calendar-compat.ts
var DEFAULT_CALENDAR_BASE_URL = "https://clh-calendar.vercel.app";
var DEFAULT_TIMEOUT_MS2 = 2e4;
function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}
function parseTimeoutMs(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1e3) {
    return DEFAULT_TIMEOUT_MS2;
  }
  return Math.floor(parsed);
}
function getCalendarBaseUrl() {
  return trimTrailingSlash(
    process.env.CALENDAR_COMPAT_BASE_URL || process.env.CALENDAR_SOURCE_BASE_URL || DEFAULT_CALENDAR_BASE_URL
  );
}
function getCalendarTimeoutMs() {
  return parseTimeoutMs(process.env.CALENDAR_COMPAT_TIMEOUT_MS || process.env.CALENDAR_SOURCE_TIMEOUT_MS);
}
async function fetchWithTimeout2(url, init, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store"
    });
  } finally {
    clearTimeout(timeout);
  }
}
function shouldIncludeRequestBody(method) {
  return method !== "GET" && method !== "HEAD";
}
function buildForwardHeaders(req) {
  const headers = {
    accept: String(req.headers.accept || "application/json, text/plain, */*")
  };
  const passthroughHeaderNames = [
    "content-type",
    "idempotency-key",
    "if-none-match",
    "if-modified-since",
    "user-agent"
  ];
  for (const headerName of passthroughHeaderNames) {
    const value = req.headers[headerName];
    if (typeof value === "string" && value.trim().length > 0) {
      headers[headerName] = value;
    }
  }
  if (req.user) {
    headers["x-serving-network-subject-id"] = String(req.user.id ?? "");
    headers["x-serving-network-email"] = String(req.user.username ?? "");
    headers["x-serving-network-org-id"] = "clh";
    headers["x-serving-network-roles"] = req.user.isAdmin ? "admin" : "user";
  }
  return headers;
}
function buildProxyBody(req) {
  if (!shouldIncludeRequestBody(req.method)) return void 0;
  if (req.body === void 0 || req.body === null) return void 0;
  if (typeof req.body === "string") return req.body;
  return JSON.stringify(req.body);
}
async function sendProxiedResponse(res, upstreamResponse) {
  res.status(upstreamResponse.status);
  const forwardResponseHeaders = [
    "content-type",
    "cache-control",
    "etag",
    "last-modified",
    "location",
    "content-disposition",
    "vary"
  ];
  for (const headerName of forwardResponseHeaders) {
    const headerValue = upstreamResponse.headers.get(headerName);
    if (headerValue) {
      res.setHeader(headerName, headerValue);
    }
  }
  const body = Buffer.from(await upstreamResponse.arrayBuffer());
  res.send(body);
}
async function proxyCalendarRequest(req, res, options) {
  const baseUrl = getCalendarBaseUrl();
  const timeoutMs = getCalendarTimeoutMs();
  const upstreamPath = options?.upstreamPath || req.originalUrl;
  const targetUrl = new URL(upstreamPath, `${baseUrl}/`).toString();
  const performRequest = async () => {
    const headers = buildForwardHeaders(req);
    const body = buildProxyBody(req);
    if (body && !headers["content-type"]) {
      headers["content-type"] = "application/json";
    }
    return fetchWithTimeout2(
      targetUrl,
      {
        method: req.method,
        headers,
        body,
        redirect: "manual"
      },
      timeoutMs
    );
  };
  try {
    const upstreamResponse = await performRequest();
    await sendProxiedResponse(res, upstreamResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Calendar compatibility proxy request failed.";
    console.error("Calendar compatibility proxy failed:", message);
    res.status(502).json({
      success: false,
      error: "Calendar compatibility proxy failed",
      details: message
    });
  }
}

// server/calendar-admin.ts
import { randomUUID as randomUUID2 } from "crypto";
import { toZonedTime as toZonedTime2 } from "date-fns-tz";
import rrulePkg2 from "rrule";
import { z as z2 } from "zod";

// server/calendar-native.ts
init_db();
import { fromZonedTime as fromZonedTime2, toZonedTime } from "date-fns-tz";
import rrulePkg from "rrule";
var { RRule, rrulestr } = rrulePkg;
var DEFAULT_CALENDAR_ORG_ID = "vfw";
var DEFAULT_TIMEZONE2 = "America/New_York";
var jsDayToWeekdayCode = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
var rruleDayToCode = {
  0: "MO",
  1: "TU",
  2: "WE",
  3: "TH",
  4: "FR",
  5: "SA",
  6: "SU"
};
function toIsoString(value) {
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
function toNullableIsoString2(value) {
  if (value === null || value === void 0) return null;
  const iso = toIsoString(value);
  return iso || null;
}
function toBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "t" || normalized === "1") return true;
    if (normalized === "false" || normalized === "f" || normalized === "0") return false;
  }
  return fallback;
}
function normalizeSeriesRow(input) {
  return {
    id: String(input.id ?? ""),
    org_id: String(input.org_id ?? DEFAULT_CALENDAR_ORG_ID),
    title: String(input.title ?? ""),
    group_name: typeof input.group_name === "string" ? input.group_name : null,
    location: typeof input.location === "string" ? input.location : null,
    description_html: String(input.description_html ?? ""),
    event_color: typeof input.event_color === "string" && input.event_color.trim().length > 0 ? input.event_color : "#2563eb",
    text_color: typeof input.text_color === "string" && input.text_color.trim().length > 0 ? input.text_color : "#ffffff",
    all_day: toBoolean(input.all_day, false),
    starts_at: toIsoString(input.starts_at),
    ends_at: toIsoString(input.ends_at),
    timezone: typeof input.timezone === "string" && input.timezone.trim().length > 0 ? input.timezone : DEFAULT_TIMEZONE2,
    recurrence_rule: typeof input.recurrence_rule === "string" ? input.recurrence_rule : null,
    recurrence_until: toNullableIsoString2(input.recurrence_until),
    integration_source: typeof input.integration_source === "string" ? input.integration_source : null,
    integration_key: typeof input.integration_key === "string" ? input.integration_key : null,
    created_by: typeof input.created_by === "string" ? input.created_by : null,
    created_at: toIsoString(input.created_at),
    updated_at: toIsoString(input.updated_at),
    deleted_at: toNullableIsoString2(input.deleted_at)
  };
}
function normalizeEventRow(input) {
  return {
    id: String(input.id ?? ""),
    org_id: String(input.org_id ?? DEFAULT_CALENDAR_ORG_ID),
    series_id: typeof input.series_id === "string" ? input.series_id : null,
    occurrence_start: toIsoString(input.occurrence_start),
    occurrence_end: toIsoString(input.occurrence_end),
    title_override: typeof input.title_override === "string" ? input.title_override : null,
    location_override: typeof input.location_override === "string" ? input.location_override : null,
    description_html_override: typeof input.description_html_override === "string" ? input.description_html_override : null,
    all_day_override: typeof input.all_day_override === "boolean" ? input.all_day_override : null,
    status: typeof input.status === "string" && input.status.trim().length > 0 ? input.status : "ACTIVE",
    created_at: toIsoString(input.created_at),
    updated_at: toIsoString(input.updated_at)
  };
}
function normalizeWeekdayArray(byweekday) {
  if (!byweekday) return [];
  const weekdays = Array.isArray(byweekday) ? byweekday : [byweekday];
  return weekdays.map((entry) => {
    if (typeof entry === "number") {
      return rruleDayToCode[entry];
    }
    if (typeof entry === "object" && entry && "weekday" in entry) {
      const day = Number(entry.weekday);
      return rruleDayToCode[day];
    }
    return void 0;
  }).filter((value) => Boolean(value));
}
function deriveRecurrencePatternFromRule(rule, startsAt, timezone = DEFAULT_TIMEZONE2) {
  if (!rule) {
    return { kind: "none" };
  }
  let parsed;
  try {
    parsed = rrulestr(rule, { forceset: false });
  } catch {
    return { kind: "none" };
  }
  const options = "origOptions" in parsed ? parsed.origOptions : void 0;
  if (!options || options.freq === void 0) {
    return { kind: "none" };
  }
  const recurrenceUntil = options.until?.toISOString() ?? null;
  if (options.freq === RRule.DAILY) {
    return {
      kind: "daily",
      interval: options.interval ?? 1,
      until: recurrenceUntil
    };
  }
  if (options.freq === RRule.WEEKLY) {
    return {
      kind: "weekly",
      weekdays: normalizeWeekdayArray(options.byweekday),
      interval: options.interval ?? 1,
      until: recurrenceUntil
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
        until: recurrenceUntil
      };
    }
    return {
      kind: "monthly_day",
      interval: options.interval ?? 1,
      until: recurrenceUntil
    };
  }
  const zonedStart = toZonedTime(new Date(startsAt), timezone);
  return {
    kind: "weekly",
    weekdays: [jsDayToWeekdayCode[zonedStart.getDay()]],
    interval: options.interval ?? 1,
    until: recurrenceUntil
  };
}
function expandRecurringSeries(series, rangeStart, rangeEnd) {
  if (!series.recurrence_rule) {
    return [];
  }
  let parsed;
  try {
    parsed = rrulestr(series.recurrence_rule, { forceset: false });
  } catch {
    return [];
  }
  const startDate = new Date(series.starts_at);
  const endDate = new Date(series.ends_at);
  const durationMs = Math.max(1, endDate.getTime() - startDate.getTime());
  const timezone = series.timezone || DEFAULT_TIMEZONE2;
  const baseLocalStart = toZonedTime(startDate, timezone);
  const occurrences = parsed.between(rangeStart, rangeEnd, true);
  return occurrences.map((occurrenceStart) => {
    const normalizedOccurrenceStart = fromZonedTime2(
      `${occurrenceStart.getUTCFullYear()}-${String(occurrenceStart.getUTCMonth() + 1).padStart(2, "0")}-${String(
        occurrenceStart.getUTCDate()
      ).padStart(2, "0")}T${String(baseLocalStart.getHours()).padStart(2, "0")}:${String(
        baseLocalStart.getMinutes()
      ).padStart(2, "0")}:${String(baseLocalStart.getSeconds()).padStart(2, "0")}`,
      timezone
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
      timezone: series.timezone
    };
  });
}
function expandSingleSeries(series, rangeStart, rangeEnd) {
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
      timezone: series.timezone
    }
  ];
}
function expandSeriesForRange(rows, rangeStartIso, rangeEndIso) {
  const rangeStart = new Date(rangeStartIso);
  const rangeEnd = new Date(rangeEndIso);
  if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
    return [];
  }
  return rows.flatMap((series) => {
    if (series.deleted_at) {
      return [];
    }
    return series.recurrence_rule ? expandRecurringSeries(series, rangeStart, rangeEnd) : expandSingleSeries(series, rangeStart, rangeEnd);
  }).sort(
    (a, b) => new Date(a.occurrenceStart).getTime() - new Date(b.occurrenceStart).getTime()
  );
}
function resolveRangeFromSearchParams(searchParams) {
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (start && end) {
    return { start, end };
  }
  const now = /* @__PURE__ */ new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 0, 23, 59, 59)
  );
  return {
    start: monthStart.toISOString(),
    end: monthEnd.toISOString()
  };
}
function buildOccurrenceKey(seriesId, occurrenceStart) {
  const parsed = new Date(occurrenceStart);
  const canonicalStart = Number.isNaN(parsed.getTime()) ? occurrenceStart : parsed.toISOString();
  return `${seriesId}:${canonicalStart}`;
}
function mapActiveOverrideToOccurrence(row) {
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
    timezone: series.timezone
  };
}
async function listSeries(orgId) {
  const rows = await queryClient`
    SELECT *
    FROM calendar_event_series
    WHERE org_id = ${orgId}
      AND deleted_at IS NULL
    ORDER BY starts_at ASC
  `;
  return rows.map(normalizeSeriesRow);
}
async function listCancelledOccurrences(params) {
  const rows = await queryClient`
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
    occurrence_start: toIsoString(row.occurrence_start)
  }));
}
async function listActiveOccurrenceOverrides(params) {
  const rows = await queryClient`
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
      series: rawSeries && typeof rawSeries === "object" ? normalizeSeriesRow(rawSeries) : null
    };
  });
}
function getCalendarOrgId() {
  const configured = (process.env.CALENDAR_SOURCE_ORG_ID || "").trim();
  return configured || DEFAULT_CALENDAR_ORG_ID;
}
async function getNativeCalendarExportBundle(orgId = getCalendarOrgId()) {
  const [seriesRows, eventRows] = await Promise.all([
    queryClient`
      SELECT *
      FROM calendar_event_series
      WHERE org_id = ${orgId}
      ORDER BY created_at ASC
    `,
    queryClient`
      SELECT *
      FROM calendar_events
      WHERE org_id = ${orgId}
      ORDER BY created_at ASC
    `
  ]);
  return {
    version: "1",
    exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
    orgId,
    eventSeries: seriesRows.map(normalizeSeriesRow),
    events: eventRows.map(normalizeEventRow)
  };
}
async function getNativeCalendarEventsResponse(params) {
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
          row.timezone
        )
      }))
    };
  }
  const { start, end } = resolveRangeFromSearchParams(params.searchParams);
  const [cancelled, activeOverrides] = await Promise.all([
    listCancelledOccurrences({ orgId, start, end }),
    listActiveOccurrenceOverrides({ orgId, start, end })
  ]);
  const cancelledSet = new Set(
    cancelled.filter((row) => Boolean(row.series_id)).map((row) => buildOccurrenceKey(row.series_id, row.occurrence_start))
  );
  const activeOverrideSet = new Set(
    activeOverrides.filter((row) => Boolean(row.series_id)).map((row) => buildOccurrenceKey(row.series_id, row.occurrence_start))
  );
  const generatedOccurrences = expandSeriesForRange(series, start, end).filter(
    (occurrence) => !cancelledSet.has(buildOccurrenceKey(occurrence.seriesId, occurrence.occurrenceStart)) && !activeOverrideSet.has(buildOccurrenceKey(occurrence.seriesId, occurrence.occurrenceStart))
  );
  const overrideOccurrences = activeOverrides.map(mapActiveOverrideToOccurrence).filter((occurrence) => Boolean(occurrence));
  const occurrences = [...generatedOccurrences, ...overrideOccurrences].sort(
    (a, b) => new Date(a.occurrenceStart).getTime() - new Date(b.occurrenceStart).getTime()
  );
  return {
    range: { start, end },
    occurrences
  };
}
async function getNativePublicCalendarEventsResponse(searchParams) {
  const orgId = getCalendarOrgId();
  const { start, end } = resolveRangeFromSearchParams(searchParams);
  const series = await listSeries(orgId);
  const [cancelled, activeOverrides] = await Promise.all([
    listCancelledOccurrences({
      orgId,
      start,
      end
    }),
    listActiveOccurrenceOverrides({
      orgId,
      start,
      end
    })
  ]);
  const cancelledSet = new Set(
    cancelled.filter((row) => Boolean(row.series_id)).map((row) => buildOccurrenceKey(row.series_id, row.occurrence_start))
  );
  const activeOverrideSet = new Set(
    activeOverrides.filter((row) => Boolean(row.series_id)).map((row) => buildOccurrenceKey(row.series_id, row.occurrence_start))
  );
  const generatedEvents = expandSeriesForRange(series, start, end).filter((occurrence) => {
    const key = buildOccurrenceKey(occurrence.seriesId, occurrence.occurrenceStart);
    return !cancelledSet.has(key) && !activeOverrideSet.has(key);
  }).map((occurrence) => ({
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
    timezone: occurrence.timezone
  }));
  const overrideEvents = activeOverrides.map(mapActiveOverrideToOccurrence).filter((occurrence) => Boolean(occurrence)).map((occurrence) => ({
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
    timezone: occurrence.timezone
  }));
  const events = [...generatedEvents, ...overrideEvents].sort(
    (a, b) => new Date(a.occurrenceStart).getTime() - new Date(b.occurrenceStart).getTime()
  );
  return {
    range: { start, end },
    events
  };
}

// server/calendar-admin.ts
init_db();
var { RRule: RRule2 } = rrulePkg2;
var DEFAULT_TIMEZONE3 = "America/New_York";
var UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
var weekdaySchema = z2.enum(["SU", "MO", "TU", "WE", "TH", "FR", "SA"]);
var recurrencePatternSchema = z2.object({
  kind: z2.enum(["none", "daily", "weekly", "monthly_day", "monthly_nth_weekday"]),
  interval: z2.coerce.number().int().min(1).max(12).optional(),
  weekdays: z2.array(weekdaySchema).optional(),
  nth: z2.coerce.number().int().min(-1).max(5).optional(),
  weekday: weekdaySchema.optional(),
  until: z2.string().datetime().nullable().optional()
}).superRefine((value, ctx) => {
  if (value.kind === "weekly" && (!value.weekdays || value.weekdays.length === 0)) {
    ctx.addIssue({
      code: z2.ZodIssueCode.custom,
      message: "Weekly recurrence requires at least one weekday",
      path: ["weekdays"]
    });
  }
  if (value.kind === "monthly_nth_weekday") {
    if (!value.weekday) {
      ctx.addIssue({
        code: z2.ZodIssueCode.custom,
        message: "Monthly nth weekday recurrence requires weekday",
        path: ["weekday"]
      });
    }
    if (!value.nth || value.nth === 0) {
      ctx.addIssue({
        code: z2.ZodIssueCode.custom,
        message: "Monthly nth weekday recurrence requires nth value",
        path: ["nth"]
      });
    }
  }
});
var calendarEventInputSchema = z2.object({
  title: z2.string().trim().min(1).max(160),
  groupName: z2.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    },
    z2.string().max(80).nullable().optional()
  ),
  location: z2.string().trim().max(255).nullable().optional(),
  descriptionHtml: z2.string().max(15e3).default(""),
  eventColor: z2.string().regex(/^#([A-Fa-f0-9]{6})$/, "Event color must be a 6-digit hex color").default("#2563eb"),
  textColor: z2.string().regex(/^#([A-Fa-f0-9]{6})$/, "Text color must be a 6-digit hex color").default("#ffffff"),
  allDay: z2.boolean().default(false),
  startsAt: z2.string().datetime(),
  endsAt: z2.string().datetime(),
  timezone: z2.string().default(DEFAULT_TIMEZONE3),
  recurrencePattern: recurrencePatternSchema.nullable().optional(),
  recurrenceRule: z2.string().nullable().optional(),
  recurrenceUntil: z2.string().datetime().nullable().optional()
}).superRefine((value, ctx) => {
  const start = new Date(value.startsAt);
  const end = new Date(value.endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    ctx.addIssue({
      code: z2.ZodIssueCode.custom,
      message: "Invalid start/end date"
    });
    return;
  }
  if (end <= start) {
    ctx.addIssue({
      code: z2.ZodIssueCode.custom,
      message: "End date/time must be after start date/time",
      path: ["endsAt"]
    });
  }
});
var calendarOccurrenceCancelSchema = z2.object({
  seriesId: z2.string().uuid(),
  occurrenceStart: z2.string().datetime(),
  occurrenceEnd: z2.string().datetime().optional()
}).superRefine((value, ctx) => {
  if (!value.occurrenceEnd) return;
  const start = new Date(value.occurrenceStart);
  const end = new Date(value.occurrenceEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    ctx.addIssue({
      code: z2.ZodIssueCode.custom,
      message: "Invalid occurrence start/end date"
    });
    return;
  }
  if (end <= start) {
    ctx.addIssue({
      code: z2.ZodIssueCode.custom,
      message: "Occurrence end must be after occurrence start",
      path: ["occurrenceEnd"]
    });
  }
});
var calendarOccurrenceMoveSchema = z2.object({
  seriesId: z2.string().uuid(),
  occurrenceStart: z2.string().datetime(),
  occurrenceEnd: z2.string().datetime().optional(),
  newOccurrenceStart: z2.string().datetime(),
  newOccurrenceEnd: z2.string().datetime()
}).superRefine((value, ctx) => {
  const originalStart = new Date(value.occurrenceStart);
  const originalEnd = value.occurrenceEnd ? new Date(value.occurrenceEnd) : null;
  const newStart = new Date(value.newOccurrenceStart);
  const newEnd = new Date(value.newOccurrenceEnd);
  if (Number.isNaN(originalStart.getTime()) || originalEnd && Number.isNaN(originalEnd.getTime()) || Number.isNaN(newStart.getTime()) || Number.isNaN(newEnd.getTime())) {
    ctx.addIssue({
      code: z2.ZodIssueCode.custom,
      message: "Invalid occurrence dates"
    });
    return;
  }
  if (originalEnd && originalEnd <= originalStart) {
    ctx.addIssue({
      code: z2.ZodIssueCode.custom,
      message: "Occurrence end must be after occurrence start",
      path: ["occurrenceEnd"]
    });
  }
  if (newEnd <= newStart) {
    ctx.addIssue({
      code: z2.ZodIssueCode.custom,
      message: "New occurrence end must be after new occurrence start",
      path: ["newOccurrenceEnd"]
    });
  }
});
var codeToRRuleWeekday = {
  SU: RRule2.SU,
  MO: RRule2.MO,
  TU: RRule2.TU,
  WE: RRule2.WE,
  TH: RRule2.TH,
  FR: RRule2.FR,
  SA: RRule2.SA
};
var rruleDayToCode2 = {
  0: "MO",
  1: "TU",
  2: "WE",
  3: "TH",
  4: "FR",
  5: "SA",
  6: "SU"
};
var jsDayToWeekdayCode2 = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
function toIsoString2(value) {
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
function toNullableIsoString3(value) {
  if (value === null || value === void 0) return null;
  const iso = toIsoString2(value);
  return iso || null;
}
function toBoolean2(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "t" || normalized === "1") return true;
    if (normalized === "false" || normalized === "f" || normalized === "0") return false;
  }
  return fallback;
}
function normalizeSeriesRow2(input) {
  return {
    id: String(input.id ?? ""),
    org_id: String(input.org_id ?? getCalendarOrgId()),
    title: String(input.title ?? ""),
    group_name: typeof input.group_name === "string" ? input.group_name : null,
    location: typeof input.location === "string" ? input.location : null,
    description_html: String(input.description_html ?? ""),
    event_color: typeof input.event_color === "string" && input.event_color.trim().length > 0 ? input.event_color : "#2563eb",
    text_color: typeof input.text_color === "string" && input.text_color.trim().length > 0 ? input.text_color : "#ffffff",
    all_day: toBoolean2(input.all_day, false),
    starts_at: toIsoString2(input.starts_at),
    ends_at: toIsoString2(input.ends_at),
    timezone: typeof input.timezone === "string" && input.timezone.trim().length > 0 ? input.timezone : DEFAULT_TIMEZONE3,
    recurrence_rule: typeof input.recurrence_rule === "string" ? input.recurrence_rule : null,
    recurrence_until: toNullableIsoString3(input.recurrence_until),
    integration_source: typeof input.integration_source === "string" ? input.integration_source : null,
    integration_key: typeof input.integration_key === "string" ? input.integration_key : null,
    created_by: typeof input.created_by === "string" ? input.created_by : null,
    created_at: toIsoString2(input.created_at),
    updated_at: toIsoString2(input.updated_at),
    deleted_at: toNullableIsoString3(input.deleted_at)
  };
}
function normalizeEventRow2(input) {
  return {
    id: String(input.id ?? ""),
    org_id: String(input.org_id ?? getCalendarOrgId()),
    series_id: typeof input.series_id === "string" ? input.series_id : null,
    occurrence_start: toIsoString2(input.occurrence_start),
    occurrence_end: toIsoString2(input.occurrence_end),
    title_override: typeof input.title_override === "string" ? input.title_override : null,
    location_override: typeof input.location_override === "string" ? input.location_override : null,
    description_html_override: typeof input.description_html_override === "string" ? input.description_html_override : null,
    all_day_override: typeof input.all_day_override === "boolean" ? input.all_day_override : null,
    status: typeof input.status === "string" && input.status.trim().length > 0 ? input.status : "ACTIVE",
    created_at: toIsoString2(input.created_at),
    updated_at: toIsoString2(input.updated_at)
  };
}
function normalizeWeekdayArray2(byweekday) {
  if (!byweekday) return [];
  const weekdays = Array.isArray(byweekday) ? byweekday : [byweekday];
  return weekdays.map((entry) => {
    if (typeof entry === "number") {
      return rruleDayToCode2[entry];
    }
    if (typeof entry === "object" && entry && "weekday" in entry) {
      const day = Number(entry.weekday);
      return rruleDayToCode2[day];
    }
    return void 0;
  }).filter((value) => Boolean(value));
}
function deriveRecurrencePatternFromRule2(rule, startsAt, timezone = DEFAULT_TIMEZONE3) {
  if (!rule) {
    return { kind: "none" };
  }
  let parsed;
  try {
    parsed = rrulePkg2.rrulestr(rule, { forceset: false });
  } catch {
    return { kind: "none" };
  }
  const options = "origOptions" in parsed ? parsed.origOptions : void 0;
  if (!options || options.freq === void 0) {
    return { kind: "none" };
  }
  const recurrenceUntil = options.until?.toISOString() ?? null;
  if (options.freq === RRule2.DAILY) {
    return {
      kind: "daily",
      interval: options.interval ?? 1,
      until: recurrenceUntil
    };
  }
  if (options.freq === RRule2.WEEKLY) {
    return {
      kind: "weekly",
      weekdays: normalizeWeekdayArray2(options.byweekday),
      interval: options.interval ?? 1,
      until: recurrenceUntil
    };
  }
  if (options.freq === RRule2.MONTHLY) {
    if (options.bysetpos && options.byweekday) {
      const weekdays = normalizeWeekdayArray2(options.byweekday);
      return {
        kind: "monthly_nth_weekday",
        nth: Array.isArray(options.bysetpos) ? options.bysetpos[0] : options.bysetpos,
        weekday: weekdays[0],
        interval: options.interval ?? 1,
        until: recurrenceUntil
      };
    }
    return {
      kind: "monthly_day",
      interval: options.interval ?? 1,
      until: recurrenceUntil
    };
  }
  const zonedStart = toZonedTime2(new Date(startsAt), timezone);
  return {
    kind: "weekly",
    weekdays: [jsDayToWeekdayCode2[zonedStart.getDay()]],
    interval: options.interval ?? 1,
    until: recurrenceUntil
  };
}
function buildRecurrenceRuleFromPattern(params) {
  const { startsAt, timezone = DEFAULT_TIMEZONE3, pattern } = params;
  if (!pattern || pattern.kind === "none") {
    return {
      rule: null,
      recurrenceUntil: pattern?.until ?? null
    };
  }
  const startDate = new Date(startsAt);
  const zonedStart = toZonedTime2(startDate, timezone);
  const localRuleStart = new Date(
    Date.UTC(
      zonedStart.getFullYear(),
      zonedStart.getMonth(),
      zonedStart.getDate(),
      zonedStart.getHours(),
      zonedStart.getMinutes(),
      zonedStart.getSeconds()
    )
  );
  const options = {
    dtstart: localRuleStart,
    interval: pattern.interval ?? 1
  };
  if (pattern.until) {
    const zonedUntil = toZonedTime2(new Date(pattern.until), timezone);
    options.until = new Date(
      Date.UTC(
        zonedUntil.getFullYear(),
        zonedUntil.getMonth(),
        zonedUntil.getDate(),
        zonedUntil.getHours(),
        zonedUntil.getMinutes(),
        zonedUntil.getSeconds()
      )
    );
  }
  switch (pattern.kind) {
    case "daily":
      options.freq = RRule2.DAILY;
      break;
    case "weekly":
      options.freq = RRule2.WEEKLY;
      options.byweekday = (pattern.weekdays ?? [jsDayToWeekdayCode2[zonedStart.getDay()]]).map(
        (weekday) => codeToRRuleWeekday[weekday]
      );
      break;
    case "monthly_day":
      options.freq = RRule2.MONTHLY;
      options.bymonthday = [zonedStart.getDate()];
      break;
    case "monthly_nth_weekday":
      options.freq = RRule2.MONTHLY;
      options.bysetpos = [pattern.nth ?? 1];
      options.byweekday = [
        codeToRRuleWeekday[pattern.weekday ?? jsDayToWeekdayCode2[zonedStart.getDay()]]
      ];
      break;
    default:
      return { rule: null, recurrenceUntil: pattern.until ?? null };
  }
  const rule = new RRule2(options);
  return {
    rule: rule.toString(),
    recurrenceUntil: pattern.until ?? null
  };
}
function normalizeDescriptionHtml(value) {
  return (value || "").trim();
}
function toUuidOrNull(value) {
  if (typeof value !== "string") return null;
  return UUID_PATTERN.test(value) ? value : null;
}
function getCalendarAdminErrorMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Unexpected error";
}
async function findSeriesById(id, orgId = getCalendarOrgId()) {
  const rows = await queryClient`
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
  return normalizeSeriesRow2(rows[0]);
}
async function getCalendarIdempotentReplay(params) {
  if (!params.key) {
    return null;
  }
  const rows = await queryClient`
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
    payload: rows[0].response_payload ?? {}
  };
}
async function storeCalendarIdempotentReplay(params) {
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
    responsePayload: params.payload
  });
}
async function appendCalendarAuditLog(input) {
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
      ${randomUUID2()}::uuid,
      ${input.orgId},
      ${input.eventType},
      ${input.entityType ?? null},
      ${input.entityId ?? null}::uuid,
      ${JSON.stringify(input.payload ?? {})}::jsonb,
      ${input.idempotencyKey ?? null},
      ${input.requestPath ?? null},
      ${input.httpMethod ?? null},
      ${input.responseStatus ?? null},
      ${input.responsePayload === void 0 ? null : JSON.stringify(input.responsePayload)}::jsonb,
      ${input.webhookStatus ?? null}
    )
  `;
}
async function createNativeCalendarSeries(params) {
  const orgId = params.orgId || getCalendarOrgId();
  const recurrenceFromPattern = buildRecurrenceRuleFromPattern({
    startsAt: params.input.startsAt,
    timezone: params.input.timezone,
    pattern: params.input.recurrencePattern
  });
  const payload = {
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
    recurrence_rule: params.input.recurrencePattern ? recurrenceFromPattern.rule : params.input.recurrenceRule ?? null,
    recurrence_until: params.input.recurrencePattern ? recurrenceFromPattern.recurrenceUntil : params.input.recurrenceUntil ?? null
  };
  const rows = await queryClient`
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
      ${randomUUID2()}::uuid,
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
  const created = normalizeSeriesRow2(rows[0]);
  return {
    eventSeries: {
      ...created,
      recurrencePattern: deriveRecurrencePatternFromRule2(
        created.recurrence_rule,
        created.starts_at,
        created.timezone
      )
    }
  };
}
async function updateNativeCalendarSeries(params) {
  const orgId = params.orgId || getCalendarOrgId();
  const recurrenceFromPattern = buildRecurrenceRuleFromPattern({
    startsAt: params.input.startsAt,
    timezone: params.input.timezone,
    pattern: params.input.recurrencePattern
  });
  const rows = await queryClient`
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
      recurrence_rule = ${params.input.recurrencePattern ? recurrenceFromPattern.rule : params.input.recurrenceRule ?? null},
      recurrence_until = ${params.input.recurrencePattern ? recurrenceFromPattern.recurrenceUntil : params.input.recurrenceUntil ?? null}::timestamptz,
      updated_at = now()
    WHERE id = ${params.id}::uuid
      AND org_id = ${orgId}
      AND deleted_at IS NULL
    RETURNING *
  `;
  if (rows.length === 0) {
    return null;
  }
  const updated = normalizeSeriesRow2(rows[0]);
  return {
    eventSeries: {
      ...updated,
      recurrencePattern: deriveRecurrencePatternFromRule2(
        updated.recurrence_rule,
        updated.starts_at,
        updated.timezone
      )
    }
  };
}
async function deleteNativeCalendarSeries(params) {
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
    deletedId: params.id
  };
}
function toCanonicalIso(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid occurrence date");
  }
  return parsed.toISOString();
}
async function cancelNativeCalendarOccurrence(params) {
  const orgId = params.orgId || getCalendarOrgId();
  const series = await findSeriesById(params.input.seriesId, orgId);
  if (!series) {
    return null;
  }
  const canonicalOccurrenceStart = toCanonicalIso(params.input.occurrenceStart);
  const occurrenceStartDate = new Date(canonicalOccurrenceStart);
  const seriesDuration = Math.max(
    60 * 1e3,
    new Date(series.ends_at).getTime() - new Date(series.starts_at).getTime()
  );
  const canonicalOccurrenceEnd = params.input.occurrenceEnd ? toCanonicalIso(params.input.occurrenceEnd) : new Date(occurrenceStartDate.getTime() + seriesDuration).toISOString();
  const existingRows = await queryClient`
    SELECT id
    FROM calendar_events
    WHERE org_id = ${orgId}
      AND series_id = ${params.input.seriesId}::uuid
      AND occurrence_start = ${canonicalOccurrenceStart}::timestamptz
    ORDER BY created_at DESC
    LIMIT 1
  `;
  let eventRow;
  if (existingRows.length > 0 && typeof existingRows[0].id === "string") {
    const updatedRows = await queryClient`
      UPDATE calendar_events
      SET
        status = 'CANCELLED',
        occurrence_end = ${canonicalOccurrenceEnd}::timestamptz,
        updated_at = now()
      WHERE id = ${existingRows[0].id}::uuid
      RETURNING *
    `;
    eventRow = normalizeEventRow2(updatedRows[0]);
  } else {
    const insertedRows = await queryClient`
      INSERT INTO calendar_events (
        id,
        org_id,
        series_id,
        occurrence_start,
        occurrence_end,
        status
      ) VALUES (
        ${randomUUID2()}::uuid,
        ${orgId},
        ${params.input.seriesId}::uuid,
        ${canonicalOccurrenceStart}::timestamptz,
        ${canonicalOccurrenceEnd}::timestamptz,
        'CANCELLED'
      )
      RETURNING *
    `;
    eventRow = normalizeEventRow2(insertedRows[0]);
  }
  return {
    occurrence: {
      id: eventRow.id,
      seriesId: eventRow.series_id,
      occurrenceStart: eventRow.occurrence_start,
      occurrenceEnd: eventRow.occurrence_end,
      status: eventRow.status
    }
  };
}
async function upsertActiveCalendarOccurrence(params) {
  const existingRows = await queryClient`
    SELECT id
    FROM calendar_events
    WHERE org_id = ${params.orgId}
      AND series_id = ${params.seriesId}::uuid
      AND occurrence_start = ${params.occurrenceStart}::timestamptz
    ORDER BY created_at DESC
    LIMIT 1
  `;
  if (existingRows.length > 0 && typeof existingRows[0].id === "string") {
    const updatedRows = await queryClient`
      UPDATE calendar_events
      SET
        status = 'ACTIVE',
        occurrence_end = ${params.occurrenceEnd}::timestamptz,
        updated_at = now()
      WHERE id = ${existingRows[0].id}::uuid
      RETURNING *
    `;
    return normalizeEventRow2(updatedRows[0]);
  }
  const insertedRows = await queryClient`
    INSERT INTO calendar_events (
      id,
      org_id,
      series_id,
      occurrence_start,
      occurrence_end,
      status
    ) VALUES (
      ${randomUUID2()}::uuid,
      ${params.orgId},
      ${params.seriesId}::uuid,
      ${params.occurrenceStart}::timestamptz,
      ${params.occurrenceEnd}::timestamptz,
      'ACTIVE'
    )
    RETURNING *
  `;
  return normalizeEventRow2(insertedRows[0]);
}
async function moveNativeCalendarOccurrence(params) {
  const orgId = params.orgId || getCalendarOrgId();
  const series = await findSeriesById(params.input.seriesId, orgId);
  if (!series) {
    return null;
  }
  const canonicalOccurrenceStart = toCanonicalIso(params.input.occurrenceStart);
  const canonicalNewOccurrenceStart = toCanonicalIso(params.input.newOccurrenceStart);
  const canonicalNewOccurrenceEnd = toCanonicalIso(params.input.newOccurrenceEnd);
  if (!series.recurrence_rule) {
    const rows = await queryClient`
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
    const updated = normalizeSeriesRow2(rows[0]);
    return {
      eventSeries: {
        ...updated,
        recurrencePattern: deriveRecurrencePatternFromRule2(
          updated.recurrence_rule,
          updated.starts_at,
          updated.timezone
        )
      }
    };
  }
  const occurrenceStartDate = new Date(canonicalOccurrenceStart);
  const seriesDuration = Math.max(
    60 * 1e3,
    new Date(series.ends_at).getTime() - new Date(series.starts_at).getTime()
  );
  const originalOccurrenceEnd = params.input.occurrenceEnd ? toCanonicalIso(params.input.occurrenceEnd) : new Date(occurrenceStartDate.getTime() + seriesDuration).toISOString();
  const cancelledPayload = await cancelNativeCalendarOccurrence({
    orgId,
    input: {
      seriesId: params.input.seriesId,
      occurrenceStart: canonicalOccurrenceStart,
      occurrenceEnd: originalOccurrenceEnd
    }
  });
  const moved = await upsertActiveCalendarOccurrence({
    orgId,
    seriesId: params.input.seriesId,
    occurrenceStart: canonicalNewOccurrenceStart,
    occurrenceEnd: canonicalNewOccurrenceEnd
  });
  return {
    occurrence: {
      id: moved.id,
      seriesId: moved.series_id,
      occurrenceStart: moved.occurrence_start,
      occurrenceEnd: moved.occurrence_end,
      status: moved.status
    },
    cancelledOccurrence: cancelledPayload?.occurrence ?? null
  };
}

// server/routes.ts
init_timezone();
var COMMANDER_NOTIFICATION_EMAIL = "commander@vfwharrisonoh.org";
function verifySecureToken(token) {
  try {
    if (!process.env.SESSION_SECRET) {
      throw new Error("SESSION_SECRET environment variable must be set");
    }
    const decoded = Buffer.from(token, "base64").toString();
    const [needIdStr, action, expiryTimeStr, signature] = decoded.split(":");
    const needId = parseInt(needIdStr);
    const expiryTime = parseInt(expiryTimeStr);
    if (isNaN(expiryTime) || Date.now() > expiryTime) {
      return { needId, action, valid: false };
    }
    const payload = `${needId}:${action}:${expiryTime}`;
    const hmac = createHmac3("sha256", process.env.SESSION_SECRET);
    hmac.update(payload);
    const expectedSignature = hmac.digest("hex");
    const valid = signature === expectedSignature;
    return { needId, action, valid };
  } catch (err) {
    console.error("Error verifying token:", err);
    return { needId: -1, action: "", valid: false };
  }
}
var nyDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  hourCycle: "h23"
});
function getPublicEventLastDate(need) {
  if (need.needType !== "EVENT" /* EVENT */) {
    return null;
  }
  return need.eventLastDate || need.endDate || need.eventDate || need.neededBy || need.startDate || null;
}
function isEventHiddenFromPublic(need) {
  if (need.needType !== "EVENT" /* EVENT */) {
    return false;
  }
  if (need.status === "FULFILLED" /* FULFILLED */) {
    return true;
  }
  const eventLastDate = getPublicEventLastDate(need);
  if (!eventLastDate) {
    return false;
  }
  return getCurrentDateInNewYork() > eventLastDate;
}
function isEventRoleHiddenFromPublic(need, role) {
  const slotDate = role.slotDate || need.eventDate || need.startDate || need.neededBy || null;
  return Boolean(slotDate && getCurrentDateInNewYork() > slotDate);
}
function isNeedHiddenFromPublic(need) {
  return need.status === "DRAFT" /* DRAFT */ || need.status === "UNFULFILLED" /* UNFULFILLED */ || isEventHiddenFromPublic(need);
}
function getNewYorkLocalParts(date2) {
  const parts = nyDateTimeFormatter.formatToParts(date2);
  const getPart = (type) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  return {
    year: getPart("year"),
    month: getPart("month"),
    day: getPart("day"),
    hour: getPart("hour"),
    minute: getPart("minute"),
    second: getPart("second")
  };
}
function toIsoDate(parts) {
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}-${month}-${day}`;
}
function getNewYorkIsoDate(date2) {
  return toIsoDate(getNewYorkLocalParts(date2));
}
function newYorkDateTimeToUtc(slotDate, slotTime) {
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
      0
    );
    const diffMs = desiredUtcMinutes - actualUtcMinutes;
    if (diffMs === 0) break;
    guess = new Date(guess.getTime() + diffMs);
  }
  return Number.isNaN(guess.getTime()) ? null : guess;
}
async function registerRoutes(app) {
  const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const parseTimeToMinutes3 = (time) => {
    const trimmed = time.trim();
    const match = timePattern.exec(trimmed);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    return hours * 60 + minutes;
  };
  const isTimeRangeOrdered = (startTime, endTime) => {
    if (!startTime || !endTime) return true;
    const startMinutes = parseTimeToMinutes3(startTime);
    const endMinutes = parseTimeToMinutes3(endTime);
    if (startMinutes === null || endMinutes === null) return false;
    return startMinutes < endMinutes;
  };
  const eventRolePayloadSchema = z3.object({
    id: z3.number().int().positive().optional(),
    name: z3.string().trim().min(1, "Role name is required"),
    slotDate: z3.preprocess(
      (value) => typeof value === "string" && value.trim() === "" ? void 0 : value,
      z3.union([
        z3.string().trim().regex(datePattern, "Slot date must be YYYY-MM-DD"),
        z3.null(),
        z3.undefined()
      ]).optional()
    ),
    startTime: z3.string().trim().regex(timePattern, "Start time must be HH:mm"),
    endTime: z3.string().trim().regex(timePattern, "End time must be HH:mm"),
    capacity: z3.union([z3.number().int().positive(), z3.null(), z3.undefined()]).optional().transform((value) => value === void 0 ? 1 : value),
    displayOrder: z3.number().int().nonnegative().optional(),
    isActive: z3.boolean().optional()
  }).refine((role) => isTimeRangeOrdered(role.startTime, role.endTime), {
    message: "Role end time must be after start time.",
    path: ["endTime"]
  });
  const needMutationSchema = insertNeedSchema.extend({
    eventRoles: z3.array(eventRolePayloadSchema).optional()
  });
  const pledgeMutationSchema = insertPledgeSchema.extend({
    donationType: z3.enum(["items", "money", "signup"]),
    selectedEventRoleIds: z3.array(z3.number().int().positive()).optional(),
    selectedEventRoleQuantities: z3.record(z3.string(), z3.number().int().positive()).optional()
  });
  const publicSubscriberSchema = z3.object({
    firstName: z3.string().trim().min(1, "First name is required").max(80),
    lastName: z3.string().trim().min(1, "Last name is required").max(80),
    email: z3.string().trim().email("Please enter a valid email address"),
    phone: z3.string().trim().min(7, "Phone number is required").max(30)
  });
  const resetAdminPasswordSchema = z3.object({
    newPassword: z3.string().min(8, "Password must be at least 8 characters").max(128),
    notifyUser: z3.boolean().optional()
  });
  const notificationPreferencesSchema = z3.object({
    receiveAllNotifications: z3.boolean(),
    enabledCategories: z3.array(z3.string().trim().min(1)).default([])
  });
  const eventSignupManageUpdateSchema = z3.object({
    token: z3.string().trim().min(1),
    firstName: z3.string().trim().min(1, "First name is required").max(80),
    lastName: z3.string().trim().min(1, "Last name is required").max(80),
    email: z3.string().trim().email("Please enter a valid email address"),
    phone: z3.union([z3.string().trim().max(30), z3.null(), z3.undefined()]).optional().transform((value) => typeof value === "string" && value.trim().length > 0 ? value.trim() : null),
    organization: z3.union([z3.string().trim().max(120), z3.null(), z3.undefined()]).optional().transform((value) => typeof value === "string" && value.trim().length > 0 ? value.trim() : null),
    notes: z3.union([z3.string().trim().max(2e3), z3.null(), z3.undefined()]).optional().transform((value) => typeof value === "string" && value.trim().length > 0 ? value.trim() : null),
    selectedEventRoleIds: z3.array(z3.number().int().positive()).min(1, "Please select at least one sign-up slot.")
  });
  const eventSignupManageCancelSchema = z3.object({
    token: z3.string().trim().min(1)
  });
  const adminEventSignupUpdateSchema = z3.object({
    firstName: z3.string().trim().min(1, "First name is required").max(80),
    lastName: z3.string().trim().min(1, "Last name is required").max(80),
    email: z3.string().trim().email("Please enter a valid email address"),
    phone: z3.union([z3.string().trim().max(30), z3.null(), z3.undefined()]).optional().transform((value) => typeof value === "string" && value.trim().length > 0 ? value.trim() : null),
    organization: z3.union([z3.string().trim().max(120), z3.null(), z3.undefined()]).optional().transform((value) => typeof value === "string" && value.trim().length > 0 ? value.trim() : null),
    notes: z3.union([z3.string().trim().max(2e3), z3.null(), z3.undefined()]).optional().transform((value) => typeof value === "string" && value.trim().length > 0 ? value.trim() : null),
    selectedEventRoleIds: z3.array(z3.number().int().positive()).default([])
  });
  const parseEnabledCategories = (raw) => {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((value) => typeof value === "string").map((value) => value.trim().toUpperCase()).filter((value) => value.length > 0);
    } catch {
      return [];
    }
  };
  const parseNeedCategorySelections = (raw, fallbackCategory) => {
    const fallback = (fallbackCategory || "").trim().toUpperCase();
    if (!raw) return fallback ? [fallback] : [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return fallback ? [fallback] : [];
      const values = parsed.filter((value) => typeof value === "string").map((value) => value.trim().toUpperCase()).filter((value) => value.length > 0);
      if (values.length === 0 && fallback) return [fallback];
      return Array.from(new Set(values));
    } catch {
      return fallback ? [fallback] : [];
    }
  };
  const getAdminsForNotification = async (need) => {
    const needCategories = parseNeedCategorySelections(need.categorySelections, need.category);
    const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
    const { users: users2, adminNotificationPreferences: adminNotificationPreferences2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
    const admins = await db2.select({
      id: users2.id,
      username: users2.username
    }).from(users2).where(eq5(users2.isAdmin, true));
    if (admins.length === 0) {
      return [];
    }
    const preferences = await db2.select({
      userId: adminNotificationPreferences2.userId,
      receiveAllNotifications: adminNotificationPreferences2.receiveAllNotifications,
      enabledCategories: adminNotificationPreferences2.enabledCategories
    }).from(adminNotificationPreferences2).where(
      inArray2(
        adminNotificationPreferences2.userId,
        admins.map((admin) => admin.id)
      )
    );
    const preferenceByUserId = new Map(preferences.map((pref) => [pref.userId, pref]));
    const eligibleAdminEmails = admins.filter((admin) => {
      const preference = preferenceByUserId.get(admin.id);
      if (!preference || preference.receiveAllNotifications) {
        return true;
      }
      const enabledCategories = parseEnabledCategories(preference.enabledCategories);
      if (enabledCategories.length === 0) {
        return false;
      }
      return needCategories.some((category) => enabledCategories.includes(category));
    }).map((admin) => admin.username).filter((email) => Boolean(email));
    return Array.from(/* @__PURE__ */ new Set([...eligibleAdminEmails, COMMANDER_NOTIFICATION_EMAIL]));
  };
  const sendEventSignupChangeNotifications = async (need, pledge, changeType) => {
    const signerEmail = pledge.email.trim().toLowerCase();
    const adminRecipients = Array.from(
      new Set(
        (await getAdminsForNotification(need)).map((email) => email.trim().toLowerCase()).filter(Boolean)
      )
    ).filter((email) => email !== signerEmail);
    const sendTasks = [
      sendEventSignupChangeConfirmation(
        { id: need.id, title: need.title, eventLocation: need.eventLocation },
        pledge,
        changeType,
        signerEmail,
        "volunteer"
      )
    ];
    if (adminRecipients.length > 0) {
      sendTasks.push(
        sendEventSignupChangeConfirmation(
          { id: need.id, title: need.title, eventLocation: need.eventLocation },
          pledge,
          changeType,
          adminRecipients,
          "admin"
        )
      );
    }
    const results = await Promise.all(sendTasks);
    if (results.some((result) => !result)) {
      console.warn(
        `Event sign-up ${changeType} notification had one or more delivery failures for pledge ${pledge.id}`
      );
    }
  };
  const normalizeNeedMutationPayload = (payload) => {
    const next = { ...payload };
    const isEventNeed = next.needType === "EVENT" /* EVENT */;
    if (isEventNeed) {
      next.allowItemDonations = false;
      next.allowMoneyDonations = false;
      next.status = next.status === "DRAFT" /* DRAFT */ ? "DRAFT" /* DRAFT */ : next.status === "PLEDGED" /* PLEDGED */ ? "PLEDGED" /* PLEDGED */ : "FLOATING" /* FLOATING */;
    }
    return next;
  };
  const isPublishedEventNeed = (need) => {
    if (!need) return false;
    return need.needType === "EVENT" /* EVENT */ && need.status !== "DRAFT" /* DRAFT */ && need.status !== "UNFULFILLED" /* UNFULFILLED */;
  };
  const enqueueCalendarSyncForNeedTransition = async (previousNeed, nextNeed) => {
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
  const validateEventNeedPayload = (payload) => {
    if (payload.needType !== "EVENT" /* EVENT */) return null;
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
      if (role.capacity !== null && role.capacity !== void 0 && role.capacity <= 0) {
        return `Role "${role.name || "Unnamed"}" capacity must be greater than 0 when provided.`;
      }
    }
    return null;
  };
  let statsCache = null;
  const STATS_CACHE_TTL = 3e4;
  app.use("/api/needs", (req, _res, next) => {
    if (req.method !== "GET") statsCache = null;
    next();
  });
  app.use("/api/pledges", (req, _res, next) => {
    if (req.method !== "GET") statsCache = null;
    next();
  });
  app.get("/api/health", async (_req, res) => {
    try {
      const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const result = await db2.execute("SELECT 1 as ok");
      res.json({ status: "ok", db: "connected", result: result?.[0] ?? null, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
    } catch (err) {
      res.status(500).json({ status: "error", db: "failed", error: err?.message, code: err?.code, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
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
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
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
      const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const { pledges: pledges2, needs: needs2, eventSignupReminders: eventSignupReminders2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const pledgeRows = await db2.select({
        pledgeId: pledges2.id,
        needId: needs2.id,
        needTitle: needs2.title,
        needEventLocation: needs2.eventLocation,
        needEventDate: needs2.eventDate,
        firstName: pledges2.firstName,
        email: pledges2.email
      }).from(pledges2).innerJoin(needs2, eq5(pledges2.needId, needs2.id)).where(
        and4(
          eq5(needs2.needType, "EVENT" /* EVENT */),
          ne(needs2.status, "DRAFT" /* DRAFT */),
          ne(needs2.status, "FULFILLED" /* FULFILLED */)
        )
      );
      if (pledgeRows.length === 0) {
        return res.json({
          success: true,
          scheduled: 0,
          skipped: 0,
          failed: 0,
          message: "No event sign-ups eligible for reminders."
        });
      }
      const selectionsByPledgeId = await storage.getEventRoleSelectionsByPledgeIds(
        pledgeRows.map((row) => row.pledgeId)
      );
      const grouped = /* @__PURE__ */ new Map();
      for (const row of pledgeRows) {
        const selectedRoles = selectionsByPledgeId.get(row.pledgeId) || [];
        if (selectedRoles.length === 0) continue;
        const normalizedEmail = row.email.trim().toLowerCase();
        const key = `${row.needId}:${normalizedEmail}`;
        const existing = grouped.get(key);
        const group = existing || {
          needId: row.needId,
          needTitle: row.needTitle,
          needEventLocation: row.needEventLocation,
          email: row.email,
          normalizedEmail,
          firstName: row.firstName || null,
          roles: /* @__PURE__ */ new Map(),
          firstSlotAt: null
        };
        if (!group.firstName && row.firstName) {
          group.firstName = row.firstName;
        }
        for (const role of selectedRoles) {
          const effectiveSlotDate = role.slotDate || row.needEventDate || null;
          const roleForReminder = {
            ...role,
            slotDate: effectiveSlotDate
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
      const now = /* @__PURE__ */ new Date();
      const nowNy = getNewYorkLocalParts(now);
      const todayNyDate = toIsoDate(nowNy);
      const tomorrowNyDate = getNewYorkIsoDate(
        new Date(Date.UTC(nowNy.year, nowNy.month - 1, nowNy.day + 1, 12, 0, 0))
      );
      const reminderSendAtUtc = newYorkDateTimeToUtc(todayNyDate, reminderSendTimeLocal);
      const sendAtUnix = reminderSendAtUtc && reminderSendAtUtc.getTime() > now.getTime() + 6e4 ? Math.floor(reminderSendAtUtc.getTime() / 1e3) : void 0;
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
        const [reservation] = await db2.insert(eventSignupReminders2).values({
          needId: group.needId,
          signerEmail: group.normalizedEmail,
          firstSlotAt: group.firstSlotAt,
          reminderType,
          sentAt: /* @__PURE__ */ new Date()
        }).onConflictDoNothing().returning({ id: eventSignupReminders2.id });
        if (!reservation) {
          skipped += 1;
          continue;
        }
        const reminderSent = await sendEventSignupReminder(
          {
            id: group.needId,
            title: group.needTitle,
            eventLocation: group.needEventLocation
          },
          {
            email: group.email,
            firstName: group.firstName
          },
          Array.from(group.roles.values()),
          {
            sendAtUnix
          }
        );
        if (!reminderSent) {
          failed += 1;
          await db2.delete(eventSignupReminders2).where(eq5(eventSignupReminders2.id, reservation.id));
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
        reminderScheduledForIso: reminderSendAtUtc?.toISOString() || null
      });
    } catch (error) {
      console.error("Event signup reminder cron failed:", error);
      return res.status(500).json({ message: "Event signup reminder cron failed" });
    }
  });
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use("/uploads", express.static(uploadsDir));
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
  setupAuth(app);
  const hasCalendarAdminAccess = (req) => {
    return Boolean(req.isAuthenticated?.() && req.user?.isAdmin);
  };
  const getRequestSearchParams = (req) => {
    const queryIndex = req.originalUrl.indexOf("?");
    const query = queryIndex >= 0 ? req.originalUrl.slice(queryIndex + 1) : "";
    return new URLSearchParams(query);
  };
  const getCalendarNativeError = (error) => {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return "Unknown native calendar handler error";
  };
  const getCalendarRequestPath = (req) => {
    const queryIndex = req.originalUrl.indexOf("?");
    return queryIndex >= 0 ? req.originalUrl.slice(0, queryIndex) : req.originalUrl;
  };
  const getCalendarIdempotencyKey = (req) => {
    const header = req.header("Idempotency-Key");
    if (!header) return null;
    const key = header.trim();
    return key.length > 0 ? key : null;
  };
  const getCalendarAdminOrgId = () => getCalendarOrgId();
  app.get("/api/public/events", async (req, res) => {
    try {
      const payload = await getNativePublicCalendarEventsResponse(getRequestSearchParams(req));
      return res.json(payload);
    } catch (error) {
      console.warn(
        "Native /api/public/events failed; falling back to compatibility proxy:",
        getCalendarNativeError(error)
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
        searchParams: getRequestSearchParams(req)
      });
      return res.json(payload);
    } catch (error) {
      console.warn(
        "Native GET /api/v1/calendar/events failed; falling back to compatibility proxy:",
        getCalendarNativeError(error)
      );
      await proxyCalendarRequest(req, res);
    }
  });
  app.post("/api/v1/calendar/events", async (req, res) => {
    if (!hasCalendarAdminAccess(req)) {
      return res.status(403).json({ message: "Not authorized" });
    }
    const orgId = getCalendarAdminOrgId();
    const path2 = "/api/v1/calendar/events";
    const idempotencyKey = getCalendarIdempotencyKey(req);
    try {
      const replay = await getCalendarIdempotentReplay({
        orgId,
        key: idempotencyKey,
        method: "POST",
        path: path2
      });
      if (replay) {
        return res.status(replay.status).json(replay.payload);
      }
      const parsed = calendarEventInputSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: parsed.error.flatten()
        });
      }
      const payload = await createNativeCalendarSeries({
        orgId,
        createdBy: req.user?.id ?? null,
        input: parsed.data
      });
      await appendCalendarAuditLog({
        orgId,
        eventType: "calendar.event.created",
        entityType: "calendar_event_series",
        entityId: payload.eventSeries.id,
        payload,
        idempotencyKey,
        requestPath: path2,
        httpMethod: "POST",
        responseStatus: 201,
        responsePayload: payload,
        webhookStatus: "local"
      });
      await storeCalendarIdempotentReplay({
        orgId,
        key: idempotencyKey,
        method: "POST",
        path: path2,
        status: 201,
        payload
      });
      return res.status(201).json(payload);
    } catch (error) {
      console.error("Native POST /api/v1/calendar/events failed:", error);
      return res.status(500).json({
        error: "Failed to save event",
        details: getCalendarAdminErrorMessage(error)
      });
    }
  });
  app.post("/api/v1/calendar/events/occurrence", async (req, res) => {
    if (!hasCalendarAdminAccess(req)) {
      return res.status(403).json({ message: "Not authorized" });
    }
    const orgId = getCalendarAdminOrgId();
    const path2 = "/api/v1/calendar/events/occurrence";
    const idempotencyKey = getCalendarIdempotencyKey(req);
    try {
      const replay = await getCalendarIdempotentReplay({
        orgId,
        key: idempotencyKey,
        method: "POST",
        path: path2
      });
      if (replay) {
        return res.status(replay.status).json(replay.payload);
      }
      const parsed = calendarOccurrenceCancelSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: parsed.error.flatten()
        });
      }
      const payload = await cancelNativeCalendarOccurrence({
        orgId,
        input: parsed.data
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
        requestPath: path2,
        httpMethod: "POST",
        responseStatus: 200,
        responsePayload: payload,
        webhookStatus: "local"
      });
      await storeCalendarIdempotentReplay({
        orgId,
        key: idempotencyKey,
        method: "POST",
        path: path2,
        status: 200,
        payload
      });
      return res.json(payload);
    } catch (error) {
      console.error("Native POST /api/v1/calendar/events/occurrence failed:", error);
      return res.status(500).json({
        error: "Failed to cancel occurrence",
        details: getCalendarAdminErrorMessage(error)
      });
    }
  });
  app.patch("/api/v1/calendar/events/occurrence", async (req, res) => {
    if (!hasCalendarAdminAccess(req)) {
      return res.status(403).json({ message: "Not authorized" });
    }
    const orgId = getCalendarAdminOrgId();
    const path2 = "/api/v1/calendar/events/occurrence";
    const idempotencyKey = getCalendarIdempotencyKey(req);
    try {
      const replay = await getCalendarIdempotentReplay({
        orgId,
        key: idempotencyKey,
        method: "PATCH",
        path: path2
      });
      if (replay) {
        return res.status(replay.status).json(replay.payload);
      }
      const parsed = calendarOccurrenceMoveSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: parsed.error.flatten()
        });
      }
      const payload = await moveNativeCalendarOccurrence({
        orgId,
        input: parsed.data
      });
      if (!payload) {
        return res.status(404).json({ error: "Event series not found" });
      }
      const movedOccurrence = "occurrence" in payload ? payload.occurrence : null;
      const movedEntityId = movedOccurrence ? movedOccurrence.id : "eventSeries" in payload ? payload.eventSeries?.id ?? null : null;
      await appendCalendarAuditLog({
        orgId,
        eventType: "calendar.event.occurrence.updated",
        entityType: movedOccurrence ? "calendar_events" : "calendar_event_series",
        entityId: movedEntityId,
        payload,
        idempotencyKey,
        requestPath: path2,
        httpMethod: "PATCH",
        responseStatus: 200,
        responsePayload: payload,
        webhookStatus: "local"
      });
      await storeCalendarIdempotentReplay({
        orgId,
        key: idempotencyKey,
        method: "PATCH",
        path: path2,
        status: 200,
        payload
      });
      return res.json(payload);
    } catch (error) {
      console.error("Native PATCH /api/v1/calendar/events/occurrence failed:", error);
      return res.status(500).json({
        error: "Failed to move occurrence",
        details: getCalendarAdminErrorMessage(error)
      });
    }
  });
  app.put("/api/v1/calendar/events/:id", async (req, res) => {
    if (!hasCalendarAdminAccess(req)) {
      return res.status(403).json({ message: "Not authorized" });
    }
    const orgId = getCalendarAdminOrgId();
    const idempotencyKey = getCalendarIdempotencyKey(req);
    const path2 = getCalendarRequestPath(req);
    try {
      const replay = await getCalendarIdempotentReplay({
        orgId,
        key: idempotencyKey,
        method: "PUT",
        path: path2
      });
      if (replay) {
        return res.status(replay.status).json(replay.payload);
      }
      const parsed = calendarEventInputSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: parsed.error.flatten()
        });
      }
      const payload = await updateNativeCalendarSeries({
        id: req.params.id,
        orgId,
        input: parsed.data
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
        requestPath: path2,
        httpMethod: "PUT",
        responseStatus: 200,
        responsePayload: payload,
        webhookStatus: "local"
      });
      await storeCalendarIdempotentReplay({
        orgId,
        key: idempotencyKey,
        method: "PUT",
        path: path2,
        status: 200,
        payload
      });
      return res.json(payload);
    } catch (error) {
      console.error("Native PUT /api/v1/calendar/events/:id failed:", error);
      return res.status(500).json({
        error: "Failed to update event",
        details: getCalendarAdminErrorMessage(error)
      });
    }
  });
  app.delete("/api/v1/calendar/events/:id", async (req, res) => {
    if (!hasCalendarAdminAccess(req)) {
      return res.status(403).json({ message: "Not authorized" });
    }
    const orgId = getCalendarAdminOrgId();
    const idempotencyKey = getCalendarIdempotencyKey(req);
    const path2 = getCalendarRequestPath(req);
    try {
      const replay = await getCalendarIdempotentReplay({
        orgId,
        key: idempotencyKey,
        method: "DELETE",
        path: path2
      });
      if (replay) {
        return res.status(replay.status).json(replay.payload);
      }
      const payload = await deleteNativeCalendarSeries({
        id: req.params.id,
        orgId
      });
      await appendCalendarAuditLog({
        orgId,
        eventType: "calendar.event.deleted",
        entityType: "calendar_event_series",
        entityId: req.params.id,
        payload,
        idempotencyKey,
        requestPath: path2,
        httpMethod: "DELETE",
        responseStatus: 200,
        responsePayload: payload,
        webhookStatus: "local"
      });
      await storeCalendarIdempotentReplay({
        orgId,
        key: idempotencyKey,
        method: "DELETE",
        path: path2,
        status: 200,
        payload
      });
      return res.json(payload);
    } catch (error) {
      console.error("Native DELETE /api/v1/calendar/events/:id failed:", error);
      return res.status(500).json({
        error: "Failed to delete event",
        details: getCalendarAdminErrorMessage(error)
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
        getCalendarNativeError(error)
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
    const parsed = z3.object({
      mode: z3.enum(["merge", "replace"]).optional(),
      sourceBaseUrl: z3.string().trim().min(1).optional(),
      sourceOrgId: z3.string().trim().min(1).optional()
    }).safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        message: "Invalid transfer payload",
        errors: fromZodError(parsed.error)
      });
    }
    try {
      const result = await transferCalendarDataFromSource({
        mode: parsed.data.mode,
        sourceBaseUrl: parsed.data.sourceBaseUrl,
        sourceOrgId: parsed.data.sourceOrgId
      });
      return res.json({
        success: true,
        ...result,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      console.error("Admin calendar transfer failed:", error);
      return res.status(500).json({
        success: false,
        message: "Calendar transfer failed",
        details: error instanceof Error ? error.message : "Unknown transfer error"
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
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      console.error("Calendar transfer cron failed:", error);
      return res.status(500).json({
        success: false,
        message: "Calendar transfer cron failed",
        details: error instanceof Error ? error.message : "Unknown transfer error"
      });
    }
  });
  app.post("/api/subscribe", async (req, res) => {
    try {
      const parsed = publicSubscriberSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid subscription data",
          errors: fromZodError(parsed.error)
        });
      }
      const payload = parsed.data;
      const subscribed = await addSubscriber(payload.email, payload.firstName, payload.lastName, {
        phone: payload.phone,
        groupId: process.env.MAILERLITE_SUPPORTERS_GROUP_ID,
        groupName: "Supporters"
      });
      if (!subscribed) {
        return res.status(503).json({
          message: "Unable to subscribe right now. Please try again in a moment."
        });
      }
      res.set("Cache-Control", "no-store");
      return res.json({
        message: "You're subscribed to new needs updates."
      });
    } catch (error) {
      console.error("Error subscribing supporter:", error);
      return res.status(500).json({ message: "Failed to subscribe" });
    }
  });
  app.get("/api/admin/users", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const { users: users2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const allUsers = await db2.select().from(users2);
      const sanitizedUsers = allUsers.map(({ password, ...user }) => user);
      res.json(sanitizedUsers);
    } catch (error) {
      console.error("Error fetching admin users:", error);
      res.status(500).json({ message: "Failed to retrieve users" });
    }
  });
  app.post("/api/admin/assistant", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const query = typeof req.body?.query === "string" ? req.body.query.trim() : "";
      if (!query) {
        return res.status(400).json({ message: "Missing query" });
      }
      let categoryNames = [];
      try {
        const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
        const rows = await db2.select().from(categories);
        categoryNames = rows.map((row) => row.name).filter((name) => Boolean(name));
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
      const existingUser = await storage.getUserByUsername(result.data.username);
      if (existingUser) {
        return res.status(400).json({ message: "Email already in use" });
      }
      const newAdminData = { ...result.data, isAdmin: true };
      const hashedPassword = await Promise.resolve().then(() => (init_auth(), auth_exports)).then((auth) => auth.hashPassword(newAdminData.password));
      newAdminData.password = hashedPassword;
      const user = await storage.createUser(newAdminData);
      const { password, ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (error) {
      console.error("Error creating admin user:", error);
      res.status(500).json({ message: "Failed to create admin user" });
    }
  });
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
          errors: fromZodError(parsed.error)
        });
      }
      const targetUser = await storage.getUser(id);
      if (!targetUser || !targetUser.isAdmin) {
        return res.status(404).json({ message: "Admin user not found" });
      }
      const sameCanonicalUsers = await storage.getUsersByCanonicalUsername(targetUser.username);
      const targetUserIds = sameCanonicalUsers.map((user) => user.id);
      const hashedPassword = await Promise.resolve().then(() => (init_auth(), auth_exports)).then(
        (auth) => auth.hashPassword(parsed.data.newPassword)
      );
      const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const { users: users2, authEvents: authEvents2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      await db2.update(users2).set({
        password: hashedPassword,
        failedLoginAttempts: 0,
        lockedUntil: null,
        passwordUpdatedAt: /* @__PURE__ */ new Date()
      }).where(inArray2(users2.id, targetUserIds));
      const ip = req.headers["x-forwarded-for"] || req.ip || null;
      const userAgent = req.headers["user-agent"] || null;
      await db2.insert(authEvents2).values({
        userId: targetUser.id,
        usernameAttempt: targetUser.username,
        eventType: "PASSWORD_RESET_ADMIN",
        ip: typeof ip === "string" ? ip : Array.isArray(ip) ? ip[0] : null,
        userAgent: typeof userAgent === "string" ? userAgent : null,
        metadata: JSON.stringify({
          actorUserId: req.user.id,
          notifyUser: parsed.data.notifyUser ?? true,
          updatedUserIds: targetUserIds
        })
      });
      let notificationSent = false;
      if (parsed.data.notifyUser ?? true) {
        notificationSent = await sendEmail({
          to: targetUser.username,
          from: process.env.DEFAULT_FROM_EMAIL?.trim() || "communications@vfwharrisonoh.org",
          subject: "Your admin password was reset",
          text: `An administrator reset your password for VFW Post 7570.

Temporary password: ${parsed.data.newPassword}

Please sign in and update it after logging in.`,
          html: `
            <p>An administrator reset your password for VFW Post 7570.</p>
            <p><strong>Temporary password:</strong> ${parsed.data.newPassword}</p>
            <p>Please sign in and update it after logging in.</p>
          `
        });
      }
      res.set("Cache-Control", "private, no-store");
      return res.json({
        message: "Password reset successfully",
        notificationSent
      });
    } catch (error) {
      console.error("Error resetting admin password:", error);
      return res.status(500).json({ message: "Failed to reset password" });
    }
  });
  app.post("/api/admin/users/normalize-usernames", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const { users: users2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const allUsers = await db2.select({ id: users2.id, username: users2.username }).from(users2);
      const grouped = /* @__PURE__ */ new Map();
      for (const user of allUsers) {
        const normalized = user.username.trim().toLowerCase();
        const group = grouped.get(normalized) || [];
        group.push(user);
        grouped.set(normalized, group);
      }
      const collisions = Array.from(grouped.entries()).filter(([, group]) => group.length > 1).map(([normalized, group]) => ({
        normalized,
        users: group
      }));
      if (collisions.length > 0) {
        return res.status(409).json({
          message: "Username collisions detected. Resolve duplicates manually first.",
          collisions
        });
      }
      let updatedCount = 0;
      const changes = [];
      for (const user of allUsers) {
        const normalized = user.username.trim().toLowerCase();
        if (normalized !== user.username) {
          await db2.update(users2).set({ username: normalized }).where(eq5(users2.id, user.id));
          updatedCount += 1;
          changes.push({ id: user.id, from: user.username, to: normalized });
        }
      }
      res.set("Cache-Control", "private, no-store");
      return res.json({
        message: "Usernames normalized",
        updatedCount,
        changes
      });
    } catch (error) {
      console.error("Error normalizing usernames:", error);
      return res.status(500).json({ message: "Failed to normalize usernames" });
    }
  });
  app.get("/api/admin/notification-preferences", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const { adminNotificationPreferences: adminNotificationPreferences2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const rows = await db2.select({
        receiveAllNotifications: adminNotificationPreferences2.receiveAllNotifications,
        enabledCategories: adminNotificationPreferences2.enabledCategories
      }).from(adminNotificationPreferences2).where(eq5(adminNotificationPreferences2.userId, req.user.id)).limit(1);
      const preference = rows[0];
      return res.json({
        receiveAllNotifications: preference?.receiveAllNotifications ?? true,
        enabledCategories: parseEnabledCategories(preference?.enabledCategories)
      });
    } catch (error) {
      console.error("Error reading notification preferences:", error);
      return res.status(500).json({ message: "Failed to read notification preferences" });
    }
  });
  app.put("/api/admin/notification-preferences", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const parsed = notificationPreferencesSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid notification preferences",
          errors: fromZodError(parsed.error)
        });
      }
      const enabledCategories = Array.from(
        new Set(
          parsed.data.enabledCategories.map((slug) => slug.trim().toUpperCase()).filter((slug) => slug.length > 0)
        )
      );
      const payload = {
        userId: req.user.id,
        receiveAllNotifications: parsed.data.receiveAllNotifications,
        enabledCategories: JSON.stringify(enabledCategories),
        updatedAt: /* @__PURE__ */ new Date()
      };
      const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const { adminNotificationPreferences: adminNotificationPreferences2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      await db2.insert(adminNotificationPreferences2).values(payload).onConflictDoUpdate({
        target: adminNotificationPreferences2.userId,
        set: {
          receiveAllNotifications: payload.receiveAllNotifications,
          enabledCategories: payload.enabledCategories,
          updatedAt: payload.updatedAt
        }
      });
      return res.json({
        receiveAllNotifications: payload.receiveAllNotifications,
        enabledCategories
      });
    } catch (error) {
      console.error("Error updating notification preferences:", error);
      return res.status(500).json({ message: "Failed to update notification preferences" });
    }
  });
  app.get("/api/categories", async (req, res) => {
    try {
      const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const allCategories = await db2.select().from(categories).orderBy(asc3(categories.displayOrder));
      if (allCategories.length === 0) {
        const defaults = [
          { name: "Food", slug: "FOOD", icon: "ShoppingCart", displayOrder: 0, isEvent: false },
          { name: "Clothing", slug: "CLOTHING", icon: "Shirt", displayOrder: 1, isEvent: false },
          { name: "Service", slug: "SERVICE", icon: "Users", displayOrder: 2, isEvent: false },
          { name: "Education", slug: "EDUCATION", icon: "BookOpen", displayOrder: 3, isEvent: false },
          { name: "Housing", slug: "HOUSING", icon: "Home", displayOrder: 4, isEvent: false },
          { name: "Events", slug: "EVENT", icon: "Calendar", displayOrder: 5, isEvent: true },
          { name: "Other", slug: "OTHER", icon: "Heart", displayOrder: 6, isEvent: false }
        ];
        const inserted = await db2.insert(categories).values(defaults).returning();
        res.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
        return res.json(inserted);
      }
      res.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
      res.json(allCategories);
    } catch (error) {
      console.error("Error getting categories:", error);
      res.status(500).json({ message: "Failed to retrieve categories" });
    }
  });
  app.post("/api/categories", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const result = insertCategorySchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid data", errors: fromZodError(result.error) });
      }
      const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const [created] = await db2.insert(categories).values(result.data).returning();
      res.status(201).json(created);
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(500).json({ message: "Failed to create category" });
    }
  });
  app.put("/api/categories/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const id = parseInt(req.params.id);
      const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const [updated] = await db2.update(categories).set({ name: req.body.name, slug: req.body.slug, icon: req.body.icon, isEvent: req.body.isEvent ?? false }).where(eq5(categories.id, id)).returning();
      if (!updated) return res.status(404).json({ message: "Category not found" });
      res.json(updated);
    } catch (error) {
      console.error("Error updating category:", error);
      res.status(500).json({ message: "Failed to update category" });
    }
  });
  app.delete("/api/categories/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const id = parseInt(req.params.id);
      const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const [deleted] = await db2.delete(categories).where(eq5(categories.id, id)).returning();
      if (!deleted) return res.status(404).json({ message: "Category not found" });
      res.json({ message: "Category deleted" });
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ message: "Failed to delete category" });
    }
  });
  app.post("/api/categories/reorder", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const { order } = req.body;
      if (!Array.isArray(order)) {
        return res.status(400).json({ message: "Invalid order data" });
      }
      const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      for (const item of order) {
        await db2.update(categories).set({ displayOrder: item.displayOrder }).where(eq5(categories.id, item.id));
      }
      const updated = await db2.select().from(categories).orderBy(asc3(categories.displayOrder));
      res.json(updated);
    } catch (error) {
      console.error("Error reordering categories:", error);
      res.status(500).json({ message: "Failed to reorder categories" });
    }
  });
  app.post("/api/needs/reorder", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const { order } = req.body;
      if (!Array.isArray(order)) {
        return res.status(400).json({ message: "Invalid order data" });
      }
      const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const { needs: needs2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      for (const item of order) {
        await db2.update(needs2).set({ displayOrder: item.displayOrder }).where(eq5(needs2.id, item.id));
      }
      res.json({ message: "Order updated" });
    } catch (error) {
      console.error("Error reordering needs:", error);
      res.status(500).json({ message: "Failed to reorder needs" });
    }
  });
  app.get("/api/needs", async (req, res) => {
    try {
      await storage.markExpiredFloatingNeedsUnfulfilled();
      await storage.markExpiredEventNeedsFulfilled();
      const allNeeds = await storage.getAllNeeds();
      const isAdminRequest = req.isAuthenticated() && req.user?.isAdmin;
      const visibleNeeds = isAdminRequest ? allNeeds : allNeeds.filter((need) => !isNeedHiddenFromPublic(need));
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
      if (!isAdminRequest && (need.status === "DRAFT" /* DRAFT */ || need.status === "UNFULFILLED" /* UNFULFILLED */)) {
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
      if (!isAdminRequest && (need.status === "DRAFT" /* DRAFT */ || need.status === "UNFULFILLED" /* UNFULFILLED */)) {
        return res.status(404).json({ message: "Need not found" });
      }
      const roles = await storage.getEventRolesWithStatsByNeedId(id, Boolean(isAdminRequest));
      const visibleRoles = isAdminRequest ? roles : roles.filter((role) => !isEventRoleHiddenFromPublic(need, role));
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
      if (!isAdminRequest && (need.status === "DRAFT" /* DRAFT */ || need.status === "UNFULFILLED" /* UNFULFILLED */)) {
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
  app.post("/api/needs", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }
      console.log("POST /api/needs - Request Body:", JSON.stringify({
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
      const status = req.body.status ? req.body.status : void 0;
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
  app.patch("/api/needs/:id/highlight", async (req, res) => {
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
      const isHighlighted = !existingNeed.isHighlighted;
      const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const { needs: needs2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const [updatedNeed] = await db2.update(needs2).set({ isHighlighted }).where(eq5(needs2.id, id)).returning();
      if (!updatedNeed) {
        return res.status(500).json({ message: "Failed to update need highlighted status" });
      }
      res.json(updatedNeed);
    } catch (error) {
      console.error("Error toggling need highlight status:", error);
      res.status(500).json({ message: "Failed to update need highlighted status" });
    }
  });
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
      const existingNeed = await storage.getNeed(id);
      if (!existingNeed) {
        return res.status(404).json({ message: "Need not found" });
      }
      const updatedNeed = await storage.updateNeedStatus(id, status);
      if (!updatedNeed) {
        return res.status(404).json({ message: "Failed to update need status" });
      }
      try {
        await enqueueCalendarSyncForNeedTransition(existingNeed, updatedNeed);
      } catch (syncError) {
        console.error("Failed to enqueue calendar sync after status update:", syncError);
      }
      if (existingNeed.status === "FLOATING" /* FLOATING */ && status === "PLEDGED" /* PLEDGED */) {
        try {
          const pledges2 = await storage.getPledgesByNeedId(id);
          if (pledges2.length > 0) {
            const latestPledge = pledges2.sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )[0];
            const adminEmails = await getAdminsForNotification(updatedNeed);
            if (adminEmails.length > 0) {
              await sendPledgeNotification(updatedNeed, latestPledge, adminEmails);
              console.log(`Sent pledge notification emails to ${adminEmails.length} admin(s)`);
            }
          }
        } catch (emailError) {
          console.error("Error sending notification email:", emailError);
        }
      }
      res.json(updatedNeed);
    } catch (error) {
      console.error("Error updating need status:", error);
      res.status(500).json({ message: "Failed to update need status" });
    }
  });
  app.put("/api/needs/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const withTimeout = async (promise, ms, label) => {
        let timer;
        try {
          return await Promise.race([
            promise,
            new Promise((_, reject) => {
              timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
            })
          ]);
        } finally {
          if (timer) clearTimeout(timer);
        }
      };
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid need ID" });
      }
      const existingNeed = await withTimeout(storage.getNeed(id), 12e3, "Load need");
      if (!existingNeed) {
        return res.status(404).json({ message: "Need not found" });
      }
      console.log("PUT /api/needs/:id - Request Body:", JSON.stringify({
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
      const status = req.body.status ? req.body.status : existingNeed.status;
      const normalizedPayload = normalizeNeedMutationPayload(result.data);
      const updatedNeed = await withTimeout(
        storage.updateNeed(id, { ...normalizedPayload, status }),
        15e3,
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
      if (need.needType !== "EVENT" /* EVENT */ && result.data.donationType === "signup") {
        return res.status(400).json({ message: "Sign-up pledges are only valid for event needs." });
      }
      const allowsAdditionalGroupSignup = need.needType === "GROUP" /* GROUP */ && need.status === "PLEDGED" /* PLEDGED */;
      if (need.needType === "EVENT" /* EVENT */ && isEventHiddenFromPublic(need)) {
        return res.status(400).json({ message: "This event has ended and is no longer accepting sign-ups." });
      }
      if (!allowsAdditionalGroupSignup && need.status !== "FLOATING" /* FLOATING */ && need.status !== "RECURRING" /* RECURRING */) {
        return res.status(400).json({ message: "This need has already been pledged or fulfilled" });
      }
      const pledgePayload = need.needType === "EVENT" /* EVENT */ ? { ...result.data, donationType: "signup" } : result.data;
      const pledge = await storage.createPledge(pledgePayload);
      const responseData = { ...pledge };
      try {
        await sendPledgeConfirmation(need, pledge);
        console.log(`Confirmation email sent to donor: ${pledge.email}`);
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
            console.error("Error subscribing to MailerLite:", subscribeError);
          }
        }
        if (need.status === "FLOATING" /* FLOATING */ && need.needType !== "GROUP" /* GROUP */ && need.needType !== "EVENT" /* EVENT */) {
          const updatedNeed = await storage.updateNeedStatus(need.id, "PLEDGED" /* PLEDGED */);
          if (updatedNeed) {
            const adminEmails = await getAdminsForNotification(updatedNeed);
            if (adminEmails.length > 0) {
              await sendPledgeNotification(updatedNeed, pledge, adminEmails);
              console.log(`Pledge created, need status updated, and notification sent to ${adminEmails.length} admin(s)`);
            }
          }
        } else if (need.status === "RECURRING" /* RECURRING */ || need.needType === "GROUP" /* GROUP */ || need.needType === "EVENT" /* EVENT */) {
          const currentNeed = need.needType === "GROUP" /* GROUP */ || need.needType === "EVENT" /* EVENT */ ? await storage.getNeed(need.id) || need : need;
          const adminEmails = await getAdminsForNotification(currentNeed);
          if (adminEmails.length > 0) {
            await sendPledgeNotification(currentNeed, pledge, adminEmails);
            const label = need.needType === "GROUP" /* GROUP */ ? "Group" : need.needType === "EVENT" /* EVENT */ ? "Event" : "Recurring";
            console.log(`${label} need pledge created and notification sent to ${adminEmails.length} admin(s)`);
          }
        }
      } catch (error) {
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
  app.get("/api/needs/:id/pledges", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid need ID" });
      }
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      const pledges2 = await storage.getPledgesByNeedId(id);
      const selectionsByPledgeId = await storage.getEventRoleSelectionsByPledgeIds(
        pledges2.map((pledge) => pledge.id)
      );
      const pledgesWithSelections = pledges2.map((pledge) => ({
        ...pledge,
        selectedEventRoles: selectionsByPledgeId.get(pledge.id) || []
      }));
      console.log(`Fetched ${pledgesWithSelections.length} pledges for need ID ${id}`);
      res.json(pledgesWithSelections);
    } catch (error) {
      console.error("Error getting pledges:", error);
      res.status(500).json({ message: "Failed to retrieve pledges" });
    }
  });
  app.get("/api/all-pledges", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const { pledges: pledges2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const allPledges = await db2.select().from(pledges2);
      const selectionsByPledgeId = await storage.getEventRoleSelectionsByPledgeIds(
        allPledges.map((pledge) => pledge.id)
      );
      const allPledgesWithSelections = allPledges.map((pledge) => ({
        ...pledge,
        selectedEventRoles: selectionsByPledgeId.get(pledge.id) || []
      }));
      const pledgesByNeedId = {};
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
          message: "This sign-up link is no longer valid. It may have expired."
        });
      }
      const pledge = await storage.getPledge(pledgeId);
      if (!pledge) {
        return res.status(200).json({
          valid: false,
          message: "The sign-up record could not be found."
        });
      }
      const need = await storage.getNeed(pledge.needId);
      if (!need || need.needType !== "EVENT" /* EVENT */) {
        return res.status(200).json({
          valid: false,
          message: "This sign-up can only be managed for event needs."
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
          selectedEventRoles
        },
        need: {
          id: need.id,
          title: need.title,
          eventDate: need.eventDate,
          eventLocation: need.eventLocation,
          status: need.status
        },
        availableRoles
      });
    } catch (error) {
      console.error("Error loading event sign-up management payload:", error);
      return res.status(500).json({
        valid: false,
        message: "An error occurred while loading your sign-up details."
      });
    }
  });
  app.post("/api/event-signup/manage/update", async (req, res) => {
    try {
      const parsed = eventSignupManageUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid sign-up data",
          errors: fromZodError(parsed.error)
        });
      }
      const { token, ...updates } = parsed.data;
      const { needId: pledgeId, action, valid } = verifySecureToken(token);
      if (!valid || action !== "manage_signup") {
        return res.status(400).json({
          message: "Invalid or expired sign-up link. Please use the latest email link."
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
        need: updatedNeed ? {
          id: updatedNeed.id,
          title: updatedNeed.title,
          status: updatedNeed.status
        } : null
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
          errors: fromZodError(parsed.error)
        });
      }
      const { token } = parsed.data;
      const { needId: pledgeId, action, valid } = verifySecureToken(token);
      if (!valid || action !== "manage_signup") {
        return res.status(400).json({
          message: "Invalid or expired sign-up link. Please use the latest email link."
        });
      }
      const existingPledge = await storage.getPledge(pledgeId);
      let canceledPledgeForEmail = null;
      let needForEmail = existingPledge ? await storage.getNeed(existingPledge.needId) : void 0;
      if (existingPledge) {
        const selectedByPledge = await storage.getEventRoleSelectionsByPledgeIds([existingPledge.id]);
        canceledPledgeForEmail = {
          ...existingPledge,
          selectedEventRoles: selectedByPledge.get(existingPledge.id) || []
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
          status: updatedNeed.status
        }
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
          errors: fromZodError(parsed.error)
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
        need: updatedNeed ? {
          id: updatedNeed.id,
          title: updatedNeed.title,
          status: updatedNeed.status
        } : null
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
      let canceledPledgeForEmail = null;
      let needForEmail = existingPledge ? await storage.getNeed(existingPledge.needId) : void 0;
      if (existingPledge) {
        const selectedByPledge = await storage.getEventRoleSelectionsByPledgeIds([existingPledge.id]);
        canceledPledgeForEmail = {
          ...existingPledge,
          selectedEventRoles: selectedByPledge.get(existingPledge.id) || []
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
          status: updatedNeed.status
        }
      });
    } catch (error) {
      if (error instanceof EventSlotConflictError || error instanceof EventSignupValidationError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      console.error("Error removing admin event sign-up:", error);
      return res.status(500).json({ message: "Failed to remove sign-up." });
    }
  });
  app.get("/api/verify-token/:token", async (req, res) => {
    try {
      const { token } = req.params;
      if (!token) {
        return res.status(400).json({ valid: false, message: "No token provided" });
      }
      const { needId, action, valid } = verifySecureToken(token);
      if (!valid) {
        return res.status(200).json({
          valid: false,
          message: "This link is no longer valid. It may have expired or already been used."
        });
      }
      const need = await storage.getNeed(needId);
      if (!need) {
        return res.status(200).json({
          valid: false,
          message: "The requested need could not be found in our system."
        });
      }
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
  app.post("/api/fulfill-need", async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ success: false, message: "No token provided" });
      }
      const { needId, action, valid } = verifySecureToken(token);
      if (!valid) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired token. Please request a new one."
        });
      }
      if (action === "fulfill" && needId > 0) {
        const need = await storage.getNeed(needId);
        if (!need) {
          return res.status(404).json({
            success: false,
            message: "Need not found"
          });
        }
        const canFulfillFromEmail = need.status === "PLEDGED" /* PLEDGED */ || need.status === "RECURRING" /* RECURRING */ || need.needType === "GROUP" /* GROUP */ && need.status === "FLOATING" /* FLOATING */;
        if (!canFulfillFromEmail) {
          return res.status(400).json({
            success: false,
            message: `This need cannot be fulfilled because it is in ${need.status} state.`
          });
        }
        const updatedNeed = await storage.updateNeedStatus(needId, "FULFILLED" /* FULFILLED */);
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
  app.post("/api/needs/:id/duplicate", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid need ID" });
      }
      const originalNeed = await storage.getNeed(id);
      if (!originalNeed) {
        return res.status(404).json({ message: "Need not found" });
      }
      const originalEventRoles = originalNeed.needType === "EVENT" /* EVENT */ ? await storage.getEventRolesByNeedId(originalNeed.id, true) : [];
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
          isActive: role.isActive
        }))
      }, "DRAFT" /* DRAFT */);
      res.status(201).json(newNeed);
    } catch (error) {
      console.error("Error duplicating need:", error);
      res.status(500).json({ message: "Failed to duplicate need" });
    }
  });
  app.post("/api/upload/image", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }
      if (!req.body || !req.body.image) {
        return res.status(400).json({ message: "No image data provided" });
      }
      const imageData = req.body.image;
      const matches = imageData.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return res.status(400).json({ message: "Invalid image data format" });
      }
      const fileType = matches[1];
      const base64Data = matches[2];
      const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      if (!allowedTypes.includes(fileType)) {
        return res.status(400).json({
          message: "Invalid file type. Allowed types: JPEG, PNG, GIF, WebP"
        });
      }
      const byteLength = Buffer.byteLength(base64Data, "base64");
      if (byteLength > 5 * 1024 * 1024) {
        return res.status(400).json({ message: "Image must be smaller than 5MB" });
      }
      res.status(201).json({ url: imageData });
    } catch (error) {
      console.error("Error uploading image:", error);
      res.status(500).json({ message: "Failed to upload image" });
    }
  });
  app.get("/api/stats", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        res.set("Cache-Control", "private, no-store");
        return res.status(403).json({ message: "Not authorized" });
      }
      res.set("Cache-Control", "private, no-store");
      if (statsCache && Date.now() - statsCache.timestamp < STATS_CACHE_TTL) {
        return res.json(statsCache.data);
      }
      const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const { pledges: pledges2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const withTimeout = async (promise, ms, label) => {
        let timer;
        try {
          return await Promise.race([
            promise,
            new Promise((_, reject) => {
              timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
            })
          ]);
        } finally {
          if (timer) clearTimeout(timer);
        }
      };
      const allNeeds = await withTimeout(storage.getAllNeeds(), 12e3, "Needs query");
      const allPledges = await withTimeout(db2.select().from(pledges2), 12e3, "Pledges query");
      const published = allNeeds.filter((n) => n.status !== "DRAFT" /* DRAFT */ && n.status !== "UNFULFILLED" /* UNFULFILLED */);
      const totalProjects = published.length;
      const openNeeds = published.filter((n) => n.status === "FLOATING" /* FLOATING */ || n.status === "RECURRING" /* RECURRING */).length;
      const pledgedNeeds = published.filter((n) => n.status === "PLEDGED" /* PLEDGED */).length;
      const fulfilledNeeds = published.filter((n) => n.status === "FULFILLED" /* FULFILLED */).length;
      const unfulfilledNeeds = allNeeds.filter((n) => n.status === "UNFULFILLED" /* UNFULFILLED */).length;
      const recurringNeeds = published.filter((n) => n.status === "RECURRING" /* RECURRING */).length;
      const draftNeeds = allNeeds.filter((n) => n.status === "DRAFT" /* DRAFT */).length;
      const totalPledges = allPledges.length;
      const uniqueDonors = new Set(allPledges.map((p) => p.email.toLowerCase())).size;
      const widows = published.filter((n) => n.recipientIsWidow === true).length;
      const singleParents = published.filter((n) => n.recipientIsSingleParent === true).length;
      const govAssistance = {
        medicaid: published.filter((n) => n.recipientMedicaid === true).length,
        medicare: published.filter((n) => n.recipientMedicare === true).length,
        socialSecurity: published.filter((n) => n.recipientSocialSecurity === true).length,
        snap: published.filter((n) => n.recipientSnap === true).length,
        disability: published.filter((n) => n.recipientDisability === true).length
      };
      const ageRanges = { under18: 0, "18-34": 0, "35-54": 0, "55-64": 0, "65plus": 0, unknown: 0 };
      const now = /* @__PURE__ */ new Date();
      for (const n of published) {
        if (n.recipientDob) {
          const dob = new Date(n.recipientDob);
          const age = Math.floor((now.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1e3));
          if (age < 18) ageRanges.under18++;
          else if (age < 35) ageRanges["18-34"]++;
          else if (age < 55) ageRanges["35-54"]++;
          else if (age < 65) ageRanges["55-64"]++;
          else ageRanges["65plus"]++;
        } else {
          ageRanges.unknown++;
        }
      }
      const categoryMap = {};
      for (const n of published) {
        categoryMap[n.category] = (categoryMap[n.category] || 0) + 1;
      }
      const needsByCategory = Object.entries(categoryMap).map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);
      const needTitleMap = new Map(allNeeds.map((n) => [n.id, n.title]));
      const recentPledges = allPledges.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5).map((p) => ({
        id: p.id,
        name: `${p.firstName} ${p.lastName}`,
        needTitle: needTitleMap.get(p.needId) || "Unknown",
        needId: p.needId,
        donationType: p.donationType,
        date: p.createdAt
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
          ageRanges
        },
        needsByCategory,
        recentPledges
      };
      statsCache = { data: result, timestamp: Date.now() };
      res.json(result);
    } catch (error) {
      console.error("Error getting stats:", error);
      res.status(500).json({ message: "Failed to retrieve stats" });
    }
  });
  app.get("/api/email/status", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const apiKey = process.env.MAILERLITE_API_KEY;
      const mailerliteGroupId = process.env.MAILERLITE_SUPPORTERS_GROUP_ID;
      const mailersendToken = process.env.MAILERSEND_API_TOKEN || process.env.MAILERSEND_API_KEY;
      let mailerliteConnected = false;
      let subscriberCount = 0;
      let groupName = "";
      if (apiKey && mailerliteGroupId) {
        try {
          const groupRes = await fetch(`https://api.mailerlite.com/api/v2/groups/${mailerliteGroupId}`, {
            headers: { "X-MailerLite-ApiKey": apiKey, "Content-Type": "application/json" }
          });
          if (groupRes.ok) {
            const groupData = await groupRes.json();
            mailerliteConnected = true;
            subscriberCount = groupData.active_count || groupData.total || 0;
            groupName = groupData.name || "";
          }
        } catch (e) {
          console.error("MailerLite status check failed:", e);
        }
      }
      let lastCampaign = null;
      if (apiKey && mailerliteConnected) {
        try {
          const campRes = await fetch("https://api.mailerlite.com/api/v2/campaigns/sent?limit=1", {
            headers: { "X-MailerLite-ApiKey": apiKey, "Content-Type": "application/json" }
          });
          if (campRes.ok) {
            const campaigns = await campRes.json();
            if (campaigns && campaigns.length > 0) {
              const c = campaigns[0];
              lastCampaign = {
                subject: c.subject || "",
                sentAt: c.date_send || c.created_at || "",
                opens: c.opened?.count || 0,
                clicks: c.clicked?.count || 0
              };
            }
          }
        } catch (e) {
          console.error("MailerLite campaigns check failed:", e);
        }
      }
      res.json({
        mailerlite: {
          connected: mailerliteConnected,
          apiKeySet: !!apiKey,
          subscriberCount,
          groupName,
          lastCampaign
        },
        mailersend: {
          connected: !!mailersendToken
        }
      });
    } catch (error) {
      console.error("Error getting email status:", error);
      res.status(500).json({ message: "Failed to retrieve email status" });
    }
  });
  app.post("/api/contact", async (req, res) => {
    try {
      const contactSchema = z3.object({
        name: z3.string().min(2, "Name is required"),
        email: z3.string().email("Valid email is required"),
        subject: z3.string().min(2, "Subject is required"),
        message: z3.string().min(10, "Message must be at least 10 characters")
      });
      const result = contactSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          message: "Invalid contact form data",
          errors: fromZodError(result.error)
        });
      }
      const { sendContactMessage: sendContactMessage2 } = await Promise.resolve().then(() => (init_contact(), contact_exports));
      const success = await sendContactMessage2(result.data);
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

// server/app.ts
init_timezone();
function log(message, source = "express") {
  const formattedTime = formatTimeInNewYork(/* @__PURE__ */ new Date(), {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
function summarizeResponseForLog(body) {
  if (body === void 0) return null;
  if (body === null) return "null";
  if (typeof body === "string") return body.length > 120 ? `${body.slice(0, 120)}...` : body;
  if (typeof body === "number" || typeof body === "boolean") return String(body);
  if (Array.isArray(body)) return `[array length=${body.length}]`;
  if (typeof body === "object") {
    const objectBody = body;
    const keys = Object.keys(objectBody);
    const preview = keys.slice(0, 6).join(",");
    const suffix = keys.length > 6 ? ",..." : "";
    return `{keys:${preview}${suffix}}`;
  }
  return null;
}
async function createApp(options) {
  const app = express2();
  app.use(express2.json({ limit: "7mb" }));
  app.use(express2.urlencoded({ extended: false, limit: "7mb" }));
  app.use((req, res, next) => {
    const start = Date.now();
    const path2 = req.path;
    let capturedJsonResponse;
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path2.startsWith("/api")) {
        let logLine = `${req.method} ${path2} ${res.statusCode} in ${duration}ms`;
        const responseSummary = summarizeResponseForLog(capturedJsonResponse);
        if (responseSummary) {
          logLine += ` :: ${responseSummary}`;
        }
        if (logLine.length > 200) {
          logLine = `${logLine.slice(0, 199)}...`;
        }
        log(logLine);
      }
    });
    next();
  });
  await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
  });
  const server = createServer(app);
  if (options.enableVite || options.serveBuiltClient) {
    const { setupVite, serveStatic } = await import("./vite");
    if (options.enableVite) {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }
  }
  return { app, server };
}

// server/api-handler.ts
var appPromise = createApp({
  enableVite: false,
  serveBuiltClient: false
});
async function handler(req, res) {
  const { app } = await appPromise;
  return app(req, res);
}
export {
  handler as default
};
