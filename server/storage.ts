import {
  users,
  type User,
  type InsertUser,
  type Need,
  type InsertNeed,
  NeedStatus,
  NeedType,
  type Pledge,
  type InsertPledge,
  type EventRole,
  type EventSignupSummary,
  needs,
  pledges,
  eventRoles,
  eventRoleSignups,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, asc, desc, inArray } from "drizzle-orm";
import { randomBytes, scrypt } from "crypto";
import { promisify } from "util";
import { formatDateInNewYork, formatTimeRangeForDisplay, getCurrentDateInNewYork } from "./timezone";

const scryptAsync = promisify(scrypt);

// Sessions are now handled by cookie-session (no DB pool needed).
// This eliminates the second connection pool that was competing with
// Drizzle's postgres client for Supabase connections on cold starts.

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsersByCanonicalUsername(username: string): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;

  // Need methods
  createNeed(need: NeedMutationInput, status?: NeedStatus): Promise<Need>;
  getNeed(id: number): Promise<NeedListItem | undefined>;
  getAllNeeds(): Promise<NeedListItem[]>;
  markExpiredFloatingNeedsUnfulfilled(): Promise<number>;
  markExpiredEventNeedsFulfilled(): Promise<number>;
  updateNeedStatus(id: number, status: NeedStatus): Promise<Need | undefined>;
  updateNeed(id: number, need: NeedMutationInput): Promise<Need | undefined>;
  deleteNeed(id: number): Promise<boolean>;

  // Pledge methods
  createPledge(pledge: CreatePledgeInput): Promise<PledgeWithEventRoles>;
  getPledge(id: number): Promise<Pledge | undefined>;
  getPledgesByNeedId(needId: number): Promise<Pledge[]>;
  updateEventSignupByPledgeId(
    pledgeId: number,
    updates: UpdateEventSignupInput,
  ): Promise<PledgeWithEventRoles>;
  cancelEventSignupByPledgeId(pledgeId: number): Promise<Need>;
  getEventRolesByNeedId(needId: number, includeInactive?: boolean): Promise<EventRole[]>;
  getEventRolesWithStatsByNeedId(needId: number, includeInactive?: boolean): Promise<EventRoleWithStats[]>;
  getEventSignupSummaryByNeedId(needId: number): Promise<EventSignupSummary>;
  getEventRoleSelectionsByPledgeIds(pledgeIds: number[]): Promise<Map<number, EventRoleSummary[]>>;
}

export type EventRoleInput = {
  id?: number;
  name: string;
  slotDate?: string | null;
  startTime: string;
  endTime: string;
  capacity?: number | null;
  displayOrder?: number;
  isActive?: boolean;
};

export type NeedMutationInput = InsertNeed & {
  eventRoles?: EventRoleInput[];
};

export type CreatePledgeInput = InsertPledge & {
  selectedEventRoleIds?: number[];
  selectedEventRoleQuantities?: Record<string, number>;
};

export type UpdateEventSignupInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  organization?: string | null;
  notes?: string | null;
  selectedEventRoleIds: number[];
  selectedEventRoleQuantities?: Record<string, number>;
};

export type EventRoleSummary = Pick<EventRole, "id" | "name" | "slotDate" | "startTime" | "endTime"> & {
  quantity?: number;
};

export type NeedListItem = Need & {
  eventRolePreviewLabel?: string | null;
  eventLastDate?: string | null;
};

export type PledgeWithEventRoles = Pledge & {
  selectedEventRoles?: EventRoleSummary[];
};

export type EventRoleWithStats = EventRole & {
  filledCount: number;
  remainingCount: number | null;
  isFull: boolean;
};

export class EventSignupValidationError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.name = "EventSignupValidationError";
  }
}

export class EventSlotConflictError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 409) {
    super(message);
    this.statusCode = statusCode;
    this.name = "EventSlotConflictError";
  }
}

export class DatabaseStorage implements IStorage {
  private _initialized = false;

  private buildEventRolePreviewLabel(
    need: Need,
    roles: Array<Pick<EventRole, "slotDate" | "startTime" | "endTime">>,
  ): string | null {
    const slotMap = new Map<
      string,
      { slotDate: string | null; startTime: string; endTime: string }
    >();

    for (const role of roles) {
      const slotDate = role.slotDate || need.eventDate || null;
      const key = [slotDate || "", role.startTime || "", role.endTime || ""].join("|");
      if (!slotMap.has(key)) {
        slotMap.set(key, {
          slotDate,
          startTime: role.startTime,
          endTime: role.endTime,
        });
      }
    }

    const uniqueSlots = Array.from(slotMap.values()).sort((left, right) => {
      const leftDate = left.slotDate || "9999-12-31";
      const rightDate = right.slotDate || "9999-12-31";
      return (
        leftDate.localeCompare(rightDate) ||
        left.startTime.localeCompare(right.startTime) ||
        left.endTime.localeCompare(right.endTime)
      );
    });
    if (uniqueSlots.length > 0) {
      const distinctDateCount = new Set(
        uniqueSlots.map((slot) => slot.slotDate || "__no_date__"),
      ).size;
      const primarySlot = uniqueSlots[0];
      const timeLabel = formatTimeRangeForDisplay(primarySlot.startTime, primarySlot.endTime);

      if (!timeLabel) return null;

      const includeDate = distinctDateCount > 1 && primarySlot.slotDate;
      const dateLabel = includeDate
        ? formatDateInNewYork(primarySlot.slotDate, {
            month: "short",
            day: "numeric",
          })
        : "";
      const baseLabel = dateLabel ? `${dateLabel} ${timeLabel}` : timeLabel;
      return uniqueSlots.length > 1 ? `${baseLabel} +${uniqueSlots.length - 1} more` : baseLabel;
    }

    const overallTimeLabel = formatTimeRangeForDisplay(need.eventStartTime, need.eventEndTime);
    if (overallTimeLabel) return overallTimeLabel;

    const fallbackTime = need.eventTime?.trim();
    return fallbackTime || null;
  }

  private getEventLastDate(
    need: Pick<Need, "needType" | "startDate" | "endDate" | "eventDate" | "neededBy">,
    roles: Array<Pick<EventRole, "slotDate">> = [],
  ): string | null {
    if (need.needType !== NeedType.EVENT) {
      return null;
    }

    const candidateDates = [
      ...roles.map((role) => role.slotDate?.trim() || null),
      need.endDate?.trim() || null,
      need.eventDate?.trim() || null,
      need.neededBy?.trim() || null,
      need.startDate?.trim() || null,
    ].filter((value): value is string => Boolean(value));

    if (candidateDates.length === 0) {
      return null;
    }

    return candidateDates.reduce((latest, current) => (current > latest ? current : latest));
  }

  private isEventEnded(
    need: Pick<Need, "needType" | "startDate" | "endDate" | "eventDate" | "neededBy">,
    roles: Array<Pick<EventRole, "slotDate">> = [],
  ): boolean {
    const eventLastDate = this.getEventLastDate(need, roles);
    if (!eventLastDate) {
      return false;
    }

    return getCurrentDateInNewYork() > eventLastDate;
  }

  private isEventRoleEnded(
    need: Pick<Need, "startDate" | "eventDate" | "neededBy">,
    role: Pick<EventRole, "slotDate">,
  ): boolean {
    const slotDate = role.slotDate || need.eventDate || need.startDate || need.neededBy || null;
    return Boolean(slotDate && getCurrentDateInNewYork() > slotDate);
  }

  private normalizeUsername(username: string): string {
    return username.trim().toLowerCase();
  }

  private async hashBootstrapPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
  }

  constructor() {
    // Deferred admin init — fire-and-forget with error handling
    this.initializeAdminUser().catch((err) => {
      console.error("Non-fatal: admin user initialization failed (will retry on next cold start):", err.message);
    });
  }

  private async initializeAdminUser() {
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

      // Check if there's already an admin user
      const existingAdmin = await this.getUserByUsername(adminEmail);

      if (!existingAdmin) {
        // Create initial admin user
        await this.createUser({
          username: adminEmail,
          password: await this.hashBootstrapPassword(adminPassword),
          isAdmin: true,
        });
      }
      this._initialized = true;
    } catch (err) {
      // Re-throw so the .catch() in constructor can log it, but process won't crash
      throw err;
    }
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const matchingUsers = await this.getUsersByCanonicalUsername(username);
    return matchingUsers[0];
  }

  async getUsersByCanonicalUsername(username: string): Promise<User[]> {
    const normalizedUsername = this.normalizeUsername(username);
    return await db
      .select()
      .from(users)
      .where(sql`lower(trim(${users.username})) = ${normalizedUsername}`)
      .orderBy(desc(users.id))
      .limit(20);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const normalizedUsername = this.normalizeUsername(insertUser.username);
    const [user] = await db
      .insert(users)
      .values({
        username: normalizedUsername,
        password: insertUser.password,
        isAdmin: insertUser.isAdmin === undefined ? false : insertUser.isAdmin,
      })
      .returning();
    return user;
  }

  private formatEventTimeRange(startTime?: string | null, endTime?: string | null, fallback?: string | null): string | null {
    if (startTime && endTime) return `${startTime} - ${endTime}`;
    return fallback || null;
  }

  private normalizeRoleCapacity(capacity: number | null | undefined): number | null {
    if (capacity === null || capacity === undefined) return null;
    if (!Number.isFinite(capacity)) return null;
    const normalized = Math.max(0, Math.floor(capacity));
    return normalized === 0 ? null : normalized;
  }

  private normalizeRoleInput(role: EventRoleInput, index: number) {
    return {
      id: role.id,
      name: role.name.trim(),
      slotDate: role.slotDate?.trim() || null,
      startTime: role.startTime.trim(),
      endTime: role.endTime.trim(),
      capacity: this.normalizeRoleCapacity(role.capacity),
      displayOrder: typeof role.displayOrder === "number" ? role.displayOrder : index,
      isActive: role.isActive ?? true,
    };
  }

  private normalizeEventRoleSelections(rawRoleIds?: number[] | null): number[] {
    return Array.from(
      new Set(
        (rawRoleIds || [])
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value > 0),
      ),
    );
  }

  private normalizeEventRoleQuantities(
    rawQuantities: unknown,
    selectedRoleIds: number[],
    fallbackQuantities = new Map<number, number>(),
  ): Map<number, number> {
    const quantitySource =
      rawQuantities && typeof rawQuantities === "object"
        ? (rawQuantities as Record<string, unknown>)
        : {};

    const normalized = new Map<number, number>();
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

  private normalizeSignerEmail(rawEmail: string): string {
    return rawEmail.trim().toLowerCase();
  }

  private normalizeNeedCategories(rawCategory?: string | null, rawCategorySelections?: string | null): {
    primaryCategory: string;
    categorySelections: string;
  } {
    const fallbackCategory = (rawCategory || "").trim();
    let normalizedSelections: string[] = [];

    const rawSelections = (rawCategorySelections || "").trim();
    if (rawSelections) {
      try {
        const parsed = JSON.parse(rawSelections);
        if (Array.isArray(parsed)) {
          normalizedSelections = parsed
            .filter((value): value is string => typeof value === "string")
            .map((value) => value.trim())
            .filter((value) => value.length > 0);
        }
      } catch {
        normalizedSelections = rawSelections
          .split(",")
          .map((value) => value.trim())
          .filter((value) => value.length > 0);
      }
    }

    if (normalizedSelections.length === 0 && fallbackCategory) {
      normalizedSelections = [fallbackCategory];
    }

    const uniqueSelections = Array.from(new Set(normalizedSelections));
    return {
      primaryCategory: uniqueSelections[0] || fallbackCategory,
      categorySelections: JSON.stringify(uniqueSelections),
    };
  }

  private async getEventParticipantCountsByNeedIdsTx(
    tx: any,
    needIds: number[],
  ): Promise<Map<number, number>> {
    const uniqueNeedIds = Array.from(
      new Set(needIds.filter((id) => Number.isInteger(id) && id > 0)),
    );
    if (uniqueNeedIds.length === 0) {
      return new Map();
    }

    const participantCountsByPledge = tx
      .select({
        needId: eventRoleSignups.needId,
        pledgeId: eventRoleSignups.pledgeId,
        participantCount: sql<number>`
          max(
            case
              when ${eventRoleSignups.quantity} > 0 then ${eventRoleSignups.quantity}
              else 1
            end
          )::int
        `.as("participant_count"),
      })
      .from(eventRoleSignups)
      .where(inArray(eventRoleSignups.needId, uniqueNeedIds))
      .groupBy(eventRoleSignups.needId, eventRoleSignups.pledgeId)
      .as("event_participant_counts_by_pledge");

    const rows = await tx
      .select({
        needId: participantCountsByPledge.needId,
        participantCount: sql<number>`coalesce(sum(${participantCountsByPledge.participantCount}), 0)::int`,
      })
      .from(participantCountsByPledge)
      .groupBy(participantCountsByPledge.needId);

    return new Map(
      rows.map((row: { needId: number; participantCount: number }) => [
        Number(row.needId),
        Number(row.participantCount) || 0,
      ]),
    );
  }

  private async getEventParticipantCountByNeedIdTx(tx: any, needId: number): Promise<number> {
    const countsByNeedId = await this.getEventParticipantCountsByNeedIdsTx(tx, [needId]);
    return countsByNeedId.get(needId) ?? 0;
  }

  private async syncEventRolesForNeedTx(
    tx: any,
    needId: number,
    incomingRoles: EventRoleInput[],
  ): Promise<EventRole[]> {
    const normalizedRoles = incomingRoles.map((role, index) => this.normalizeRoleInput(role, index));

    const existing = await tx.select().from(eventRoles).where(eq(eventRoles.needId, needId));
    const existingById = new Map(existing.map((role: EventRole) => [role.id, role]));
    const keepIds = new Set<number>();

    for (const role of normalizedRoles) {
      if (role.id && existingById.has(role.id)) {
        await tx
          .update(eventRoles)
          .set({
            name: role.name,
            slotDate: role.slotDate,
            startTime: role.startTime,
            endTime: role.endTime,
            capacity: role.capacity,
            displayOrder: role.displayOrder,
            isActive: role.isActive,
            updatedAt: new Date(),
          })
          .where(and(eq(eventRoles.id, role.id), eq(eventRoles.needId, needId)));
        keepIds.add(role.id);
      } else {
        const [created] = await tx
          .insert(eventRoles)
          .values({
            needId,
            name: role.name,
            slotDate: role.slotDate,
            startTime: role.startTime,
            endTime: role.endTime,
            capacity: role.capacity,
            displayOrder: role.displayOrder,
            isActive: role.isActive,
          })
          .returning();
        keepIds.add(created.id);
      }
    }

    const rolesToDelete = existing
      .filter((role: EventRole) => !keepIds.has(role.id))
      .map((role: EventRole) => role.id);
    if (rolesToDelete.length > 0) {
      await tx.delete(eventRoles).where(inArray(eventRoles.id, rolesToDelete));
    }

    return await tx
      .select()
      .from(eventRoles)
      .where(eq(eventRoles.needId, needId))
      .orderBy(asc(eventRoles.displayOrder), asc(eventRoles.id));
  }

  private async computeEventNeedStatusTx(tx: any, needId: number): Promise<NeedStatus> {
    const roles: EventRole[] = await tx
      .select()
      .from(eventRoles)
      .where(and(eq(eventRoles.needId, needId), eq(eventRoles.isActive, true)));

    const finiteRoles = roles.filter((role) => typeof role.capacity === "number" && role.capacity > 0);
    if (finiteRoles.length === 0) {
      return NeedStatus.FLOATING;
    }

    const counts = await tx
      .select({
        eventRoleId: eventRoleSignups.eventRoleId,
        filledCount: sql<number>`coalesce(sum(${eventRoleSignups.quantity}), 0)::int`,
      })
      .from(eventRoleSignups)
      .where(eq(eventRoleSignups.needId, needId))
      .groupBy(eventRoleSignups.eventRoleId);

    const countByRoleId = new Map<number, number>(
      counts.map((row: { eventRoleId: number; filledCount: number }) => [row.eventRoleId, Number(row.filledCount) || 0]),
    );
    const allFiniteSlotsFull = finiteRoles.every((role) => {
      const filledCount = Number(countByRoleId.get(role.id) ?? 0);
      const capacity = typeof role.capacity === "number" ? role.capacity : 0;
      return filledCount >= capacity;
    });

    return allFiniteSlotsFull ? NeedStatus.PLEDGED : NeedStatus.FLOATING;
  }

  private async recalculateEventNeedStatsTx(tx: any, needId: number): Promise<Need> {
    const [currentNeed] = await tx.select().from(needs).where(eq(needs.id, needId));
    if (!currentNeed) {
      throw new Error("Need not found");
    }

    const nextStatus = await this.computeEventNeedStatusTx(tx, needId);
    const volunteersCount = await this.getEventParticipantCountByNeedIdTx(tx, needId);

    const [updatedNeed] = await tx
      .update(needs)
      .set({
        volunteersCount,
        status: nextStatus,
        updatedAt: new Date(),
      })
      .where(eq(needs.id, needId))
      .returning();

    return updatedNeed ?? currentNeed;
  }

  // Need methods
  async createNeed(insertNeed: NeedMutationInput, status?: NeedStatus): Promise<Need> {
    const needType = insertNeed.needType || NeedType.ONETIME;
    const isEventNeed = needType === NeedType.EVENT;

    return await db.transaction(async (tx) => {
      const normalizedCategories = this.normalizeNeedCategories(
        insertNeed.category,
        insertNeed.categorySelections,
      );

      const [need] = await tx
        .insert(needs)
        .values({
          title: insertNeed.title,
          description: insertNeed.description,
          category: normalizedCategories.primaryCategory,
          categorySelections: normalizedCategories.categorySelections,
          neededBy: insertNeed.neededBy || null,
          eventDate: insertNeed.eventDate || null,
          eventTime: this.formatEventTimeRange(
            insertNeed.eventStartTime,
            insertNeed.eventEndTime,
            insertNeed.eventTime || null,
          ),
          eventStartTime: insertNeed.eventStartTime || null,
          eventEndTime: insertNeed.eventEndTime || null,
          eventLocation: insertNeed.eventLocation || null,
          status:
            status ||
            insertNeed.status ||
            (insertNeed.needType === NeedType.ONGOING ? NeedStatus.RECURRING : NeedStatus.FLOATING),
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
          excludeFromEmail: insertNeed.excludeFromEmail ?? false,
        })
        .returning();

      if (isEventNeed && Array.isArray(insertNeed.eventRoles)) {
        await this.syncEventRolesForNeedTx(tx, need.id, insertNeed.eventRoles);
      }

      return need;
    });
  }

  async getNeed(id: number): Promise<NeedListItem | undefined> {
    const [need] = await db.select().from(needs).where(eq(needs.id, id));
    if (!need || need.needType !== NeedType.EVENT) {
      return need;
    }

    const activeRoles = await db
      .select({
        slotDate: eventRoles.slotDate,
        startTime: eventRoles.startTime,
        endTime: eventRoles.endTime,
      })
      .from(eventRoles)
      .where(and(eq(eventRoles.needId, need.id), eq(eventRoles.isActive, true)))
      .orderBy(asc(eventRoles.displayOrder), asc(eventRoles.id));
    const volunteersCount = await this.getEventParticipantCountByNeedIdTx(db, need.id);
    return {
      ...need,
      volunteersCount,
      eventLastDate: this.getEventLastDate(need, activeRoles),
      eventRolePreviewLabel: this.buildEventRolePreviewLabel(need, activeRoles),
    };
  }

  async getAllNeeds(): Promise<NeedListItem[]> {
    const allNeeds = await db
      .select()
      .from(needs)
      .orderBy(asc(needs.displayOrder), desc(needs.createdAt));

    const eventNeedIds = allNeeds
      .filter((need) => need.needType === NeedType.EVENT)
      .map((need) => need.id);

    const roleRows =
      eventNeedIds.length > 0
        ? await db
            .select({
              needId: eventRoles.needId,
              slotDate: eventRoles.slotDate,
              startTime: eventRoles.startTime,
              endTime: eventRoles.endTime,
            })
            .from(eventRoles)
            .where(and(inArray(eventRoles.needId, eventNeedIds), eq(eventRoles.isActive, true)))
            .orderBy(asc(eventRoles.needId), asc(eventRoles.displayOrder), asc(eventRoles.id))
        : [];

    const rolesByNeedId = new Map<
      number,
      Array<Pick<EventRole, "slotDate" | "startTime" | "endTime">>
    >();

    for (const role of roleRows) {
      const existingRoles = rolesByNeedId.get(role.needId) ?? [];
      existingRoles.push({
        slotDate: role.slotDate,
        startTime: role.startTime,
        endTime: role.endTime,
      });
      rolesByNeedId.set(role.needId, existingRoles);
    }

    if (eventNeedIds.length === 0) {
      return allNeeds;
    }

    const participantCountsByNeedId = await this.getEventParticipantCountsByNeedIdsTx(db, eventNeedIds);

    return allNeeds.map((need) => ({
      ...need,
      volunteersCount:
        need.needType === NeedType.EVENT
          ? participantCountsByNeedId.get(need.id) ?? 0
          : need.volunteersCount,
      eventLastDate:
        need.needType === NeedType.EVENT
          ? this.getEventLastDate(need, rolesByNeedId.get(need.id) ?? [])
          : null,
      eventRolePreviewLabel:
        need.needType === NeedType.EVENT
          ? this.buildEventRolePreviewLabel(need, rolesByNeedId.get(need.id) ?? [])
          : null,
    }));
  }

  async markExpiredFloatingNeedsUnfulfilled(): Promise<number> {
    const today = getCurrentDateInNewYork();
    const updatedRows = await db
      .update(needs)
      .set({
        status: NeedStatus.UNFULFILLED,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(needs.status, NeedStatus.FLOATING),
          sql`${needs.needType} <> ${NeedType.EVENT}`,
          sql`${needs.endDate} IS NOT NULL`,
          sql`${needs.endDate} < ${today}`,
        ),
      )
      .returning({ id: needs.id });

    return updatedRows.length;
  }

  async markExpiredEventNeedsFulfilled(): Promise<number> {
    // Fulfill an EVENT need only once its LAST active slot date has passed, using the
    // same slot-aware logic as the sign-up cutoff (getEventLastDate/isEventEnded). Keying
    // off a single date (e.g. neededBy) would wrongly close multi-day events that still
    // have open later slots — the bug fixed in "Fix event signup cutoff for multi-day slots".
    const candidates = await db
      .select()
      .from(needs)
      .where(
        and(
          eq(needs.needType, NeedType.EVENT),
          inArray(needs.status, [NeedStatus.FLOATING, NeedStatus.PLEDGED, NeedStatus.RECURRING]),
        ),
      );
    if (candidates.length === 0) return 0;

    const candidateIds = candidates.map((need) => need.id);
    const roleRows = await db
      .select({ needId: eventRoles.needId, slotDate: eventRoles.slotDate })
      .from(eventRoles)
      .where(and(inArray(eventRoles.needId, candidateIds), eq(eventRoles.isActive, true)));

    const rolesByNeedId = new Map<number, Array<Pick<EventRole, "slotDate">>>();
    for (const row of roleRows) {
      const list = rolesByNeedId.get(row.needId) ?? [];
      list.push({ slotDate: row.slotDate });
      rolesByNeedId.set(row.needId, list);
    }

    const expiredIds = candidates
      .filter((need) => this.isEventEnded(need, rolesByNeedId.get(need.id) ?? []))
      .map((need) => need.id);
    if (expiredIds.length === 0) return 0;

    const updatedRows = await db
      .update(needs)
      .set({ status: NeedStatus.FULFILLED, updatedAt: new Date() })
      .where(inArray(needs.id, expiredIds))
      .returning({ id: needs.id });

    return updatedRows.length;
  }

  async updateNeedStatus(id: number, status: NeedStatus): Promise<Need | undefined> {
    const now = new Date();
    
    const [updatedNeed] = await db
      .update(needs)
      .set({
        status,
        updatedAt: now,
      })
      .where(eq(needs.id, id))
      .returning();
    
    return updatedNeed;
  }

  async updateNeed(id: number, updatedData: NeedMutationInput): Promise<Need | undefined> {
    return await db.transaction(async (tx) => {
      const [currentNeed] = await tx.select().from(needs).where(eq(needs.id, id));
      if (!currentNeed) return undefined;

      const now = new Date();
      const nextNeedType = updatedData.needType || NeedType.ONETIME;
      const isEventNeed = nextNeedType === NeedType.EVENT;
      const normalizedCategories = this.normalizeNeedCategories(
        updatedData.category,
        updatedData.categorySelections,
      );

      const [updatedNeed] = await tx
        .update(needs)
        .set({
          title: updatedData.title,
          description: updatedData.description,
          category: normalizedCategories.primaryCategory,
          categorySelections: normalizedCategories.categorySelections,
          neededBy: updatedData.neededBy || null,
          eventDate: updatedData.eventDate || null,
          eventTime: this.formatEventTimeRange(
            updatedData.eventStartTime,
            updatedData.eventEndTime,
            updatedData.eventTime || null,
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
          status: updatedData.status || NeedStatus.FLOATING,
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
          updatedAt: now,
        })
        .where(eq(needs.id, id))
        .returning();

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

  async deleteNeed(id: number): Promise<boolean> {
    // First delete any associated pledges (foreign key constraint)
    await db.delete(pledges).where(eq(pledges.needId, id));
    
    // Then delete the need
    const result = await db.delete(needs).where(eq(needs.id, id)).returning({ id: needs.id });
    return result.length > 0;
  }

  // Pledge methods
  async createPledge(insertPledge: CreatePledgeInput): Promise<PledgeWithEventRoles> {
    return await db.transaction(async (tx) => {
      const [need] = await tx.select().from(needs).where(eq(needs.id, insertPledge.needId));
      if (!need) {
        throw new Error("Need not found");
      }

      const normalizedEmail = insertPledge.email.trim().toLowerCase();
      const selectedRoleIds = this.normalizeEventRoleSelections(insertPledge.selectedEventRoleIds);
      const selectedRoleQuantities = this.normalizeEventRoleQuantities(
        insertPledge.selectedEventRoleQuantities,
        selectedRoleIds,
      );

      let selectedRoles: EventRoleSummary[] = [];

      if (need.needType === NeedType.EVENT) {
        const activeRoles: EventRole[] = await tx
          .select()
          .from(eventRoles)
          .where(and(eq(eventRoles.needId, need.id), eq(eventRoles.isActive, true)));

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
          const roles: EventRole[] = selectableRoles.filter((role) => selectedRoleIds.includes(role.id));

          if (roles.length !== selectedRoleIds.length) {
            throw new EventSignupValidationError("One or more selected slots are no longer available.");
          }

          for (const role of roles) {
            const [existingSignup] = await tx
              .select({ id: eventRoleSignups.id })
              .from(eventRoleSignups)
              .where(
                and(
                  eq(eventRoleSignups.eventRoleId, role.id),
                  eq(eventRoleSignups.signerEmail, normalizedEmail),
                ),
              )
              .limit(1);

            if (existingSignup) {
              throw new EventSlotConflictError(`You are already signed up for "${role.name}".`);
            }

            if (typeof role.capacity === "number" && role.capacity > 0) {
              const [countRow] = await tx
                .select({ filledCount: sql<number>`coalesce(sum(${eventRoleSignups.quantity}), 0)::int` })
                .from(eventRoleSignups)
                .where(eq(eventRoleSignups.eventRoleId, role.id));

              const requestedQuantity = selectedRoleQuantities.get(role.id) ?? 1;
              const remainingCapacity = role.capacity - (countRow?.filledCount || 0);
              if (remainingCapacity <= 0) {
                throw new EventSlotConflictError(`"${role.name}" is full. Please choose another slot.`);
              }
              if (requestedQuantity > remainingCapacity) {
                throw new EventSlotConflictError(
                  `Only ${remainingCapacity} spot${remainingCapacity === 1 ? "" : "s"} left for "${role.name}".`,
                );
              }
            }
          }

          selectedRoles = roles
            .sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id)
            .map((role) => ({
              id: role.id,
              name: role.name,
              slotDate: role.slotDate,
              startTime: role.startTime,
              endTime: role.endTime,
              quantity: selectedRoleQuantities.get(role.id) ?? 1,
            }));
        }
      }

      const [pledge] = await tx
        .insert(pledges)
        .values({
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
          paymentCompleted: insertPledge.paymentCompleted ?? false,
        })
        .returning();

      if (need.needType === NeedType.EVENT) {
        if (selectedRoles.length > 0) {
          await tx.insert(eventRoleSignups).values(
            selectedRoles.map((role) => ({
              pledgeId: pledge.id,
              needId: need.id,
              eventRoleId: role.id,
              signerEmail: normalizedEmail,
              quantity: role.quantity ?? 1,
            })),
          );
        }
        await this.recalculateEventNeedStatsTx(tx, need.id);

        return {
          ...pledge,
          selectedEventRoles: selectedRoles,
        };
      }

      if (need.needType === NeedType.GROUP) {
        const currentCount = (need.volunteersCount || 0) + 1;

        await tx
          .update(needs)
          .set({
            volunteersCount: currentCount,
            updatedAt: new Date(),
            // Requested volunteers are informational for group projects and should not cap sign-ups.
            status: NeedStatus.FLOATING,
          })
          .where(eq(needs.id, insertPledge.needId));
      } else if (need.status !== NeedStatus.RECURRING) {
        await tx
          .update(needs)
          .set({
            status: NeedStatus.PLEDGED,
            updatedAt: new Date(),
          })
          .where(eq(needs.id, insertPledge.needId));
      }

      return pledge;
    });
  }

  async getPledge(id: number): Promise<Pledge | undefined> {
    const [pledge] = await db.select().from(pledges).where(eq(pledges.id, id));
    return pledge;
  }

  async getPledgesByNeedId(needId: number): Promise<Pledge[]> {
    return await db.select().from(pledges).where(eq(pledges.needId, needId));
  }

  async updateEventSignupByPledgeId(
    pledgeId: number,
    updates: UpdateEventSignupInput,
  ): Promise<PledgeWithEventRoles> {
    return await db.transaction(async (tx) => {
      const [existingPledge] = await tx.select().from(pledges).where(eq(pledges.id, pledgeId)).limit(1);
      if (!existingPledge) {
        throw new EventSignupValidationError("Sign-up record not found.", 404);
      }

      const [need] = await tx.select().from(needs).where(eq(needs.id, existingPledge.needId)).limit(1);
      if (!need || need.needType !== NeedType.EVENT) {
        throw new EventSignupValidationError("This sign-up can only be managed for event needs.", 400);
      }

      const normalizedEmail = this.normalizeSignerEmail(updates.email);
      const selectedRoleIds = this.normalizeEventRoleSelections(updates.selectedEventRoleIds);
      const existingSignupRows = await tx
        .select({
          eventRoleId: eventRoleSignups.eventRoleId,
          quantity: eventRoleSignups.quantity,
        })
        .from(eventRoleSignups)
        .where(eq(eventRoleSignups.pledgeId, pledgeId));
      const existingQuantities = new Map<number, number>(
        existingSignupRows.map((row: { eventRoleId: number; quantity: number }) => [
          row.eventRoleId,
          Number.isInteger(row.quantity) && row.quantity > 0 ? row.quantity : 1,
        ]),
      );
      const selectedRoleQuantities = this.normalizeEventRoleQuantities(
        updates.selectedEventRoleQuantities,
        selectedRoleIds,
        existingQuantities,
      );

      const activeRoles: EventRole[] = await tx
        .select()
        .from(eventRoles)
        .where(and(eq(eventRoles.needId, need.id), eq(eventRoles.isActive, true)));

      if (activeRoles.length > 0 && selectedRoleIds.length === 0) {
        throw new EventSignupValidationError("Please select at least one sign-up slot.");
      }

      const selectedRoles: EventRole[] = activeRoles.filter((role) => selectedRoleIds.includes(role.id));
      if (selectedRoles.length !== selectedRoleIds.length) {
        throw new EventSignupValidationError("One or more selected slots are no longer available.");
      }

      for (const role of selectedRoles) {
        const [existingConflict] = await tx
          .select({ id: eventRoleSignups.id })
          .from(eventRoleSignups)
          .where(
            and(
              eq(eventRoleSignups.eventRoleId, role.id),
              eq(eventRoleSignups.signerEmail, normalizedEmail),
              sql`${eventRoleSignups.pledgeId} <> ${pledgeId}`,
            ),
          )
          .limit(1);

        if (existingConflict) {
          throw new EventSlotConflictError(`You are already signed up for "${role.name}".`);
        }

        if (typeof role.capacity === "number" && role.capacity > 0) {
          const [countRow] = await tx
            .select({ filledCount: sql<number>`coalesce(sum(${eventRoleSignups.quantity}), 0)::int` })
            .from(eventRoleSignups)
            .where(
              and(
                eq(eventRoleSignups.eventRoleId, role.id),
                sql`${eventRoleSignups.pledgeId} <> ${pledgeId}`,
              ),
            );

          const requestedQuantity = selectedRoleQuantities.get(role.id) ?? 1;
          const remainingCapacity = role.capacity - (countRow?.filledCount || 0);
          if (remainingCapacity <= 0) {
            throw new EventSlotConflictError(`"${role.name}" is full. Please choose another slot.`);
          }
          if (requestedQuantity > remainingCapacity) {
            throw new EventSlotConflictError(
              `Only ${remainingCapacity} spot${remainingCapacity === 1 ? "" : "s"} left for "${role.name}".`,
            );
          }
        }
      }

      await tx.delete(eventRoleSignups).where(eq(eventRoleSignups.pledgeId, pledgeId));

      const nextSelectedRoles = selectedRoles
        .sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id)
        .map((role) => ({
          id: role.id,
          name: role.name,
          slotDate: role.slotDate,
          startTime: role.startTime,
          endTime: role.endTime,
          quantity: selectedRoleQuantities.get(role.id) ?? 1,
        }));

      if (nextSelectedRoles.length > 0) {
        await tx.insert(eventRoleSignups).values(
          nextSelectedRoles.map((role) => ({
            pledgeId,
            needId: need.id,
            eventRoleId: role.id,
            signerEmail: normalizedEmail,
            quantity: role.quantity ?? 1,
          })),
        );
      }

      const [updatedPledge] = await tx
        .update(pledges)
        .set({
          firstName: updates.firstName.trim(),
          lastName: updates.lastName.trim(),
          email: updates.email.trim(),
          phone: updates.phone || null,
          organization: updates.organization || null,
          notes: updates.notes || null,
        })
        .where(eq(pledges.id, pledgeId))
        .returning();

      if (!updatedPledge) {
        throw new EventSignupValidationError("Failed to update sign-up details.", 500);
      }

      await this.recalculateEventNeedStatsTx(tx, need.id);

      return {
        ...updatedPledge,
        selectedEventRoles: nextSelectedRoles,
      };
    });
  }

  async cancelEventSignupByPledgeId(pledgeId: number): Promise<Need> {
    return await db.transaction(async (tx) => {
      const [existingPledge] = await tx.select().from(pledges).where(eq(pledges.id, pledgeId)).limit(1);
      if (!existingPledge) {
        throw new EventSignupValidationError("Sign-up record not found.", 404);
      }

      const [need] = await tx.select().from(needs).where(eq(needs.id, existingPledge.needId)).limit(1);
      if (!need || need.needType !== NeedType.EVENT) {
        throw new EventSignupValidationError("This sign-up can only be canceled for event needs.", 400);
      }

      const deleted = await tx.delete(pledges).where(eq(pledges.id, pledgeId)).returning({ id: pledges.id });
      if (deleted.length === 0) {
        throw new EventSignupValidationError("Sign-up record not found.", 404);
      }

      return await this.recalculateEventNeedStatsTx(tx, need.id);
    });
  }

  async getEventRolesByNeedId(needId: number, includeInactive = false): Promise<EventRole[]> {
    return await db
      .select()
      .from(eventRoles)
      .where(
        includeInactive
          ? eq(eventRoles.needId, needId)
          : and(eq(eventRoles.needId, needId), eq(eventRoles.isActive, true)),
      )
      .orderBy(asc(eventRoles.displayOrder), asc(eventRoles.id));
  }

  async getEventRolesWithStatsByNeedId(needId: number, includeInactive = false): Promise<EventRoleWithStats[]> {
    const roles = await this.getEventRolesByNeedId(needId, includeInactive);
    if (roles.length === 0) return [];

    const counts = await db
      .select({
        eventRoleId: eventRoleSignups.eventRoleId,
        filledCount: sql<number>`coalesce(sum(${eventRoleSignups.quantity}), 0)::int`,
      })
      .from(eventRoleSignups)
      .where(eq(eventRoleSignups.needId, needId))
      .groupBy(eventRoleSignups.eventRoleId);

    const countByRoleId = new Map(counts.map((row) => [row.eventRoleId, row.filledCount]));

    return roles.map((role) => {
      const filledCount = countByRoleId.get(role.id) || 0;
      const remainingCount =
        typeof role.capacity === "number" && role.capacity > 0
          ? Math.max(role.capacity - filledCount, 0)
          : null;

      return {
        ...role,
        filledCount,
        remainingCount,
        isFull: remainingCount === 0,
      };
    });
  }

  async getEventSignupSummaryByNeedId(needId: number): Promise<EventSignupSummary> {
    const [roleMeta] = await db
      .select({
        roleCount: sql<number>`count(*)::int`,
        unlimitedRoleCount: sql<number>`count(*) filter (where ${eventRoles.capacity} is null)::int`,
        slotCapacityTotal: sql<number>`coalesce(sum(${eventRoles.capacity}), 0)::int`,
      })
      .from(eventRoles)
      .where(and(eq(eventRoles.needId, needId), eq(eventRoles.isActive, true)));

    const hasRoleSlots = (roleMeta?.roleCount ?? 0) > 0;

    if (hasRoleSlots) {
      const [signupSummary] = await db
        .select({
          slotSignupsTotal: sql<number>`coalesce(sum(${eventRoleSignups.quantity}), 0)::int`,
        })
        .from(eventRoleSignups)
        .where(eq(eventRoleSignups.needId, needId));
      const uniquePeopleTotal = await this.getEventParticipantCountByNeedIdTx(db, needId);

      return {
        slotSignupsTotal: signupSummary?.slotSignupsTotal ?? 0,
        slotCapacityTotal:
          (roleMeta?.unlimitedRoleCount ?? 0) > 0 ? null : (roleMeta?.slotCapacityTotal ?? 0),
        uniquePeopleTotal,
        hasRoleSlots: true,
      };
    }

    const [legacyNeed] = await db
      .select({
        volunteersNeeded: needs.volunteersNeeded,
      })
      .from(needs)
      .where(eq(needs.id, needId))
      .limit(1);

    const [legacySummary] = await db
      .select({
        slotSignupsTotal: sql<number>`count(*)::int`,
        uniquePeopleTotal: sql<number>`count(distinct lower(trim(${pledges.email})))::int`,
      })
      .from(pledges)
      .where(eq(pledges.needId, needId));

    return {
      slotSignupsTotal: legacySummary?.slotSignupsTotal ?? 0,
      slotCapacityTotal: legacyNeed?.volunteersNeeded ?? null,
      uniquePeopleTotal: legacySummary?.uniquePeopleTotal ?? 0,
      hasRoleSlots: false,
    };
  }

  async getEventRoleSelectionsByPledgeIds(pledgeIds: number[]): Promise<Map<number, EventRoleSummary[]>> {
    const uniquePledgeIds = Array.from(new Set(pledgeIds.filter((id) => Number.isInteger(id) && id > 0)));
    if (uniquePledgeIds.length === 0) return new Map();

    const rows = await db
      .select({
        pledgeId: eventRoleSignups.pledgeId,
        roleId: eventRoles.id,
        roleName: eventRoles.name,
        slotDate: eventRoles.slotDate,
        startTime: eventRoles.startTime,
        endTime: eventRoles.endTime,
        quantity: eventRoleSignups.quantity,
        displayOrder: eventRoles.displayOrder,
      })
      .from(eventRoleSignups)
      .innerJoin(eventRoles, eq(eventRoleSignups.eventRoleId, eventRoles.id))
      .where(inArray(eventRoleSignups.pledgeId, uniquePledgeIds))
      .orderBy(asc(eventRoles.displayOrder), asc(eventRoles.id));

    const map = new Map<number, EventRoleSummary[]>();
    for (const row of rows) {
      if (!map.has(row.pledgeId)) {
        map.set(row.pledgeId, []);
      }
      map.get(row.pledgeId)!.push({
        id: row.roleId,
        name: row.roleName,
        slotDate: row.slotDate,
        startTime: row.startTime,
        endTime: row.endTime,
        quantity: row.quantity,
      });
    }
    return map;
  }
}

export const storage = new DatabaseStorage();
