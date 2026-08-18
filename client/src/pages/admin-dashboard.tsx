import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Calendar,
  CalendarCheck2,
  ChevronDown,
  ChevronRight,
  CalendarDays,
  CheckCircle,
  Clock,
  Eye,
  ExternalLink,
  FileEdit,
  FileSpreadsheet,
  HandHelping,
  LayoutDashboard,
  LogOut,
  Mail,
  PlusCircle,
  Printer,
  Search,
  Settings,
  ShieldCheck,
  TrendingDown,
  UserCheck,
  UserX,
  Users,
  type LucideIcon,
} from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { useCategories } from "@/hooks/use-categories";
import { useStats } from "@/hooks/use-stats";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { buildNeedShareUrl } from "@/lib/public-url";
import { buildEmailDraftUrl, copyTextToClipboard, openEmailDraft } from "@/lib/email-draft";
import { cn, formatDateInNewYork } from "@/lib/utils";
import { Category, Need, NeedStatus, NeedType, Pledge } from "@shared/schema";
import NeedForm from "@/components/admin/need-form";
import NeedsTable from "@/components/admin/needs-table";
import AdminUserForm from "@/components/admin/admin-user-form";
import AdminUsersTable from "@/components/admin/admin-users-table";
import NotificationPreferences from "@/components/admin/notification-preferences";
import CategoryManager from "@/components/admin/category-manager";
import DataExports from "@/components/admin/data-exports";
import EventSignups from "@/components/admin/event-signups";
import { DashboardStats } from "@/components/admin/dashboard-stats";
import { EmailStatus } from "@/components/admin/email-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AdminShell } from "@/components/layout/admin-shell";
import { InsetGroup } from "@/components/layout/inset-group";
import { EmbeddedLoginAccess } from "@/components/auth/embedded-login-access";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type AdminSection = "today" | "events" | "needs" | "drafts" | "new" | "loadsOfLove" | "reports" | "settings";
type NavBadgeKey = "drafts" | "events" | "reports";

type AdminNavItem = {
  value: AdminSection | "calendar";
  label: string;
  href: string;
  icon: LucideIcon;
  group: "work" | "system";
  badgeKey?: NavBadgeKey;
  className?: string;
};

type PledgeWithEventRoles = Pledge & {
  selectedEventRoles?: Array<{
    id: number;
    name: string;
    slotDate?: string | null;
    startTime: string;
    endTime: string;
    quantity?: number;
  }>;
};

type EventEntry = {
  event: Need;
  signups: PledgeWithEventRoles[];
  participantCount: number;
  eventLastDate: string | null;
  latestSignupAt: number;
};

type OperationAction = {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  variant?: "default" | "outline";
};

type OperationDayEmailOption = {
  dateKey: string;
  label: string;
  emailCount: number;
  onClick: () => void;
};

type OperationItem = {
  key: string;
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  detail: string;
  tone?: "default" | "attention" | "success";
  actions: OperationAction[];
  dayEmailOptions?: OperationDayEmailOption[];
};

type LoadsOfLoveRegistrationStatus = "confirmed" | "waitlist" | "cancelled" | "no-show";
type LoadsOfLoveAdminView = "dashboard" | "registrations";

type LoadsOfLoveAdminOverview = {
  stats: {
    activeEvents: number;
    totalRegistrations: number;
    confirmedRegistrations: number;
    waitlistCount: number;
    cancelledCount: number;
    noShowCount: number;
    blacklistCount: number;
    noShowRate: number;
  };
  upcomingEvents: Array<{
    id: string;
    title: string;
    description: string | null;
    date: string;
    location: string;
    laundromatName: string | null;
    laundromatAddress: string | null;
    capacity: number;
    confirmedCount: number;
    waitlistCount: number;
    slots: Array<{
      id: string;
      startTime: string;
      endTime: string;
      capacity: number;
      confirmedCount: number;
      waitlistCount: number;
    }>;
    registrations: LoadsOfLoveRegistration[];
  }>;
  recentRegistrations: LoadsOfLoveRegistration[];
  blacklist: Array<{
    id: string;
    name: string;
    email: string;
    phone: string;
    reason: string;
    createdAt: string;
  }>;
};

type LoadsOfLoveRegistration = {
  id: string;
  timeSlotId: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  status: LoadsOfLoveRegistrationStatus;
  createdAt: string;
  updatedAt: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  slotStartTime: string;
  slotEndTime: string;
};

function getLoadsOfLoveEventStart(event: LoadsOfLoveAdminOverview["upcomingEvents"][number]): string {
  return event.slots.reduce<string | null>((earliest, slot) => {
    if (!earliest) return slot.startTime;
    return new Date(slot.startTime).getTime() < new Date(earliest).getTime() ? slot.startTime : earliest;
  }, null) || event.date;
}

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { value: "today", label: "Today", href: "/admin", icon: LayoutDashboard, group: "work" },
  { value: "events", label: "Events", href: "/admin/events", icon: CalendarCheck2, group: "work", badgeKey: "events" },
  { value: "needs", label: "Needs", href: "/admin/needs", icon: HandHelping, group: "work" },
  { value: "drafts", label: "Drafts", href: "/admin/drafts", icon: FileEdit, group: "work", badgeKey: "drafts" },
  { value: "new", label: "Post a need", href: "/admin/new", icon: PlusCircle, group: "work", className: "onboarding-admin-create" },
  { value: "calendar", label: "Calendar", href: "/admin/calendar", icon: CalendarDays, group: "work" },
  { value: "reports", label: "Reports", href: "/admin/reports", icon: BarChart3, group: "system", badgeKey: "reports" },
  { value: "settings", label: "Settings", href: "/admin/settings", icon: Settings, group: "system" },
];

const SECTION_COPY: Record<AdminSection, { title: string; subtitle: string }> = {
  today: {
    title: "Today",
    subtitle: "Review the work that needs attention and jump straight to the next action.",
  },
  events: {
    title: "Events",
    subtitle: "Manage event sign-ups, slots, participant communication, and ended events.",
  },
  needs: {
    title: "Needs",
    subtitle: "Find published needs and take action without digging through menus.",
  },
  drafts: {
    title: "Drafts",
    subtitle: "Finish, publish, duplicate, or remove needs that are not public yet.",
  },
  new: {
    title: "Post a need",
    subtitle: "Create a new volunteer, event, item, or funding need.",
  },
  loadsOfLove: {
    title: "Program Registrations",
    subtitle: "Legacy program workspace. Use Events for VFW sign-ups.",
  },
  reports: {
    title: "Reports",
    subtitle: "Review activity and export pledge, volunteer, and sign-up data.",
  },
  settings: {
    title: "Settings",
    subtitle: "Manage categories, admin access, notifications, and email service health.",
  },
};

const PUBLISHED_NEED_STATUSES = [
  NeedStatus.FLOATING,
  NeedStatus.PLEDGED,
  NeedStatus.FULFILLED,
  NeedStatus.UNFULFILLED,
  NeedStatus.RECURRING,
];

const TASK_BOARD_DONE_STORAGE_KEY = "clh-admin-task-board-done";

function readDoneTaskKeys(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(TASK_BOARD_DONE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function persistDoneTaskKeys(keys: Set<string>) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(TASK_BOARD_DONE_STORAGE_KEY, JSON.stringify(Array.from(keys)));
  } catch {
    // If storage is blocked, the current session still updates through React state.
  }
}

function normalizeCategoryToken(value?: string | null): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseNeedCategorySelections(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  } catch {
    return raw
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }
}

function getNeedCategoryValues(need: Need): string[] {
  return [
    ...parseNeedCategorySelections(need.categorySelections),
    need.category,
  ].filter((value): value is string => Boolean(value));
}

function needMatchesCategory(need: Need, category: Category): boolean {
  const categoryToken = normalizeCategoryToken(category.slug);
  return getNeedCategoryValues(need).some((value) => normalizeCategoryToken(value) === categoryToken);
}

function needMatchesSearch(need: Need, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [
    need.title,
    need.description,
    need.recipientName,
    ...getNeedCategoryValues(need),
  ]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(normalizedQuery));
}

function getAdminSection(path: string): AdminSection {
  if (path === "/admin/events") return "events";
  if (path === "/admin/needs") return "needs";
  if (path === "/admin/drafts") return "drafts";
  if (path === "/admin/new") return "new";
  if (path === "/admin/program-registrations") return "loadsOfLove";
  if (path === "/admin/reports") return "reports";
  if (path === "/admin/settings") return "settings";
  return "today";
}

function toTimestamp(value?: string | Date | null): number {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function formatShortDate(value?: string | Date | null): string {
  return formatDateInNewYork(value, { month: "short", day: "numeric", year: "numeric" }) || "Date not set";
}

function normalizeSlotDateKey(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const dateOnlyMatch = trimmed.match(/^\d{4}-\d{2}-\d{2}/);
  if (dateOnlyMatch) return dateOnlyMatch[0];

  const timestamp = new Date(trimmed).getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : null;
}

function formatSlotDateLabel(dateKey: string): string {
  return formatDateInNewYork(dateKey, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }) || dateKey;
}

function formatDateTimeInNewYork(value?: string | Date | null): string {
  return formatDateInNewYork(value, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }) || "Date not set";
}

function formatTimeInNewYork(value?: string | Date | null): string {
  return formatDateInNewYork(value, {
    hour: "numeric",
    minute: "2-digit",
  }) || "Time not set";
}

function collectUniqueEmails(pledges: PledgeWithEventRoles[]): string[] {
  return Array.from(
    new Set(
      pledges
        .map((pledge) => (pledge.email || "").trim())
        .filter((email) => email.length > 0)
        .map((email) => email.toLowerCase()),
    ),
  );
}

function getPledgesForSlotDate(pledges: PledgeWithEventRoles[], dateKey: string): PledgeWithEventRoles[] {
  return pledges.filter((pledge) =>
    (pledge.selectedEventRoles || []).some((role) => normalizeSlotDateKey(role.slotDate) === dateKey),
  );
}

function getEventSignupDayOptions(pledges: PledgeWithEventRoles[]) {
  const dateKeys = Array.from(
    new Set(
      pledges.flatMap((pledge) =>
        (pledge.selectedEventRoles || [])
          .map((role) => normalizeSlotDateKey(role.slotDate))
          .filter((dateKey): dateKey is string => Boolean(dateKey)),
      ),
    ),
  ).sort();

  return dateKeys.map((dateKey) => {
    const pledgesForDay = getPledgesForSlotDate(pledges, dateKey);
    return {
      dateKey,
      label: formatSlotDateLabel(dateKey),
      emailCount: collectUniqueEmails(pledgesForDay).length,
      pledges: pledgesForDay,
    };
  });
}

function getCurrentDateInNewYork(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return year && month && day ? `${year}-${month}-${day}` : "";
}

function getEventLastDate(need: Need): string | null {
  return need.endDate || need.eventDate || need.neededBy || need.startDate || null;
}

function hasEventEnded(need: Need): boolean {
  if (need.status === NeedStatus.FULFILLED) return true;
  const eventLastDate = getEventLastDate(need);
  return Boolean(eventLastDate && getCurrentDateInNewYork() > eventLastDate);
}

function getSignupParticipantCount(signup: PledgeWithEventRoles): number {
  const selectedRoles = signup.selectedEventRoles || [];
  if (selectedRoles.length === 0) return 1;
  const participantCount = selectedRoles.reduce((maxCount, role) => {
    const quantity = Number(role.quantity);
    const normalizedQuantity = Number.isInteger(quantity) && quantity > 0 ? quantity : 1;
    return Math.max(maxCount, normalizedQuantity);
  }, 0);
  return participantCount > 0 ? participantCount : 1;
}

const AdminDashboard = () => {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const activeSection = getAdminSection(location);
  const [selectedNeedCategory, setSelectedNeedCategory] = useState("all");
  const [needSearch, setNeedSearch] = useState("");
  const [doneTaskKeys, setDoneTaskKeys] = useState<Set<string>>(() => new Set(readDoneTaskKeys()));
  const { data: stats } = useStats();
  const { data: categories } = useCategories();

  const { data: needs } = useQuery<Need[]>({
    queryKey: ["/api/needs"],
  });

  const { data: pledgesByNeedId } = useQuery<Record<string, PledgeWithEventRoles[]>>({
    queryKey: ["/api/all-pledges"],
    enabled: !!needs,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: NeedStatus }) => {
      const res = await apiRequest("PATCH", `/api/needs/${id}/status`, { status });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/needs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/all-pledges"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not update status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const firstName = useMemo(() => {
    const username = user?.username?.trim();
    if (!username) return "there";
    const base = username.includes("@") ? username.split("@")[0] : username;
    const token = base.split(/[._-]/)[0] || base;
    return token.charAt(0).toUpperCase() + token.slice(1);
  }, [user?.username]);

  const eventEntries = useMemo<EventEntry[]>(() => {
    return (needs || [])
      .filter((need) => need.needType === NeedType.EVENT)
      .map((event) => {
        const signups = [...(pledgesByNeedId?.[String(event.id)] || [])].sort(
          (a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt),
        );
        return {
          event,
          signups,
          participantCount: signups.reduce((sum, signup) => sum + getSignupParticipantCount(signup), 0),
          eventLastDate: getEventLastDate(event),
          latestSignupAt: signups[0] ? toTimestamp(signups[0].createdAt) : 0,
        };
      });
  }, [needs, pledgesByNeedId]);

  const currentEvents = useMemo(
    () =>
      eventEntries
        .filter(({ event }) => !hasEventEnded(event))
        .sort((a, b) => toTimestamp(a.eventLastDate) - toTimestamp(b.eventLastDate)),
    [eventEntries],
  );

  const endedEvents = useMemo(
    () =>
      eventEntries
        .filter(({ event }) => hasEventEnded(event))
        .sort((a, b) => toTimestamp(b.eventLastDate) - toTimestamp(a.eventLastDate)),
    [eventEntries],
  );

  const eventSignupCount = useMemo(
    () => eventEntries.reduce((sum, entry) => sum + entry.signups.length, 0),
    [eventEntries],
  );

  const navBadgeCounts = useMemo<Record<NavBadgeKey, number | null>>(
    () => ({
      drafts: stats?.draftNeeds ?? null,
      events: currentEvents.length,
      reports: stats?.totalPledges ?? null,
    }),
    [currentEvents.length, stats],
  );

  const categoryOptions = useMemo(
    () => [...(categories || [])].sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name)),
    [categories],
  );

  const publishedNeeds = useMemo(
    () =>
      (needs || [])
        .filter((need) => PUBLISHED_NEED_STATUSES.includes(need.status as NeedStatus))
        .sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt)),
    [needs],
  );

  const searchedPublishedNeeds = useMemo(
    () => publishedNeeds.filter((need) => needMatchesSearch(need, needSearch)),
    [needSearch, publishedNeeds],
  );

  const categoryFilterOptions = useMemo(
    () =>
      categoryOptions
        .map((category) => ({
          category,
          count: searchedPublishedNeeds.filter((need) => needMatchesCategory(need, category)).length,
        }))
        .filter((option) => option.count > 0 || option.category.slug === selectedNeedCategory),
    [categoryOptions, searchedPublishedNeeds, selectedNeedCategory],
  );

  const selectedCategoryOption =
    selectedNeedCategory === "all"
      ? null
      : categoryOptions.find((category) => category.slug === selectedNeedCategory) ?? null;

  const selectedPublishedNeeds = useMemo(() => {
    if (!selectedCategoryOption) return searchedPublishedNeeds;
    return searchedPublishedNeeds.filter((need) => needMatchesCategory(need, selectedCategoryOption));
  }, [searchedPublishedNeeds, selectedCategoryOption]);

  const selectedCategoryLabel = selectedCategoryOption?.name ?? "All Categories";

  const openPledgeEmailDraft = async (need: Need, pledgeRows?: PledgeWithEventRoles[], scopeLabel?: string) => {
    const rows = pledgeRows ?? pledgesByNeedId?.[String(need.id)] ?? [];
    const uniqueEmails = collectUniqueEmails(rows);

    if (uniqueEmails.length === 0) {
      window.alert(
        scopeLabel
          ? `No email addresses are available for "${need.title}" on ${scopeLabel}.`
          : `No email addresses are available for "${need.title}".`,
      );
      return;
    }

    const copied = await copyTextToClipboard(uniqueEmails.join(", "));
    openEmailDraft(buildEmailDraftUrl({ bcc: uniqueEmails, subject: need.title }));
    toast({
      title: "Email draft opened",
      description: copied
        ? "Participant emails were also copied to your clipboard."
        : "If your email app did not open, copy the participant emails from the sign-up list.",
      variant: copied ? "default" : "destructive",
    });
  };

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => navigate("/"),
    });
  };

  const markTaskDone = (key: string) => {
    setDoneTaskKeys((current) => {
      if (current.has(key)) return current;
      const next = new Set(current);
      next.add(key);
      persistDoneTaskKeys(next);
      return next;
    });
  };

  const navigateToSection = (section: AdminSection | "calendar") => {
    const item = ADMIN_NAV_ITEMS.find((navItem) => navItem.value === section);
    navigate(item?.href ?? "/admin");
  };

  const mapAssistantTarget = (target: string): AdminSection | "calendar" => {
    const targetMap: Record<string, AdminSection | "calendar"> = {
      home: "today",
      today: "today",
      manage: "needs",
      needs: "needs",
      create: "new",
      new: "new",
      "event-signups": "events",
      events: "events",
      drafts: "drafts",
      overview: "reports",
      exports: "reports",
      reports: "reports",
      categories: "settings",
      admins: "settings",
      email: "settings",
      settings: "settings",
      calendar: "calendar",
      registrations: "events",
    };
    return targetMap[target] ?? "needs";
  };

  const handleAsk = async (query: string): Promise<{ answer?: string } | void> => {
    const routeLocally = () => {
      const q = query.toLowerCase();
      if (/\b(post|create|add|start|new)\b/.test(q) && /need/.test(q)) {
        navigate("/admin/new");
      } else if (/event|sign[\s-]?ups?|volunteer/.test(q)) {
        navigate("/admin/events");
      } else if (/\bdraft/.test(q)) {
        navigate("/admin/drafts");
      } else {
        setNeedSearch(query);
        navigate("/admin/needs");
      }
    };

    try {
      const response = await fetch("/api/admin/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ query }),
      });
      if (!response.ok) throw new Error(`assistant ${response.status}`);
      const action = (await response.json()) as
        | { kind: "search"; query?: string }
        | { kind: "navigate"; target: string }
        | { kind: "answer"; message: string };

      if (action.kind === "navigate") {
        navigateToSection(mapAssistantTarget(action.target));
        return;
      }
      if (action.kind === "answer") {
        return { answer: action.message };
      }
      setNeedSearch(action.query ?? query);
      navigate("/admin/needs");
    } catch (error) {
      routeLocally();
    }
  };

  const operationItems = useMemo<OperationItem[]>(() => {
    const items: OperationItem[] = [];
    const drafts = (needs || [])
      .filter((need) => need.status === NeedStatus.DRAFT)
      .sort((a, b) => toTimestamp(b.updatedAt) - toTimestamp(a.updatedAt));
    const openNeedsWithPledges = publishedNeeds
      .filter((need) => need.needType !== NeedType.EVENT)
      .filter((need) => need.status !== NeedStatus.FULFILLED && need.status !== NeedStatus.UNFULFILLED)
      .map((need) => ({ need, pledges: pledgesByNeedId?.[String(need.id)] || [] }))
      .filter((entry) => entry.pledges.length > 0)
      .sort((a, b) => b.pledges.length - a.pledges.length);
    const staleOpenNeeds = publishedNeeds
      .filter((need) => need.needType !== NeedType.EVENT)
      .filter((need) => need.status === NeedStatus.FLOATING || need.status === NeedStatus.RECURRING)
      .filter((need) => (pledgesByNeedId?.[String(need.id)] || []).length === 0)
      .filter((need) => Date.now() - toTimestamp(need.createdAt) > 10 * 24 * 60 * 60 * 1000)
      .slice(0, 3);
    const getDayEmailOptions = (event: Need, signups: PledgeWithEventRoles[]): OperationDayEmailOption[] => {
      const dayOptions = getEventSignupDayOptions(signups);
      if (dayOptions.length <= 1) return [];

      return dayOptions.map((dayOption) => ({
        dateKey: dayOption.dateKey,
        label: dayOption.label,
        emailCount: dayOption.emailCount,
        onClick: () => openPledgeEmailDraft(event, dayOption.pledges, dayOption.label),
      }));
    };

    for (const entry of eventEntries.filter((eventEntry) => eventEntry.latestSignupAt > 0).sort((a, b) => b.latestSignupAt - a.latestSignupAt).slice(0, 3)) {
      items.push({
        key: `signup-${entry.event.id}-${entry.latestSignupAt}`,
        icon: Users,
        eyebrow: "New sign-ups",
        title: entry.event.title,
        detail: `${entry.signups.length} sign-up${entry.signups.length === 1 ? "" : "s"} for ${formatShortDate(entry.eventLastDate)}`,
        tone: "success",
        actions: [
          { label: "View sign-ups", icon: ArrowRight, onClick: () => navigate("/admin/events") },
          { label: "Email participants", icon: Mail, variant: "outline", onClick: () => openPledgeEmailDraft(entry.event, entry.signups) },
        ],
        dayEmailOptions: getDayEmailOptions(entry.event, entry.signups),
      });
    }

    for (const entry of currentEvents.slice(0, 3)) {
      const participantActions: OperationAction[] =
        entry.participantCount > 0
          ? [{ label: "Email participants", icon: Mail, variant: "outline", onClick: () => openPledgeEmailDraft(entry.event, entry.signups) }]
          : [];
      items.push({
        key: `event-${entry.event.id}-${entry.eventLastDate ?? "unscheduled"}-${entry.participantCount}`,
        icon: CalendarCheck2,
        eyebrow: "Upcoming event",
        title: entry.event.title,
        detail: `${formatShortDate(entry.eventLastDate)} · ${entry.participantCount} participant${entry.participantCount === 1 ? "" : "s"}`,
        actions: [
          { label: "Manage event", icon: ArrowRight, onClick: () => navigate("/admin/events") },
          ...participantActions,
          { label: "Open public page", icon: ExternalLink, variant: "outline", onClick: () => window.open(buildNeedShareUrl(entry.event.id), "_blank", "noopener,noreferrer") },
        ],
        dayEmailOptions: getDayEmailOptions(entry.event, entry.signups),
      });
    }

    for (const entry of endedEvents.slice(0, 2)) {
      items.push({
        key: `ended-${entry.event.id}-${entry.eventLastDate ?? "unscheduled"}`,
        icon: CheckCircle,
        eyebrow: "Ended event",
        title: entry.event.title,
        detail: `${formatShortDate(entry.eventLastDate)} · review participant history`,
        tone: "attention",
        actions: [
          { label: "Review", icon: ArrowRight, onClick: () => navigate("/admin/events") },
          ...(entry.participantCount > 0
            ? [{ label: "Email participants", icon: Mail, variant: "outline" as const, onClick: () => openPledgeEmailDraft(entry.event, entry.signups) }]
            : []),
          { label: "Edit", icon: FileEdit, variant: "outline", onClick: () => navigate(`/admin/needs/${entry.event.id}/edit`) },
        ],
        dayEmailOptions: getDayEmailOptions(entry.event, entry.signups),
      });
    }

    for (const need of drafts.slice(0, 3)) {
      items.push({
        key: `draft-${need.id}-${toTimestamp(need.updatedAt || need.createdAt)}`,
        icon: FileEdit,
        eyebrow: "Draft waiting",
        title: need.title,
        detail: `Updated ${formatShortDate(need.updatedAt || need.createdAt)}`,
        tone: "attention",
        actions: [
          { label: "Continue editing", icon: FileEdit, onClick: () => navigate(`/admin/needs/${need.id}/edit`) },
          { label: "Publish", icon: CheckCircle, variant: "outline", onClick: () => updateStatusMutation.mutate({ id: need.id, status: NeedStatus.FLOATING }) },
        ],
      });
    }

    for (const { need, pledges } of openNeedsWithPledges.slice(0, 3)) {
      const latestPledgeAt = pledges.reduce((latest, pledge) => Math.max(latest, toTimestamp(pledge.createdAt)), 0);
      items.push({
        key: `pledged-${need.id}-${pledges.length}-${latestPledgeAt}`,
        icon: HandHelping,
        eyebrow: "Need has helpers",
        title: need.title,
        detail: `${pledges.length} helper${pledges.length === 1 ? "" : "s"} pledged`,
        actions: [
          { label: "Email helpers", icon: Mail, onClick: () => openPledgeEmailDraft(need, pledges) },
          { label: "Mark fulfilled", icon: CheckCircle, variant: "outline", onClick: () => updateStatusMutation.mutate({ id: need.id, status: NeedStatus.FULFILLED }) },
        ],
      });
    }

    for (const need of staleOpenNeeds) {
      items.push({
        key: `stale-${need.id}-${toTimestamp(need.createdAt)}`,
        icon: Clock,
        eyebrow: "Open with no pledges",
        title: need.title,
        detail: `Posted ${formatShortDate(need.createdAt)} · may need follow-up`,
        tone: "attention",
        actions: [
          { label: "Edit", icon: FileEdit, onClick: () => navigate(`/admin/needs/${need.id}/edit`) },
          { label: "Open public page", icon: ExternalLink, variant: "outline", onClick: () => window.open(buildNeedShareUrl(need.id), "_blank", "noopener,noreferrer") },
        ],
      });
    }

    return items.filter((item) => !doneTaskKeys.has(item.key)).slice(0, 12);
  }, [currentEvents, doneTaskKeys, endedEvents, eventEntries, needs, navigate, pledgesByNeedId, publishedNeeds, updateStatusMutation]);

  const renderNavButton = (item: AdminNavItem) => {
    const Icon = item.icon;
    const isActive = item.value === "calendar" ? location === "/admin/calendar" : activeSection === item.value;
    const badgeCount = item.badgeKey ? navBadgeCounts[item.badgeKey] : null;
    const showBadge = badgeCount !== null && (badgeCount > 0 || isActive);

    return (
      <button
        key={item.value}
        type="button"
        onClick={() => navigate(item.href)}
        className={cn(
          "flex min-h-11 w-full items-center justify-between rounded-[1rem] border px-3 py-2 text-left text-sm font-medium transition-colors",
          isActive
            ? "border-slate-900 bg-slate-900 text-white"
            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
          item.className,
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-current" : "text-slate-500")} />
          <span className="truncate">{item.label}</span>
        </span>
        {showBadge ? (
          <span className={cn("inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold", isActive ? "bg-white/15 text-white" : "bg-slate-100 text-slate-700")}>
            {badgeCount}
          </span>
        ) : null}
      </button>
    );
  };

  const sidebar = (
    <div className="space-y-4">
      <div className="rounded-[1.25rem] bg-slate-50 p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-slate-900 text-white">
            <LayoutDashboard className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{user?.username}</p>
            <p className="text-xs text-slate-500">Administrator</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Work</p>
        {ADMIN_NAV_ITEMS.filter((item) => item.group === "work").map(renderNavButton)}
      </div>

      <div className="space-y-2">
        <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">System</p>
        {ADMIN_NAV_ITEMS.filter((item) => item.group === "system").map(renderNavButton)}
      </div>
    </div>
  );

  const renderNeedsWorkspace = () => (
    <InsetGroup className="p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900">Published Needs</h2>
          <p className="text-sm text-slate-500">Search, filter, contact helpers, edit, and close needs from one place.</p>
        </div>
        <Button onClick={() => navigate("/admin/new")}>
          <PlusCircle className="h-4 w-4" />
          Post a need
        </Button>
      </div>
      {publishedNeeds.length > 0 ? (
        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={needSearch}
              onChange={(event) => setNeedSearch(event.target.value)}
              placeholder="Search needs by title, description, recipient, or category"
              className="h-11 bg-white pl-10"
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedNeedCategory("all")}
                className={cn(
                  "inline-flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                  selectedNeedCategory === "all"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100",
                )}
              >
                <span>All Categories</span>
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", selectedNeedCategory === "all" ? "bg-white/15 text-white" : "bg-slate-100 text-slate-600")}>
                  {searchedPublishedNeeds.length}
                </span>
              </button>
              {categoryFilterOptions.map(({ category, count }) => {
                const isSelected = selectedNeedCategory === category.slug;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setSelectedNeedCategory(category.slug)}
                    className={cn(
                      "inline-flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                      isSelected
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100",
                    )}
                  >
                    <span>{category.name}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", isSelected ? "bg-white/15 text-white" : "bg-slate-100 text-slate-600")}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
              <h3 className="truncate text-base font-semibold text-slate-900">{selectedCategoryLabel}</h3>
              <span className="inline-flex min-w-[2rem] shrink-0 items-center justify-center rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">
                {selectedPublishedNeeds.length}
              </span>
            </div>
            <NeedsTable needsOverride={selectedPublishedNeeds} pledgesByNeedIdOverride={pledgesByNeedId} />
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
          No published needs found. Create or publish a need to get started.
        </div>
      )}
    </InsetGroup>
  );

  const renderSection = () => {
    if (activeSection === "today") {
      return (
        <div className="space-y-4">
          <OperationsInbox
            items={operationItems}
            openNeedsCount={stats?.openNeeds ?? null}
            draftsCount={stats?.draftNeeds ?? null}
            eventCount={currentEvents.length}
            signupCount={eventSignupCount}
            onAsk={handleAsk}
            onEvents={() => navigate("/admin/events")}
            onNeeds={() => navigate("/admin/needs")}
            onDrafts={() => navigate("/admin/drafts")}
            onNewNeed={() => navigate("/admin/new")}
            onItemDone={markTaskDone}
          />
        </div>
      );
    }

    if (activeSection === "events") {
      return (
        <InsetGroup className="p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-slate-900">Events Workspace</h2>
              <p className="text-sm text-slate-500">Current and ended events with participant actions in reach.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => navigate("/admin/calendar")}>
                <CalendarDays className="h-4 w-4" />
                Calendar
              </Button>
              <Button onClick={() => navigate("/admin/new")}>
                <PlusCircle className="h-4 w-4" />
                New event need
              </Button>
            </div>
          </div>
          <EventSignups />
        </InsetGroup>
      );
    }

    if (activeSection === "needs") {
      return renderNeedsWorkspace();
    }

    if (activeSection === "drafts") {
      return (
        <InsetGroup className="p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-slate-900">Draft Needs</h2>
              <p className="text-sm text-slate-500">Drafts stay private until you review and publish them.</p>
            </div>
            <Button onClick={() => navigate("/admin/new")}>
              <PlusCircle className="h-4 w-4" />
              New draft
            </Button>
          </div>
          <NeedsTable filterStatus={[NeedStatus.DRAFT]} sortByRecent />
        </InsetGroup>
      );
    }

    if (activeSection === "new") {
      return (
        <InsetGroup className="p-4 sm:p-5">
          <div className="mb-4 space-y-1">
            <h2 className="text-lg font-semibold text-slate-900">Create a New Need</h2>
            <p className="text-sm text-slate-500">Create a new need and publish it when ready.</p>
          </div>
          <NeedForm />
        </InsetGroup>
      );
    }

    if (activeSection === "loadsOfLove") {
      return <LoadsOfLoveAdminWorkspace />;
    }

    if (activeSection === "reports") {
      return (
        <div className="space-y-4">
          <DashboardStats />
          <InsetGroup className="p-4 sm:p-5">
            <div className="mb-4 space-y-1">
              <h2 className="text-lg font-semibold text-slate-900">Data Exports</h2>
              <p className="text-sm text-slate-500">Download pledge, volunteer, and event-sign-up data as CSV.</p>
            </div>
            <DataExports />
          </InsetGroup>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <InsetGroup className="p-4 sm:p-5">
          <div className="mb-4 space-y-1">
            <h2 className="text-lg font-semibold text-slate-900">Need Categories</h2>
            <p className="text-sm text-slate-500">Organize how needs appear publicly and which event-specific fields appear in forms.</p>
          </div>
          <CategoryManager />
        </InsetGroup>

        <div className="grid gap-4 xl:grid-cols-2">
          <InsetGroup className="p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-slate-700" />
              <h2 className="text-lg font-semibold text-slate-900">Admin Users</h2>
            </div>
            <p className="mb-4 text-sm text-slate-500">Users in this list have full administrative access.</p>
            <AdminUsersTable />
          </InsetGroup>

          <InsetGroup className="p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-[hsl(var(--primary))]" />
              <h2 className="text-lg font-semibold text-slate-900">Create Admin User</h2>
            </div>
            <p className="mb-4 text-sm text-slate-500">Add another admin with full access.</p>
            <AdminUserForm />
          </InsetGroup>
        </div>

        <InsetGroup className="p-4 sm:p-5">
          <NotificationPreferences />
        </InsetGroup>

        <InsetGroup className="p-4 sm:p-5">
          <div className="mb-4 space-y-1">
            <h2 className="text-lg font-semibold text-slate-900">Email Service Health</h2>
            <p className="text-sm text-slate-500">Monitor MailerLite and MailerSend connections.</p>
          </div>
          <EmailStatus />
        </InsetGroup>
      </div>
    );
  };

  return (
    <AdminShell
      title={activeSection === "today" ? `Hi ${firstName}` : SECTION_COPY[activeSection].title}
      subtitle={activeSection === "today" ? SECTION_COPY.today.subtitle : SECTION_COPY[activeSection].subtitle}
      sidebar={sidebar}
      topActions={
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate("/")}>
            <Eye className="h-4 w-4" />
            View Needs
          </Button>
          <Button size="sm" variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      }
    >
      <InsetGroup className="p-4">
        <EmbeddedLoginAccess />
      </InsetGroup>

      {renderSection()}
    </AdminShell>
  );
};

function LoadsOfLoveAdminWorkspace() {
  const [view, setView] = useState<LoadsOfLoveAdminView>("registrations");
  const { data, isLoading, error, refetch, isFetching } = useQuery<LoadsOfLoveAdminOverview>({
    queryKey: ["/api/admin/program-registrations/overview"],
    staleTime: 30_000,
    retry: false,
  });

  const recentActivity = data?.recentRegistrations.map((registration) => {
    let type = "registration";
    let description = `${registration.name} registered for ${registration.eventTitle}`;

    if (registration.status === "cancelled") {
      type = "cancellation";
      description = `${registration.name} cancelled registration for ${registration.eventTitle}`;
    } else if (registration.status === "waitlist") {
      type = "waitlist";
      description = `${registration.name} joined waitlist for ${registration.eventTitle}`;
    } else if (registration.status === "no-show") {
      type = "no_show";
      description = `${registration.name} marked as no-show for ${registration.eventTitle}`;
    }

    return {
      id: registration.id,
      type,
      description,
      timestamp: registration.updatedAt,
    };
  });

  if (view === "registrations") {
    return (
      <div className="space-y-6">
        <LoadsOfLoveSubnav view={view} onChange={setView} />
        <LoadsOfLoveRegistrations
          events={data?.upcomingEvents || []}
          isLoading={isLoading}
          error={error}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <LoadsOfLoveSubnav view={view} onChange={setView} />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Manage events and registrations</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-lg border bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-6 pb-2">
            <CardTitle className="text-sm font-medium tracking-normal">Active Events</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="text-2xl font-bold">{isLoading ? "..." : data?.stats.activeEvents || 0}</div>
          </CardContent>
        </Card>

        <Card className="rounded-lg border bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-6 pb-2">
            <CardTitle className="text-sm font-medium tracking-normal">Total Registrations</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="text-2xl font-bold">{isLoading ? "..." : data?.stats.totalRegistrations || 0}</div>
          </CardContent>
        </Card>

        <Card className="rounded-lg border bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-6 pb-2">
            <CardTitle className="text-sm font-medium tracking-normal">Waitlist</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="text-2xl font-bold">{isLoading ? "..." : data?.stats.waitlistCount || 0}</div>
          </CardContent>
        </Card>

        <Card className="rounded-lg border bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-6 pb-2">
            <CardTitle className="text-sm font-medium tracking-normal">No-show Rate</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="text-2xl font-bold">{isLoading ? "..." : `${data?.stats.noShowRate || 0}%`}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-lg border bg-card shadow-sm">
        <CardHeader className="p-6">
          <CardTitle className="text-2xl tracking-normal">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          {isLoading ? (
            <div className="py-8 text-center text-gray-500">
              <p>Loading activity...</p>
            </div>
          ) : error ? (
            <div className="py-8 text-center text-red-600">
              <p>Unable to load Program Registrations activity.</p>
              <Button className="mt-3" variant="outline" onClick={() => void refetch()} disabled={isFetching}>
                {isFetching ? "Loading..." : "Try again"}
              </Button>
            </div>
          ) : recentActivity && recentActivity.length > 0 ? (
            <div className="space-y-3">
              {recentActivity.slice(0, 10).map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 rounded p-2 hover:bg-gray-50">
                  <div className="mt-1 shrink-0">
                    {activity.type === "registration" && <UserCheck className="h-4 w-4 text-green-600" />}
                    {activity.type === "cancellation" && <UserX className="h-4 w-4 text-red-600" />}
                    {activity.type === "waitlist" && <Clock className="h-4 w-4 text-yellow-600" />}
                    {activity.type === "no_show" && <TrendingDown className="h-4 w-4 text-gray-600" />}
                    {!['registration', 'cancellation', 'waitlist', 'no_show'].includes(activity.type) && (
                      <Activity className="h-4 w-4 text-blue-600" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{activity.description}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(activity.timestamp).toLocaleDateString()} at {new Date(activity.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500">
              <Activity className="mx-auto mb-2 h-8 w-8 text-gray-400" />
              <p>No recent activity found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LoadsOfLoveSubnav({
  view,
  onChange,
}: {
  view: LoadsOfLoveAdminView;
  onChange: (view: LoadsOfLoveAdminView) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
      <Button
        type="button"
        size="sm"
        variant={view === "dashboard" ? "default" : "outline"}
        onClick={() => onChange("dashboard")}
      >
        <LayoutDashboard className="h-4 w-4" />
        Dashboard
      </Button>
      <Button
        type="button"
        size="sm"
        variant={view === "registrations" ? "default" : "outline"}
        onClick={() => onChange("registrations")}
      >
        <Users className="h-4 w-4" />
        Registrations
      </Button>
    </div>
  );
}

function LoadsOfLoveRegistrations({
  events,
  isLoading,
  error,
  onRetry,
}: {
  events: LoadsOfLoveAdminOverview["upcomingEvents"];
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  const filteredEvents = events.filter((event) => {
    const search = searchTerm.trim().toLowerCase();
    if (!search) return true;
    return (
      event.title.toLowerCase().includes(search) ||
      event.registrations.some((registration) =>
        [registration.name, registration.email, registration.phone]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(search)),
      )
    );
  });

  const toggleEvent = (eventId: string) => {
    setExpandedEvents((current) => {
      const next = new Set(current);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  if (isLoading) {
    return <div className="py-12 text-center text-gray-500">Loading registrations...</div>;
  }

  if (error) {
    return (
      <div className="py-12 text-center text-red-600">
        <p>Unable to load Program Registrations registrations.</p>
        <Button className="mt-3" variant="outline" onClick={onRetry}>Try again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Registrations</h1>
          <p className="text-gray-600">View and print registrations by upcoming event</p>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search events or registrations"
            className="pl-9"
          />
        </div>
      </div>

      {filteredEvents.length > 0 ? (
        <div className="space-y-4">
          {filteredEvents.map((event) => {
            const isExpanded = expandedEvents.has(event.id);
            const confirmed = event.registrations.filter((registration) => registration.status === "confirmed");
            const waitlist = event.registrations.filter((registration) => registration.status === "waitlist");
            const printableCount = confirmed.length + waitlist.length;

            return (
              <Card key={event.id} className="overflow-hidden rounded-lg border bg-card shadow-sm">
                <CardHeader className="p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-start gap-3 text-left"
                      onClick={() => toggleEvent(event.id)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="mt-1 h-5 w-5 shrink-0 text-gray-500" />
                      ) : (
                        <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-gray-500" />
                      )}
                      <span className="min-w-0">
                        <span className="block truncate text-base font-semibold text-gray-900">{event.title}</span>
                        <span className="block text-sm text-gray-500">
                          {formatDateTimeInNewYork(getLoadsOfLoveEventStart(event))} · {event.laundromatName || event.location}
                        </span>
                      </span>
                    </button>

                    <div className="flex flex-wrap items-center gap-2 md:justify-end">
                      <span className="rounded-md bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
                        {confirmed.length} confirmed
                      </span>
                      <span className="rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                        {waitlist.length} waitlist
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => printLoadsOfLoveEvent(event)}
                        disabled={printableCount === 0}
                      >
                        <Printer className="h-4 w-4" />
                        Print
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {isExpanded ? (
                  <CardContent className="border-t border-gray-100 p-0">
                    {event.registrations.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px] text-left text-sm">
                          <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
                            <tr>
                              <th className="px-5 py-3">Name</th>
                              <th className="px-5 py-3">Contact</th>
                              <th className="px-5 py-3">Time Slot</th>
                              <th className="px-5 py-3">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {event.registrations.map((registration) => (
                              <tr key={registration.id}>
                                <td className="px-5 py-3 font-medium text-gray-900">{registration.name}</td>
                                <td className="px-5 py-3">
                                  <a className="block text-blue-600 hover:underline" href={`mailto:${registration.email}`}>
                                    {registration.email}
                                  </a>
                                  {registration.phone ? (
                                    <a className="block text-gray-500 hover:underline" href={`tel:${registration.phone}`}>
                                      {registration.phone}
                                    </a>
                                  ) : null}
                                </td>
                                <td className="px-5 py-3 text-gray-600">
                                  {formatTimeInNewYork(registration.slotStartTime)} - {formatTimeInNewYork(registration.slotEndTime)}
                                </td>
                                <td className="px-5 py-3 capitalize text-gray-600">{registration.status}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-8 text-center text-sm text-gray-500">No registrations for this event.</div>
                    )}
                  </CardContent>
                ) : null}
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-gray-500">
          No upcoming event registrations found.
        </div>
      )}
    </div>
  );
}

function printLoadsOfLoveEvent(event: LoadsOfLoveAdminOverview["upcomingEvents"][number]) {
  const escapeHtml = (value: string | number | null | undefined) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const registrations = event.registrations
    .filter((registration) => registration.status === "confirmed" || registration.status === "waitlist")
    .sort((left, right) => {
      const statusOrder = Number(left.status === "waitlist") - Number(right.status === "waitlist");
      return statusOrder || new Date(left.slotStartTime).getTime() - new Date(right.slotStartTime).getTime();
    });

  if (registrations.length === 0) {
    window.alert("No confirmed or waitlist registrations found for this event.");
    return;
  }

  const rows = registrations.map((registration) => {
    const address = [registration.address, registration.city, registration.state, registration.zipCode]
      .filter(Boolean)
      .join(", ");
    return `
      <tr class="${registration.status}">
        <td><strong>${escapeHtml(registration.name)}</strong>${address ? `<div class="muted">${escapeHtml(address)}</div>` : ""}</td>
        <td>${escapeHtml(registration.email)}<div class="muted">${escapeHtml(registration.phone || "")}</div></td>
        <td>${escapeHtml(formatTimeInNewYork(registration.slotStartTime))} - ${escapeHtml(formatTimeInNewYork(registration.slotEndTime))}</td>
        <td>${escapeHtml(registration.status)}</td>
        <td>${escapeHtml(formatDateTimeInNewYork(registration.createdAt))}</td>
      </tr>`;
  }).join("");

  const confirmedCount = registrations.filter((registration) => registration.status === "confirmed").length;
  const waitlistCount = registrations.filter((registration) => registration.status === "waitlist").length;
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  printWindow.document.write(`<!doctype html>
    <html><head><title>${escapeHtml(event.title)} - Registration Report</title>
    <style>
      body{font-family:Arial,sans-serif;color:#333;margin:.5in;font-size:11px}h1{text-align:center;color:#059669;font-size:18px;margin:0 0 5px}.subtitle{text-align:center;color:#666;margin-bottom:15px}.event{background:#f3f4f6;border-left:4px solid #059669;padding:12px;text-align:center;margin-bottom:15px}.summary{font-weight:700;text-align:center;margin:10px 0;color:#059669}table{width:100%;border-collapse:collapse;font-size:9px}th,td{border:1px solid #e5e7eb;padding:7px 6px;text-align:left;vertical-align:top}th{background:#f9fafb}.waitlist{background:#fffbeb}.muted{color:#6b7280;font-size:8px;margin-top:2px}.printed{text-align:center;color:#9ca3af;margin-top:15px;font-size:9px}@media print{body{margin:.3in}th,td{padding:4px 3px;font-size:8px}}
    </style></head><body>
      <h1>VFW Post 7570 - Program Registrations</h1><div class="subtitle">Registration Report</div>
      <div class="event"><strong>${escapeHtml(event.title)}</strong><br>${escapeHtml(formatDateTimeInNewYork(getLoadsOfLoveEventStart(event)))}<br>${escapeHtml(event.laundromatName || event.location)}${event.laundromatAddress ? `<br>${escapeHtml(event.laundromatAddress)}` : ""}</div>
      <div class="summary">${confirmedCount} Confirmed · ${waitlistCount} Waitlist · ${registrations.length} Total</div>
      <table><thead><tr><th>Name</th><th>Contact</th><th>Time Slot</th><th>Status</th><th>Registered</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="printed">Generated ${escapeHtml(formatDateTimeInNewYork(new Date()))}</div>
      <script>setTimeout(function(){window.print()},250)</script>
    </body></html>`);
  printWindow.document.close();
}

function OperationsInbox({
  items,
  openNeedsCount,
  draftsCount,
  eventCount,
  signupCount,
  onAsk,
  onEvents,
  onNeeds,
  onDrafts,
  onNewNeed,
  onItemDone,
}: {
  items: OperationItem[];
  openNeedsCount?: number | null;
  draftsCount?: number | null;
  eventCount: number;
  signupCount: number;
  onAsk: (query: string) => Promise<{ answer?: string } | void>;
  onEvents: () => void;
  onNeeds: () => void;
  onDrafts: () => void;
  onNewNeed: () => void;
  onItemDone: (key: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);

  const ask = async () => {
    const trimmed = query.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setAnswer(null);
    try {
      const result = await onAsk(trimmed);
      if (result?.answer) {
        setAnswer(result.answer);
        setQuery("");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <InsetGroup className="p-4 sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Clock className="h-4 w-4 text-[#197991]" />
              Operations Inbox
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void ask();
                  }}
                  placeholder='Search or type "show paint night sign-ups"'
                  className="h-11 bg-white pl-10"
                  disabled={loading}
                />
              </div>
              <Button onClick={() => void ask()} disabled={loading || !query.trim()}>
                {loading ? "Working..." : "Go"}
              </Button>
            </div>
            {answer ? <p className="rounded-lg bg-[#197991]/10 px-3 py-2 text-sm text-slate-700">{answer}</p> : null}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[420px]">
            <MetricButton label="Events" value={eventCount} onClick={onEvents} />
            <MetricButton label="Sign-ups" value={signupCount} onClick={onEvents} />
            <MetricButton label="Open needs" value={openNeedsCount ?? 0} onClick={onNeeds} />
            <MetricButton label="Drafts" value={draftsCount ?? 0} onClick={onDrafts} />
          </div>
        </div>
      </InsetGroup>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <button
          type="button"
          onClick={onNewNeed}
          className="flex min-h-28 flex-col justify-between rounded-lg border border-[#d14633]/50 bg-white p-4 text-left transition-colors hover:border-[#d14633] hover:bg-[#d14633]/5"
        >
          <PlusCircle className="h-5 w-5 text-[#d14633]" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Post a new need</p>
            <p className="text-xs text-slate-500">Create a need or event without hunting through settings.</p>
          </div>
        </button>
        <button
          type="button"
          onClick={onEvents}
          className="flex min-h-28 flex-col justify-between rounded-lg border border-slate-200 bg-white p-4 text-left transition-colors hover:bg-slate-50"
        >
          <CalendarCheck2 className="h-5 w-5 text-[#197991]" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Manage events</p>
            <p className="text-xs text-slate-500">Sign-ups, slots, participant emails, and close-out work.</p>
          </div>
        </button>
        <button
          type="button"
          onClick={onNeeds}
          className="flex min-h-28 flex-col justify-between rounded-lg border border-slate-200 bg-white p-4 text-left transition-colors hover:bg-slate-50"
        >
          <HandHelping className="h-5 w-5 text-[#197991]" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Manage needs</p>
            <p className="text-xs text-slate-500">Search, contact helpers, edit, and mark fulfilled.</p>
          </div>
        </button>
      </div>

      <InsetGroup className="p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Needs Attention</h2>
            <p className="text-sm text-slate-500">Time-sensitive work and likely next actions.</p>
          </div>
          <Button variant="outline" onClick={onDrafts}>
            Drafts
          </Button>
        </div>

        {items.length > 0 ? (
          <div className="grid gap-3 xl:grid-cols-2">
            {items.map((item) => (
              <OperationCard key={item.key} item={item} onDone={onItemDone} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
            No urgent admin work is waiting right now.
          </div>
        )}
      </InsetGroup>
    </div>
  );
}

function MetricButton({ label, value, onClick }: { label: string; value: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition-colors hover:bg-slate-50"
    >
      <p className="text-lg font-semibold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </button>
  );
}

function OperationCard({ item, onDone }: { item: OperationItem; onDone: (key: string) => void }) {
  const Icon = item.icon;
  const toneClass =
    item.tone === "attention"
      ? "border-amber-200 bg-amber-50/40"
      : item.tone === "success"
        ? "border-emerald-200 bg-emerald-50/40"
        : "border-slate-200 bg-white";

  return (
    <div className={cn("rounded-lg border p-4", toneClass)}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[#197991] shadow-sm">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{item.eyebrow}</p>
          <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
          <p className="text-xs text-slate-600">{item.detail}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {item.actions.map((action) => {
          const ActionIcon = action.icon;
          return (
            <Button
              key={action.label}
              type="button"
              size="sm"
              variant={action.variant ?? "default"}
              onClick={action.onClick}
            >
              <ActionIcon className="h-4 w-4" />
              {action.label}
            </Button>
          );
        })}
        {item.dayEmailOptions && item.dayEmailOptions.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" variant="outline">
                <CalendarDays className="h-4 w-4" />
                Email by day
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[16rem]">
              <DropdownMenuLabel>Choose a day</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {item.dayEmailOptions.map((dayOption) => (
                <DropdownMenuItem
                  key={dayOption.dateKey}
                  onClick={dayOption.onClick}
                  disabled={dayOption.emailCount === 0}
                >
                  <CalendarDays className="mr-2 h-4 w-4" />
                  <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                    <span className="truncate">{dayOption.label}</span>
                    <span className="shrink-0 text-xs text-slate-500">
                      {dayOption.emailCount} email{dayOption.emailCount === 1 ? "" : "s"}
                    </span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        <Button type="button" size="sm" variant="outline" onClick={() => onDone(item.key)}>
          <CheckCircle className="h-4 w-4" />
          Done
        </Button>
      </div>
    </div>
  );
}

export default AdminDashboard;
