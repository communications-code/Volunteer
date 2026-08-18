import { pgTable, text, serial, date, timestamp, boolean, integer, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Define the user schema for authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until"),
  lastLoginAt: timestamp("last_login_at"),
  passwordUpdatedAt: timestamp("password_updated_at"),
});

export const usersRelations = relations(users, ({ many }) => ({
  needs: many(needs),
}));

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  isAdmin: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Per-admin notification routing preferences.
export const adminNotificationPreferences = pgTable("admin_notification_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  receiveAllNotifications: boolean("receive_all_notifications").notNull().default(true),
  enabledCategories: text("enabled_categories").notNull().default("[]"), // JSON array string of category slugs
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAdminNotificationPreferencesSchema = createInsertSchema(
  adminNotificationPreferences,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAdminNotificationPreferences = z.infer<
  typeof insertAdminNotificationPreferencesSchema
>;
export type AdminNotificationPreferences = typeof adminNotificationPreferences.$inferSelect;

// Singleton email delivery controls for dashboard-level pause/resume.
export const emailDeliverySettings = pgTable("email_delivery_settings", {
  key: text("key").primaryKey(),
  emailsEnabled: boolean("emails_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertEmailDeliverySettingsSchema = createInsertSchema(emailDeliverySettings);

export type InsertEmailDeliverySettings = z.infer<typeof insertEmailDeliverySettingsSchema>;
export type EmailDeliverySettings = typeof emailDeliverySettings.$inferSelect;

// One-time admin magic-login tokens (hashed at rest).
export const adminMagicLoginTokens = pgTable("admin_magic_login_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdIp: text("created_ip"),
  createdUserAgent: text("created_user_agent"),
});

export const insertAdminMagicLoginTokenSchema = createInsertSchema(adminMagicLoginTokens).omit({
  id: true,
  createdAt: true,
});

export type InsertAdminMagicLoginToken = z.infer<typeof insertAdminMagicLoginTokenSchema>;
export type AdminMagicLoginToken = typeof adminMagicLoginTokens.$inferSelect;

// Lightweight auth audit event log.
export const authEvents = pgTable("auth_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  usernameAttempt: text("username_attempt"),
  eventType: text("event_type").notNull(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAuthEventSchema = createInsertSchema(authEvents).omit({
  id: true,
  createdAt: true,
});

export type InsertAuthEvent = z.infer<typeof insertAuthEventSchema>;
export type AuthEvent = typeof authEvents.$inferSelect;

// Define statuses for needs
export enum NeedStatus {
  DRAFT = "DRAFT",
  FLOATING = "FLOATING",
  PLEDGED = "PLEDGED",
  FULFILLED = "FULFILLED",
  UNFULFILLED = "UNFULFILLED",
  RECURRING = "RECURRING",
}

// Legacy enum — kept for backward compatibility; frontend now uses dynamic categories from DB
export enum NeedCategory {
  FOOD = "FOOD",
  CLOTHING = "CLOTHING",
  SERVICE = "SERVICE",
  EDUCATION = "EDUCATION",
  HOUSING = "HOUSING",
  EVENT = "EVENT",
  OTHER = "OTHER",
}

// Dynamic categories table (admin-editable)
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),                  // Display name, e.g. "Food"
  slug: text("slug").notNull().unique(),         // Stored on needs.category, e.g. "FOOD"
  icon: text("icon").notNull().default("Heart"), // Lucide icon name
  displayOrder: integer("display_order").notNull().default(0),
  isEvent: boolean("is_event").notNull().default(false), // Enables event-specific fields
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
});

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

// Define types of needs
export enum NeedType {
  ONETIME = "ONETIME",
  ONGOING = "ONGOING",
  GROUP = "GROUP", // For group service projects requiring multiple volunteers
  EVENT = "EVENT", // For events/sign-ups allowing multiple participants
}

// Define the needs schema
export const needs = pgTable("needs", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  categorySelections: text("category_selections").notNull().default("[]"), // JSON array string of selected category slugs
  neededBy: date("needed_by"),
  eventDate: date("event_date"), // For EVENT category and GROUP type, specific date when the event/service project occurs
  eventTime: text("event_time"), // For EVENT category, to store time information (e.g., "7:00 PM")
  eventStartTime: text("event_start_time"), // HH:mm (24-hour) overall event start time
  eventEndTime: text("event_end_time"), // HH:mm (24-hour) overall event end time
  eventLocation: text("event_location"), // For EVENT category, to store location details
  status: text("status").notNull().default(NeedStatus.FLOATING),
  estimatedCost: integer("estimated_cost"),
  allowItemDonations: boolean("allow_item_donations").notNull().default(true), // Public users can pledge item support
  allowMoneyDonations: boolean("allow_money_donations").notNull().default(false), // Financial contributions are disabled for VFW
  needType: text("need_type").notNull().default(NeedType.ONETIME),
  startDate: date("start_date"),
  endDate: date("end_date"),
  imageUrl: text("image_url"),
  redirectUrl: text("redirect_url"), // For EVENT category sign-up button redirection
  volunteersNeeded: integer("volunteers_needed"), // For GROUP type, track how many volunteers are needed
  volunteersCount: integer("volunteers_count").default(0), // Current count of volunteers signed up
  isHighlighted: boolean("is_highlighted").default(false), // For starred/highlighted needs
  // Admin-only recipient contact information fields
  recipientName: text("recipient_name"), // Name of who the need is for (admin-only)
  recipientPhone: text("recipient_phone"), // Contact phone number (admin-only)
  recipientEmail: text("recipient_email"), // Contact email (admin-only)
  recipientAddress: text("recipient_address"), // Address information (admin-only)
  recipientNotes: text("recipient_notes"), // Additional admin notes about the recipient
  // Demographic data (admin-only)
  recipientDob: date("recipient_dob"), // Date of birth for age tracking
  recipientIsWidow: boolean("recipient_is_widow"), // Widow/widower status
  recipientIsSingleParent: boolean("recipient_is_single_parent"), // Single parent status
  recipientInsurance: text("recipient_insurance"), // Legacy field, kept for backward compat
  // Government assistance programs (admin-only)
  recipientMedicaid: boolean("recipient_medicaid"), // Receives Medicaid
  recipientMedicare: boolean("recipient_medicare"), // Receives Medicare
  recipientSocialSecurity: boolean("recipient_social_security"), // Receives Social Security
  recipientSnap: boolean("recipient_snap"), // Receives SNAP (food assistance)
  recipientDisability: boolean("recipient_disability"), // Receives Disability
  excludeFromEmail: boolean("exclude_from_email").default(false), // Opt out of auto-share email newsletter
  displayOrder: integer("display_order").notNull().default(0), // Admin-controlled sort order
  sharedAt: timestamp("shared_at"), // When need was auto-shared to Facebook/MailerLite (null = not yet shared)
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const needsRelations = relations(needs, ({ many }) => ({
  pledges: many(pledges),
  eventRoles: many(eventRoles),
  eventRoleSignups: many(eventRoleSignups),
}));

export const insertNeedSchema = createInsertSchema(needs).omit({
  id: true,
  sharedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertNeed = z.infer<typeof insertNeedSchema>;
export type Need = typeof needs.$inferSelect;

// Define the pledges schema
export const pledges = pgTable("pledges", {
  id: serial("id").primaryKey(),
  needId: integer("need_id").notNull().references(() => needs.id, { onDelete: 'cascade' }),
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
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const pledgesRelations = relations(pledges, ({ one, many }) => ({
  need: one(needs, {
    fields: [pledges.needId],
    references: [needs.id],
  }),
  eventRoleSignups: many(eventRoleSignups),
}));

export const insertPledgeSchema = createInsertSchema(pledges).omit({
  id: true,
  createdAt: true,
});

export type InsertPledge = z.infer<typeof insertPledgeSchema>;
export type Pledge = typeof pledges.$inferSelect;

// Event role slots for EVENT needs.
export const eventRoles = pgTable("event_roles", {
  id: serial("id").primaryKey(),
  needId: integer("need_id")
    .notNull()
    .references(() => needs.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slotDate: date("slot_date"), // Optional per-slot date for multi-day events
  startTime: text("start_time").notNull(), // HH:mm
  endTime: text("end_time").notNull(), // HH:mm
  capacity: integer("capacity"), // null = unlimited
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertEventRoleSchema = createInsertSchema(eventRoles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertEventRole = z.infer<typeof insertEventRoleSchema>;
export type EventRole = typeof eventRoles.$inferSelect;

// Join table connecting pledges to one or more event role slots.
export const eventRoleSignups = pgTable(
  "event_role_signups",
  {
    id: serial("id").primaryKey(),
    pledgeId: integer("pledge_id")
      .notNull()
      .references(() => pledges.id, { onDelete: "cascade" }),
    needId: integer("need_id")
      .notNull()
      .references(() => needs.id, { onDelete: "cascade" }),
    eventRoleId: integer("event_role_id")
      .notNull()
      .references(() => eventRoles.id, { onDelete: "cascade" }),
    signerEmail: text("signer_email").notNull(),
    quantity: integer("quantity").notNull().default(1),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    eventRoleSignupUniqueEmailIdx: uniqueIndex("event_role_signups_role_email_idx").on(
      table.eventRoleId,
      table.signerEmail,
    ),
  }),
);

export const insertEventRoleSignupSchema = createInsertSchema(eventRoleSignups).omit({
  id: true,
  createdAt: true,
});

export type InsertEventRoleSignup = z.infer<typeof insertEventRoleSignupSchema>;
export type EventRoleSignup = typeof eventRoleSignups.$inferSelect;

// Delivery tracking for event-signup reminder emails.
export const eventSignupReminders = pgTable(
  "event_signup_reminders",
  {
    id: serial("id").primaryKey(),
    needId: integer("need_id")
      .notNull()
      .references(() => needs.id, { onDelete: "cascade" }),
    signerEmail: text("signer_email").notNull(),
    firstSlotAt: timestamp("first_slot_at").notNull(),
    reminderType: text("reminder_type").notNull().default("FIRST_SLOT_24H"),
    sentAt: timestamp("sent_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueReminderIdx: uniqueIndex("event_signup_reminders_unique_idx").on(
      table.needId,
      table.signerEmail,
      table.firstSlotAt,
      table.reminderType,
    ),
    firstSlotIdx: index("idx_event_signup_reminders_first_slot_at").on(table.firstSlotAt),
  }),
);

export const insertEventSignupReminderSchema = createInsertSchema(eventSignupReminders).omit({
  id: true,
  createdAt: true,
});

export type InsertEventSignupReminder = z.infer<typeof insertEventSignupReminderSchema>;
export type EventSignupReminder = typeof eventSignupReminders.$inferSelect;

export type EventSignupSummary = {
  slotSignupsTotal: number;
  slotCapacityTotal: number | null;
  uniquePeopleTotal: number;
  hasRoleSlots: boolean;
};

// Durable integration queue for Serving Network -> Calendar webhook sync.
export const calendarSyncQueue = pgTable(
  "calendar_sync_queue",
  {
    needId: integer("need_id").primaryKey(),
    action: text("action").notNull(), // UPSERT | DELETE
    payload: text("payload").notNull(), // JSON string payload
    idempotencyKey: text("idempotency_key").notNull(),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at").notNull().defaultNow(),
    lastAttemptAt: timestamp("last_attempt_at"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    nextAttemptIdx: index("idx_calendar_sync_queue_next_attempt_at").on(table.nextAttemptAt),
  }),
);

export const insertCalendarSyncQueueSchema = createInsertSchema(calendarSyncQueue).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertCalendarSyncQueue = z.infer<typeof insertCalendarSyncQueueSchema>;
export type CalendarSyncQueue = typeof calendarSyncQueue.$inferSelect;

export const eventRolesRelations = relations(eventRoles, ({ one, many }) => ({
  need: one(needs, {
    fields: [eventRoles.needId],
    references: [needs.id],
  }),
  signups: many(eventRoleSignups),
}));

export const eventRoleSignupsRelations = relations(eventRoleSignups, ({ one }) => ({
  need: one(needs, {
    fields: [eventRoleSignups.needId],
    references: [needs.id],
  }),
  pledge: one(pledges, {
    fields: [eventRoleSignups.pledgeId],
    references: [pledges.id],
  }),
  eventRole: one(eventRoles, {
    fields: [eventRoleSignups.eventRoleId],
    references: [eventRoles.id],
  }),
}));
