import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Need, NeedStatus, NeedType } from "@shared/schema";
import NeedCard from "./need-card";
import { PublicCalendar } from "@/components/calendar/public-calendar";
import ShareDialog from "@/components/share-dialog";
import NeedForm from "@/components/admin/need-form";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Star, Plus, ShoppingCart, Shirt, Users, BookOpen, Home, Calendar, Heart, LayoutGrid,
  Utensils, Briefcase, GraduationCap, Building, HelpCircle, Gift, GripVertical, Share,
  SlidersHorizontal, Check, ChevronDown, CalendarDays, type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useCategories } from "@/hooks/use-categories";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { buildNeedsTabShareUrl } from "@/lib/public-url";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import type { CalendarOccurrence } from "@/lib/calendar-domain";
import type { NeedListItem } from "@/types/need-list-item";

// Map icon names (stored in DB) to Lucide components
const iconMap: Record<string, LucideIcon> = {
  ShoppingCart, Shirt, Users, BookOpen, Home, Calendar, Heart, LayoutGrid,
  Utensils, Briefcase, GraduationCap, Building, HelpCircle, Gift, Star, Plus,
};

function getIcon(name: string): LucideIcon {
  return iconMap[name] || Heart;
}

function getNeedDisplayOrder(need: Need): number {
  return typeof need.displayOrder === "number" ? need.displayOrder : Number.MAX_SAFE_INTEGER;
}

// Sortable category tab wrapper
function SortableCategoryTab({
  id,
  tabValue,
  isActive,
  onClick,
  icon: Icon,
  label,
  isAdmin,
}: {
  id: string;
  tabValue: string;
  isActive: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
  isAdmin: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group/tab flex-shrink-0">
      <button
        onClick={onClick}
        data-category-tab={tabValue}
        className={`flex h-[74px] w-[88px] flex-col items-center justify-center gap-1.5 rounded-[1rem] border-2 bg-white px-2 py-2 text-center transition-colors lg:h-[78px] lg:w-[92px] ${
          isActive
            ? "border-[hsl(var(--primary))] text-[hsl(var(--primary))]"
            : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-800"
        }`}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span className="text-[10px] font-medium leading-[1.05] lg:text-[11px]">{label}</span>
      </button>
      {/* Drag handle — only for admin, shown on hover */}
      {isAdmin && (
        <div
          {...attributes}
          {...listeners}
          className="absolute -top-2 left-1/2 z-10 -translate-x-1/2 cursor-grab rounded-full border bg-white/90 p-0.5 opacity-0 shadow-sm transition-opacity group-hover/tab:opacity-100 active:cursor-grabbing"
          title="Drag to reorder"
        >
          <GripVertical className="w-3.5 h-3.5 text-gray-400" />
        </div>
      )}
    </div>
  );
}

// Sortable need card wrapper
function SortableNeedCard({
  need,
  isAdmin,
  onCardClick,
  onPledge,
  onEdit,
  onDuplicateAndEdit,
  onDelete,
  onToggleHighlight,
}: {
  need: NeedListItem;
  isAdmin: boolean;
  onCardClick: (need: NeedListItem) => void;
  onPledge?: (need: NeedListItem) => void;
  onEdit: (need: NeedListItem) => void;
  onDuplicateAndEdit: (need: NeedListItem) => void;
  onDelete: (need: NeedListItem) => void;
  onToggleHighlight: (need: NeedListItem) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: need.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group/sortable">
      <NeedCard
        need={need}
        onCardClick={onCardClick}
        onPledge={onPledge}
        isAdmin={isAdmin}
        onEdit={onEdit}
        onDuplicateAndEdit={onDuplicateAndEdit}
        onDelete={onDelete}
        onToggleHighlight={onToggleHighlight}
      />
      {/* Drag handle for admin */}
      {isAdmin && (
        <div
          {...attributes}
          {...listeners}
          className="absolute top-2 left-1/2 -translate-x-1/2 md:top-14 md:left-2 md:translate-x-0 opacity-0 group-hover/sortable:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-20 bg-white/90 rounded-full px-2 py-1 shadow-md border flex items-center gap-1"
          title="Drag to reorder"
        >
          <GripVertical className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-[10px] text-gray-400 font-medium">Drag</span>
        </div>
      )}
    </div>
  );
}

const sortModes = [
  { value: "priority", label: "Most Urgent First" },
  { value: "neededBy", label: "Soonest Date First" },
  { value: "neededMonth", label: "Month Needed" },
] as const;

type SortMode = (typeof sortModes)[number]["value"];

const UPCOMING_EVENTS_TAB_VALUE = "upcoming_events";
const UPCOMING_EVENTS_TAB_LABEL = "Upcoming Needs";
const UPCOMING_WINDOW_DAYS = 30;

function normalizeCategoryToken(value?: string | null): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function categoriesMatch(left?: string | null, right?: string | null): boolean {
  return normalizeCategoryToken(left) === normalizeCategoryToken(right);
}

function isUpcomingEventsTabValue(value?: string | null): boolean {
  return normalizeCategoryToken(value) === normalizeCategoryToken(UPCOMING_EVENTS_TAB_VALUE);
}

function isLegacyEventsCategory(value?: string | null, label?: string | null): boolean {
  const valueToken = normalizeCategoryToken(value);
  const labelToken = normalizeCategoryToken(label);
  return valueToken === "event" || valueToken === "events" || labelToken === "event" || labelToken === "events";
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

function getNeedCategoryValues(need: Pick<Need, "category" | "categorySelections">): string[] {
  const parsedSelections = parseNeedCategorySelections(need.categorySelections);
  if (parsedSelections.length > 0) {
    return Array.from(new Set(parsedSelections));
  }
  const fallback = (need.category || "").trim();
  return fallback ? [fallback] : [];
}

function needMatchesCategory(need: Pick<Need, "category" | "categorySelections">, targetCategory?: string | null): boolean {
  const targetToken = normalizeCategoryToken(targetCategory);
  if (!targetToken) return false;
  return getNeedCategoryValues(need).some(
    (category) => normalizeCategoryToken(category) === targetToken,
  );
}

function getDeepLinkSearchParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();

  const url = new URL(window.location.href);
  const searchParams = new URLSearchParams(url.search);
  const hasKnownParams = ["tab", "sort", "need"].some((key) =>
    searchParams.has(key),
  );
  if (hasKnownParams) {
    return searchParams;
  }

  const hashQueryIndex = url.hash.indexOf("?");
  if (hashQueryIndex >= 0) {
    return new URLSearchParams(url.hash.slice(hashQueryIndex + 1));
  }

  return searchParams;
}

function parseDateStringToTimestamp(dateValue?: string | null): number | null {
  if (!dateValue) return null;
  const [year, month, day] = dateValue.split("-").map(Number);
  if (!year || !month || !day) return null;
  // Noon UTC avoids timezone boundary drift while preserving date-only ordering.
  return Date.UTC(year, month - 1, day, 12, 0, 0);
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

  if (!year || !month || !day) {
    return "";
  }

  return `${year}-${month}-${day}`;
}

function toDateOnlyString(value?: string | Date | null): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function isDateWithinUpcomingWindow(dateValue?: string | Date | null, days = UPCOMING_WINDOW_DAYS): boolean {
  const normalizedDate = toDateOnlyString(dateValue);
  const target = parseDateStringToTimestamp(normalizedDate);
  const today = parseDateStringToTimestamp(getCurrentDateInNewYork());
  if (target === null || today === null) {
    return false;
  }

  const windowEnd = today + days * 24 * 60 * 60 * 1000;
  return target >= today && target <= windowEnd;
}

function isDateBeforeToday(dateValue?: string | Date | null): boolean {
  const normalizedDate = toDateOnlyString(dateValue);
  const target = parseDateStringToTimestamp(normalizedDate);
  const today = parseDateStringToTimestamp(getCurrentDateInNewYork());
  if (target === null || today === null) {
    return false;
  }

  return target < today;
}

function getNeedDateCandidates(
  need: Pick<NeedListItem, "eventLastDate" | "neededBy" | "eventDate" | "startDate" | "endDate">,
): Array<string | null | undefined> {
  return [
    need.neededBy,
    need.eventDate,
    need.startDate,
    need.endDate,
    need.eventLastDate,
  ];
}

function isNeedWithinUpcomingWindow(
  need: Pick<NeedListItem, "eventLastDate" | "neededBy" | "eventDate" | "startDate" | "endDate">,
): boolean {
  return getNeedDateCandidates(need).some((dateValue) => isDateWithinUpcomingWindow(dateValue));
}

function getNeedDeadlineDate(
  need: Pick<NeedListItem, "eventLastDate" | "neededBy" | "eventDate" | "startDate" | "endDate">,
): string | null {
  return need.eventLastDate || need.endDate || need.neededBy || need.eventDate || need.startDate || null;
}

function isNeedPastDue(
  need: Pick<NeedListItem, "eventLastDate" | "neededBy" | "eventDate" | "startDate" | "endDate">,
): boolean {
  return isDateBeforeToday(getNeedDeadlineDate(need));
}

function isNeedIncludedInUpcomingNeedsTab(
  need: Pick<NeedListItem, "eventLastDate" | "neededBy" | "eventDate" | "startDate" | "endDate">,
): boolean {
  return isNeedWithinUpcomingWindow(need) || isNeedPastDue(need);
}

function isOccurrenceWithinUpcomingWindow(
  occurrence: Pick<CalendarOccurrence, "occurrenceStart">,
): boolean {
  return isDateWithinUpcomingWindow(occurrence.occurrenceStart);
}

function getEventLastDate(need: Pick<NeedListItem, "needType" | "eventLastDate" | "startDate" | "endDate" | "eventDate" | "neededBy">): string | null {
  if (need.needType !== NeedType.EVENT) {
    return null;
  }

  return need.eventLastDate || need.endDate || need.eventDate || need.neededBy || need.startDate || null;
}

function hasEventEnded(need: Pick<NeedListItem, "needType" | "eventLastDate" | "startDate" | "endDate" | "eventDate" | "neededBy">): boolean {
  const eventLastDate = getEventLastDate(need);
  if (!eventLastDate) {
    return false;
  }

  return getCurrentDateInNewYork() > eventLastDate;
}

function getNeedSortDate(need: Need): number | null {
  return (
    parseDateStringToTimestamp(need.neededBy) ??
    parseDateStringToTimestamp(need.eventDate) ??
    parseDateStringToTimestamp(need.endDate) ??
    parseDateStringToTimestamp(need.startDate)
  );
}

function getNeedSortMonthKey(need: Need): number | null {
  const sortDate = getNeedSortDate(need);
  if (sortDate === null) return null;
  const date = new Date(sortDate);
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

function formatNeedMonthLabel(monthKey: number): string {
  const year = Math.floor(monthKey / 12);
  const monthIndex = monthKey % 12;

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthIndex, 1, 12, 0, 0)));
}

const NeedsTabs = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const isMobile = useIsMobile();
  const isAdmin = user?.isAdmin ?? false;

  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("priority");
  const [showCalendarView, setShowCalendarView] = useState(false);
  const [tabShareOpen, setTabShareOpen] = useState(false);
  const [tabShareTitle, setTabShareTitle] = useState("All Needs");
  const [tabShareUrl, setTabShareUrl] = useState("");
  const [mobileSortOpen, setMobileSortOpen] = useState(false);
  const [mobileCategoryMenuOpen, setMobileCategoryMenuOpen] = useState(false);
  const [topNeedsExpanded, setTopNeedsExpanded] = useState(true);

  // Admin state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteNeed, setDeleteNeed] = useState<Need | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const tabLinkStateInitialized = useRef(false);

  // Horizontal scroll state for category tabs
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const isAllCategoriesSelected = selectedCategories.length === 0;
  const isCategorySelected = useCallback(
    (value: string) => selectedCategories.some((category) => categoriesMatch(category, value)),
    [selectedCategories],
  );

  const { data: needs, isLoading, error } = useQuery<NeedListItem[]>({
    queryKey: ["/api/needs"],
  });

  const { data: dbCategories } = useCategories();
  const configuredPublicUrl = import.meta.env.VITE_PUBLIC_URL as string | undefined;

  // Support deep-linking to specific tabs/sort:
  // ?tab=FOOD&sort=needed_by
  useEffect(() => {
    if (tabLinkStateInitialized.current || typeof window === "undefined") return;

    const params = getDeepLinkSearchParams();
    const rawTabs = (params.get("tab") || "")
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    const rawSort = params.get("sort")?.trim().toLowerCase();
    const normalizedRawTabs = rawTabs.map((value) => normalizeCategoryToken(value));

    if (rawSort === "needed_by") {
      setSortMode("neededBy");
    } else if (rawSort === "month_needed" || rawSort === "month") {
      setSortMode("neededMonth");
    }

    if (rawTabs.length === 0) {
      tabLinkStateInitialized.current = true;
      return;
    }

    if (
      normalizedRawTabs.includes(normalizeCategoryToken(UPCOMING_EVENTS_TAB_VALUE)) ||
      normalizedRawTabs.includes("event") ||
      normalizedRawTabs.includes("events")
    ) {
      setSelectedCategories([UPCOMING_EVENTS_TAB_VALUE]);
      tabLinkStateInitialized.current = true;
      return;
    }

    if (rawTabs.some((tab) => normalizeCategoryToken(tab) === "all")) {
      setSelectedCategories([]);
      tabLinkStateInitialized.current = true;
      return;
    }

    const resolvedCategories: string[] = [];

    for (const rawTab of rawTabs) {
      const normalizedTab = normalizeCategoryToken(rawTab);
      let resolvedCategory: string | null = null;

      if (dbCategories?.length) {
        const matchedCategory = dbCategories.find(
          (category) =>
            normalizeCategoryToken(category.slug) === normalizedTab ||
            normalizeCategoryToken(category.name) === normalizedTab,
        );
        if (matchedCategory) {
          resolvedCategory = matchedCategory.slug;
        }
      }

      if (!resolvedCategory && needs?.length) {
        const matchedNeed = needs.find(
          (need) => needMatchesCategory(need, normalizedTab),
        );
        if (matchedNeed) {
          resolvedCategory =
            getNeedCategoryValues(matchedNeed).find(
              (category) => normalizeCategoryToken(category) === normalizedTab,
            ) || matchedNeed.category;
        }
      }

      if (resolvedCategory && !resolvedCategories.some((category) => categoriesMatch(category, resolvedCategory))) {
        resolvedCategories.push(resolvedCategory);
      }
    }

    if (resolvedCategories.length > 0) {
      setSelectedCategories(resolvedCategories);
      tabLinkStateInitialized.current = true;
      return;
    }

    if (dbCategories !== undefined && needs !== undefined) {
      // Nothing matched after data loaded: keep default tab and stop waiting.
      tabLinkStateInitialized.current = true;
    }
  }, [dbCategories, needs]);

  // Keep URL synced with selected tab/sort so copying the page URL preserves this view.
  useEffect(() => {
    if (!tabLinkStateInitialized.current || typeof window === "undefined") return;

    const url = new URL(window.location.href);
    if (selectedCategories.length === 0) {
      url.searchParams.delete("tab");
    } else {
      url.searchParams.set("tab", selectedCategories.join(","));
    }

    url.searchParams.delete("status");
    if (sortMode === "priority") {
      url.searchParams.delete("sort");
    } else if (sortMode === "neededBy") {
      url.searchParams.set("sort", "needed_by");
    } else {
      url.searchParams.set("sort", "month_needed");
    }

    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const next = `${url.pathname}${url.search}${url.hash}`;
    if (current !== next) {
      window.history.replaceState({}, "", next);
    }
  }, [selectedCategories, sortMode]);

  // Redirect to a specific need page when ?need=ID is in the URL (deep linking from emails/shares)
  useEffect(() => {
    if (!needs || needs.length === 0) return;
    const params = getDeepLinkSearchParams();
    const needId = params.get('need');
    if (needId) {
      const targetNeed = needs.find(n => n.id === parseInt(needId));
      if (targetNeed) {
        navigate(`/need/${targetNeed.id}`);
      }
    }
  }, [needs, navigate]);

  // Check scroll position for fade gradients
  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, []);

  const scrollLeftFn = () => {
    scrollRef.current?.scrollBy({ left: -200, behavior: "smooth" });
  };
  const scrollRightFn = () => {
    scrollRef.current?.scrollBy({ left: 200, behavior: "smooth" });
  };
  const activateCategory = useCallback((tabValue: string) => {
    setSelectedCategories(tabValue === "all" ? [] : [tabValue]);
    requestAnimationFrame(() => {
      const target = scrollRef.current?.querySelector(`[data-category-tab="${tabValue}"]`) as HTMLElement | null;
      target?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    });
  }, []);

  const toggleMobileCategory = useCallback((tabValue: string) => {
    if (tabValue === "all") {
      setSelectedCategories([]);
      return;
    }

    if (isUpcomingEventsTabValue(tabValue)) {
      setSelectedCategories((current) =>
        current.length === 1 && current.some((category) => isUpcomingEventsTabValue(category))
          ? []
          : [UPCOMING_EVENTS_TAB_VALUE],
      );
      return;
    }

    setSelectedCategories((current) => {
      const next = current.filter((category) => !isUpcomingEventsTabValue(category));
      if (next.some((category) => categoriesMatch(category, tabValue))) {
        return next.filter((category) => !categoriesMatch(category, tabValue));
      }
      return [...next, tabValue];
    });
  }, []);

  const buildTabShareUrl = useCallback(
    (tabValues: string[]) => {
      return buildNeedsTabShareUrl({
        tabValues,
        sortMode,
        configuredUrl: configuredPublicUrl,
      });
    },
    [configuredPublicUrl, sortMode],
  );

  const shareTab = useCallback(
    (tabValues: string[], tabLabel: string) => {
      const shareUrl = buildTabShareUrl(tabValues);
      if (!shareUrl) {
        toast({
          title: "Could not build tab link",
          description: "Please try again.",
          variant: "destructive",
        });
        return;
      }

      setTabShareTitle(tabLabel);
      setTabShareUrl(shareUrl);
      setTabShareOpen(true);
    },
    [buildTabShareUrl, toast],
  );

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const filterNeeds = useCallback((needList: NeedListItem[]) => {
    let filtered = [...needList];
    const isUpcomingEventsView = selectedCategories.some((category) => isUpcomingEventsTabValue(category));

    if (isUpcomingEventsView) {
      filtered = filtered.filter((need) => isNeedIncludedInUpcomingNeedsTab(need));
    } else if (selectedCategories.length > 0) {
      // Category filter
      filtered = filtered.filter((need) =>
        selectedCategories.some((category) => needMatchesCategory(need, category)),
      );
    }

    if (!isUpcomingEventsView) {
      filtered = filtered.filter((need) => !hasEventEnded(need));
    }

    // Public list defaults to the current open-needs behavior.
    filtered = filtered.filter(
      (n) =>
        n.status === NeedStatus.FLOATING ||
        n.status === NeedStatus.RECURRING
    );

    // Sort mode: Date Needed (earliest first, undated last)
    if (sortMode === "neededBy") {
      return filtered.sort((a, b) => {
        const aDate = getNeedSortDate(a);
        const bDate = getNeedSortDate(b);

        if (aDate !== null && bDate !== null && aDate !== bDate) {
          return aDate - bDate;
        }
        if (aDate !== null && bDate === null) return -1;
        if (aDate === null && bDate !== null) return 1;

        const orderDiff = getNeedDisplayOrder(a) - getNeedDisplayOrder(b);
        if (orderDiff !== 0) return orderDiff;

        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });
    }

    if (sortMode === "neededMonth") {
      return filtered.sort((a, b) => {
        const aMonth = getNeedSortMonthKey(a);
        const bMonth = getNeedSortMonthKey(b);

        if (aMonth !== null && bMonth !== null && aMonth !== bMonth) {
          return aMonth - bMonth;
        }
        if (aMonth !== null && bMonth === null) return -1;
        if (aMonth === null && bMonth !== null) return 1;

        const aDate = getNeedSortDate(a);
        const bDate = getNeedSortDate(b);
        if (aDate !== null && bDate !== null && aDate !== bDate) {
          return aDate - bDate;
        }
        if (aDate !== null && bDate === null) return -1;
        if (aDate === null && bDate !== null) return 1;

        const orderDiff = getNeedDisplayOrder(a) - getNeedDisplayOrder(b);
        if (orderDiff !== 0) return orderDiff;

        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });
    }

    // Sort mode: Priority (highlighted first, then open/recurring, then pledged, then fulfilled)
    return filtered.sort((a, b) => {
      // Highlighted always first
      if (a.isHighlighted && !b.isHighlighted) return -1;
      if (!a.isHighlighted && b.isHighlighted) return 1;

      // Keep group sign-up projects near other open needs.
      const aIsGroupWithSlots =
        a.needType === NeedType.GROUP &&
        a.status !== NeedStatus.FULFILLED;

      const bIsGroupWithSlots =
        b.needType === NeedType.GROUP &&
        b.status !== NeedStatus.FULFILLED;

      if (aIsGroupWithSlots && b.status === NeedStatus.PLEDGED) return -1;
      if (bIsGroupWithSlots && a.status === NeedStatus.PLEDGED) return 1;

      // Pledged to bottom
      if (a.status === NeedStatus.PLEDGED && b.status !== NeedStatus.PLEDGED) return 1;
      if (a.status !== NeedStatus.PLEDGED && b.status === NeedStatus.PLEDGED) return -1;

      // Fulfilled to bottom
      if (a.status === NeedStatus.FULFILLED && b.status !== NeedStatus.FULFILLED) return 1;
      if (a.status !== NeedStatus.FULFILLED && b.status === NeedStatus.FULFILLED) return -1;

      // Primary user-controlled order from drag-and-drop.
      const orderDiff = getNeedDisplayOrder(a) - getNeedDisplayOrder(b);
      if (orderDiff !== 0) return orderDiff;

      // Fallback for older rows with identical/default displayOrder.
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  }, [selectedCategories, sortMode]);

  const calendarMatchesSelectedCategories = useCallback(
    (occurrence: {
      occurrenceStart: string;
      groupName?: string | null;
      integrationSource?: string | null;
    }) => {
      if (occurrence.integrationSource !== "servingnetwork") {
        return false;
      }

      if (selectedCategories.some((category) => isUpcomingEventsTabValue(category))) {
        return isOccurrenceWithinUpcomingWindow(occurrence);
      }

      if (selectedCategories.length === 0) {
        return true;
      }

      return selectedCategories.some((category) => categoriesMatch(category, occurrence.groupName));
    },
    [selectedCategories],
  );

  // Category drag-end handler
  const handleCategoryDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !dbCategories) return;

      const oldIndex = dbCategories.findIndex((c) => c.id === Number(active.id));
      const newIndex = dbCategories.findIndex((c) => c.id === Number(over.id));
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(dbCategories, oldIndex, newIndex);

      // Optimistic update
      queryClient.setQueryData(["/api/categories"], reordered);

      try {
        await apiRequest("POST", "/api/categories/reorder", {
          order: reordered.map((c, i) => ({ id: c.id, displayOrder: i })),
        });
        queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      } catch {
        queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
        toast({ title: "Failed to save order", variant: "destructive" });
      }
    },
    [dbCategories, toast]
  );

  // Need card drag-end handler
  const handleNeedDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !needs) return;

      const currentlyVisibleNeeds = filterNeeds(needs);
      const oldIndex = currentlyVisibleNeeds.findIndex((n) => n.id === Number(active.id));
      const newIndex = currentlyVisibleNeeds.findIndex((n) => n.id === Number(over.id));
      if (oldIndex === -1 || newIndex === -1) return;

      const reorderedVisible = arrayMove(currentlyVisibleNeeds, oldIndex, newIndex);

      const visibleIds = new Set(reorderedVisible.map((n) => n.id));
      const hiddenNeeds = [...needs]
        .filter((n) => !visibleIds.has(n.id))
        .sort((a, b) => {
          const orderDiff = getNeedDisplayOrder(a) - getNeedDisplayOrder(b);
          if (orderDiff !== 0) return orderDiff;
          const aTime = new Date(a.createdAt || 0).getTime();
          const bTime = new Date(b.createdAt || 0).getTime();
          return bTime - aTime;
        });

      const reorderedAll = [...reorderedVisible, ...hiddenNeeds];
      const orderMap = new Map(reorderedAll.map((n, i) => [n.id, i]));
      const optimisticNeeds = needs.map((n) => ({
        ...n,
        displayOrder: orderMap.get(n.id) ?? n.displayOrder,
      }));

      // Optimistic update
      queryClient.setQueryData(["/api/needs"], optimisticNeeds);

      try {
        await apiRequest("POST", "/api/needs/reorder", {
          order: reorderedAll.map((n, i) => ({ id: n.id, displayOrder: i })),
        });
        queryClient.invalidateQueries({ queryKey: ["/api/needs"] });
      } catch {
        queryClient.invalidateQueries({ queryKey: ["/api/needs"] });
        toast({ title: "Failed to save order", variant: "destructive" });
      }
    },
    [filterNeeds, needs, toast]
  );

  // Admin mutations
  const deleteNeedMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/needs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/needs"] });
      toast({ title: "Need deleted", description: "The need has been removed." });
      setDeleteDialogOpen(false);
      setDeleteNeed(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleHighlightMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/needs/${id}/highlight`, {});
      return await res.json();
    },
    onSuccess: (data: { isHighlighted: boolean }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/needs"] });
      toast({
        title: data.isHighlighted ? "Need highlighted" : "Highlight removed",
        description: data.isHighlighted
          ? "This need will appear in the featured section."
          : "This need has been removed from featured.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const duplicateAndEditMutation = useMutation({
    mutationFn: async (need: Need) => {
      const res = await apiRequest("POST", `/api/needs/${need.id}/duplicate`, {});
      return (await res.json()) as Need;
    },
    onSuccess: (draftNeed) => {
      queryClient.invalidateQueries({ queryKey: ["/api/needs"] });
      navigate(`/admin/needs/${draftNeed.id}/edit`);
      toast({
        title: "Draft created",
        description: "A duplicate draft is ready to edit and publish.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not duplicate need",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // --- Loading skeleton ---
  if (isLoading) {
    return (
      <div className="max-w-[88rem] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Category tabs skeleton */}
        <div className="flex gap-3 mb-4 overflow-hidden">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="w-[100px] h-[100px] rounded-lg flex-shrink-0" />
          ))}
        </div>
        {/* Actions skeleton */}
        <div className="flex justify-end gap-2 mb-6">
          <Skeleton className="w-10 h-10 rounded-full" />
          <Skeleton className="w-24 h-10 rounded-full" />
        </div>
        {/* Card grid skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-40 rounded-2xl md:aspect-[4/5] md:h-auto" />
          ))}
        </div>
      </div>
    );
  }

  // --- Error state ---
  if (error) {
    return (
      <div className="max-w-[88rem] mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-red-50 p-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading needs</h3>
              <p className="mt-2 text-sm text-red-700">
                There was a problem loading the needs. Please try again later.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Filtering logic ---

  const hasUpcomingTabSelected = selectedCategories.some((category) => isUpcomingEventsTabValue(category));
  const hasUpcomingNeeds = (needs || []).some(
    (need) =>
      (need.status === NeedStatus.FLOATING || need.status === NeedStatus.RECURRING) &&
      isNeedIncludedInUpcomingNeedsTab(need),
  );

  // Build category tabs from DB categories
  const categoryTabs: Array<{ value: string; label: string; icon: LucideIcon }> = [
    { value: "all", label: "All Needs", icon: LayoutGrid },
    ...(hasUpcomingNeeds || hasUpcomingTabSelected
      ? [{ value: UPCOMING_EVENTS_TAB_VALUE, label: UPCOMING_EVENTS_TAB_LABEL, icon: CalendarDays }]
      : []),
    ...(dbCategories || [])
      .filter((cat) => !isLegacyEventsCategory(cat.slug, cat.name))
      .map((cat) => ({
        value: cat.slug,
        label: cat.name,
        icon: getIcon(cat.icon),
      })),
  ];

  // Determine which categories actually have active needs
  const activeCategoryTokens = new Set(
    (needs || [])
      .filter((n) => n.status !== NeedStatus.DRAFT)
      .flatMap((n) => getNeedCategoryValues(n))
      .map((category) => normalizeCategoryToken(category))
      .filter((category) => category.length > 0),
  );
  const selectedCategoryTokens = new Set(
    selectedCategories
      .map((category) => normalizeCategoryToken(category))
      .filter((category) => category.length > 0),
  );

  // Only show category tabs that have needs (plus "All")
  const visibleCategoryTabs = categoryTabs.filter(
    (tab) =>
      tab.value === "all" ||
      isUpcomingEventsTabValue(tab.value) ||
      activeCategoryTokens.has(normalizeCategoryToken(tab.value)) ||
      selectedCategoryTokens.has(normalizeCategoryToken(tab.value))
  );
  const upcomingEventsTab =
    visibleCategoryTabs.find((tab) => isUpcomingEventsTabValue(tab.value)) ?? null;
  const sortableCategories = (dbCategories || []).filter(
    (cat) =>
      !isLegacyEventsCategory(cat.slug, cat.name) &&
      (
        activeCategoryTokens.has(normalizeCategoryToken(cat.slug)) ||
        selectedCategoryTokens.has(normalizeCategoryToken(cat.slug))
      ),
  );

  const selectedCategoryLabels = visibleCategoryTabs
    .filter((tab) => tab.value !== "all" && isCategorySelected(tab.value))
    .map((tab) => tab.label);

  const activeCategoryLabel =
    selectedCategoryLabels.length === 0
      ? "All Needs"
      : selectedCategoryLabels.length === 1
        ? selectedCategoryLabels[0]
        : `${selectedCategoryLabels.length} Categories`;

  const mobileCategoryLabel =
    selectedCategoryLabels.length === 0
      ? "All Needs"
      : selectedCategoryLabels.length <= 2
        ? selectedCategoryLabels.join(", ")
        : `${selectedCategoryLabels.length} categories selected`;

  const shareCurrentView = () => {
    shareTab(selectedCategories, activeCategoryLabel);
  };

  const categoryBrowserPanel = (closeBrowser?: () => void) => (
    <div className="space-y-3">
      <div className="px-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Browse categories</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {visibleCategoryTabs.map((tab) => {
          const Icon = tab.icon;
          const isActiveTab = tab.value === "all" ? isAllCategoriesSelected : isCategorySelected(tab.value);
          return (
            <button
              key={`browser-${tab.value}`}
              type="button"
              onClick={() => {
                activateCategory(tab.value);
                closeBrowser?.();
              }}
              className={`flex min-h-11 items-center gap-2 rounded-[0.95rem] border px-3 py-2 text-left text-sm transition-colors ${
                isActiveTab
                  ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))/0.08] text-[hsl(var(--primary))]"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="leading-tight">{tab.value === "all" ? "All Needs" : tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const filteredNeeds = filterNeeds(needs || []);

  // Featured needs are derived from the active filtered/sorted list so drag order and filters stay consistent.
  const featuredNeeds = filteredNeeds.filter(
    (n) =>
      n.isHighlighted &&
      (n.status === NeedStatus.FLOATING ||
        n.status === NeedStatus.PLEDGED ||
        n.status === NeedStatus.RECURRING)
  );
  const shouldGroupNeedsByMonth = sortMode === "neededMonth";
  const visibleFeatured = featuredNeeds;
  const shouldShowFeatured = !shouldGroupNeedsByMonth && visibleFeatured.length > 0;
  const visibleFeaturedIds = new Set(visibleFeatured.map((n) => n.id));
  const shouldPinFeatured = shouldShowFeatured && topNeedsExpanded;
  const mainGridNeeds = shouldShowFeatured
    ? filteredNeeds.filter((n) => !visibleFeaturedIds.has(n.id))
    : filteredNeeds;
  const monthNeededSections = shouldGroupNeedsByMonth
    ? mainGridNeeds.reduce<Array<{ key: string; title: string; needs: NeedListItem[] }>>((sections, need) => {
        const monthKey = getNeedSortMonthKey(need);
        const sectionKey = monthKey === null ? "undated" : `month-${monthKey}`;
        const sectionTitle = monthKey === null ? "No Date Set" : formatNeedMonthLabel(monthKey);
        const currentSection = sections[sections.length - 1];

        if (!currentSection || currentSection.key !== sectionKey) {
          sections.push({
            key: sectionKey,
            title: sectionTitle,
            needs: [need],
          });
          return sections;
        }

        currentSection.needs.push(need);
        return sections;
      }, [])
    : [];
  const needGridClass = "grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-3 xl:grid-cols-4";
  const utilityButtonClass =
    "inline-flex min-h-11 items-center gap-2 rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50";
  const calendarFilterKey =
    selectedCategories.length > 0
      ? selectedCategories.map((category) => normalizeCategoryToken(category)).sort().join(",")
      : "all";

  // Handlers
  const handleCardClick = (need: NeedListItem) => {
    navigate(`/need/${need.id}`);
  };

  const handlePledge = (need: NeedListItem) => {
    navigate(`/pledge/${need.id}`);
  };

  const handleEdit = (need: NeedListItem) => {
    navigate(`/admin/needs/${need.id}/edit`);
  };

  const handleDelete = (need: NeedListItem) => {
    setDeleteNeed(need);
    setDeleteDialogOpen(true);
  };

  const handleToggleHighlight = (need: NeedListItem) => {
    toggleHighlightMutation.mutate(need.id);
  };

  const handleDuplicateAndEdit = (need: NeedListItem) => {
    duplicateAndEditMutation.mutate(need);
  };

  const toggleCalendarView = () => {
    setShowCalendarView((current) => !current);
  };

  const filteredCalendarLabel =
    selectedCategoryLabels.length === 0 ? "All Need Events" : activeCategoryLabel;

  return (
    <div id="needs" className="max-w-[88rem] mx-auto px-1 py-2 sm:px-2">
      {/* ===== Category + Filters ===== */}
      <div
        id="needs-controls"
        className="clh-inset-group px-4 shadow-none sm:px-5"
      >
        {isMobile ? (
          <div className="py-3">
            <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50/85 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
              <Popover open={mobileCategoryMenuOpen} onOpenChange={setMobileCategoryMenuOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-[1.15rem] border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition-colors hover:bg-slate-50"
                    aria-label="Choose need categories"
                    aria-expanded={mobileCategoryMenuOpen}
                  >
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Need Types</p>
                      <p className="truncate text-sm font-medium text-slate-800">{mobileCategoryLabel}</p>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${
                        mobileCategoryMenuOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-[min(22rem,calc(100vw-3rem))] rounded-2xl border border-slate-200 p-3 shadow-xl"
                >
                  <div className="space-y-3">
                    <div className="px-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Select categories</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleMobileCategory("all")}
                      className={`flex w-full items-center justify-between rounded-[1rem] border px-4 py-3 text-left text-sm font-medium transition-colors ${
                        isAllCategoriesSelected
                          ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))/0.08] text-[hsl(var(--primary))]"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span>All Needs</span>
                      {isAllCategoriesSelected && <Check className="h-4 w-4" />}
                    </button>
                    <div className="space-y-2">
                      {visibleCategoryTabs
                        .filter((tab) => tab.value !== "all")
                        .map((tab) => {
                          const Icon = tab.icon;
                          const isSelected = isCategorySelected(tab.value);

                          return (
                            <button
                              key={`mobile-category-${tab.value}`}
                              type="button"
                              onClick={() => toggleMobileCategory(tab.value)}
                              className={`flex w-full items-center gap-3 rounded-[1rem] border px-4 py-3 text-left transition-colors ${
                                isSelected
                                  ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))/0.08]"
                                  : "border-slate-200 bg-white hover:bg-slate-50"
                              }`}
                              aria-pressed={isSelected}
                            >
                              <Checkbox
                                checked={isSelected}
                                className="pointer-events-none"
                                aria-hidden="true"
                              />
                              <Icon className={`h-4 w-4 shrink-0 ${isSelected ? "text-[hsl(var(--primary))]" : "text-slate-500"}`} />
                              <span className={`text-sm font-medium ${isSelected ? "text-[hsl(var(--primary))]" : "text-slate-700"}`}>
                                {tab.label}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                    <div className="border-t border-slate-200 pt-3">
                      <button
                        type="button"
                        onClick={() => setMobileCategoryMenuOpen(false)}
                        className="flex w-full items-center justify-center rounded-[1rem] bg-[hsl(var(--primary))] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[hsl(var(--primary))/0.92]"
                      >
                        View Needs
                      </button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              <div className="mt-3 border-t border-slate-200/80 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={toggleCalendarView}
                    className={utilityButtonClass}
                    aria-label={showCalendarView ? "View need cards" : "View needs on calendar"}
                  >
                    {showCalendarView ? <LayoutGrid className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
                    <span>{showCalendarView ? "View Needs" : "Calendar"}</span>
                  </button>
                  <Popover open={mobileSortOpen} onOpenChange={setMobileSortOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={`inline-flex shrink-0 items-center gap-2 rounded-[14px] border px-4 py-2.5 text-sm font-medium shadow-sm transition-colors ${
                          mobileSortOpen
                            ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))/0.08] text-[hsl(var(--primary))]"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                        aria-label="Open sort options"
                        aria-expanded={mobileSortOpen}
                      >
                        <SlidersHorizontal className="h-4 w-4" />
                        <span>Sort By</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-[18rem] rounded-2xl border border-slate-200 p-3 shadow-xl">
                      <div className="space-y-2">
                        <p className="px-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Sort by
                        </p>
                        <div className="space-y-2">
                          {sortModes.map((mode) => (
                            <button
                              key={mode.value}
                              type="button"
                              onClick={() => {
                                setSortMode(mode.value);
                                setMobileSortOpen(false);
                              }}
                              className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
                                sortMode === mode.value
                                  ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))/0.08] text-[hsl(var(--primary))]"
                                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                              }`}
                            >
                              <span>{mode.label}</span>
                              {sortMode === mode.value && <Check className="h-4 w-4" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <button
                    type="button"
                    onClick={shareCurrentView}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-100"
                    aria-label="Share this view"
                    title="Share this view"
                  >
                    <Share className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="relative flex items-center gap-2 py-3">
              {canScrollLeft && (
                <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-[5] w-12 rounded-r-2xl bg-gradient-to-r from-white via-white/92 to-transparent" />
              )}

              {canScrollLeft && (
                <button
                  onClick={scrollLeftFn}
                  className="absolute left-1 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-500 shadow-sm ring-1 ring-slate-200/80 transition-colors hover:bg-white"
                  aria-label="Show earlier categories"
                  title="Show earlier categories"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}

              <div
                ref={scrollRef}
                onScroll={checkScroll}
                className="flex flex-1 items-stretch gap-2 overflow-x-auto pr-12 scrollbar-hide"
              >
                <div className="relative flex-shrink-0">
                  <button
                    type="button"
                    data-category-tab="all"
                    onClick={() => activateCategory("all")}
                    className={`flex h-[74px] w-[88px] flex-col items-center justify-center gap-1.5 rounded-[1rem] border-2 bg-white px-2 py-2 text-center transition-colors lg:h-[78px] lg:w-[92px] ${
                      isAllCategoriesSelected
                        ? "border-[hsl(var(--primary))] text-[hsl(var(--primary))]"
                        : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-800"
                    }`}
                  >
                    <LayoutGrid className="h-5 w-5 shrink-0" />
                    <span className="text-[10px] font-medium leading-[1.05] lg:text-[11px]">All Needs</span>
                  </button>
                </div>

                {upcomingEventsTab ? (
                  <div className="relative flex-shrink-0">
                    <button
                      type="button"
                      data-category-tab={upcomingEventsTab.value}
                      onClick={() => activateCategory(upcomingEventsTab.value)}
                      className={`flex h-[74px] w-[88px] flex-col items-center justify-center gap-1.5 rounded-[1rem] border-2 bg-white px-2 py-2 text-center transition-colors lg:h-[78px] lg:w-[92px] ${
                        isCategorySelected(upcomingEventsTab.value)
                          ? "border-[hsl(var(--primary))] text-[hsl(var(--primary))]"
                          : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-800"
                      }`}
                    >
                      <CalendarDays className="h-5 w-5 shrink-0" />
                      <span className="text-[10px] font-medium leading-[1.05] lg:text-[11px]">
                        {upcomingEventsTab.label}
                      </span>
                    </button>
                  </div>
                ) : null}

                {isAdmin && dbCategories ? (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCategoryDragEnd}>
                    <SortableContext items={sortableCategories.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
                      {sortableCategories.map((cat) => (
                          <SortableCategoryTab
                            key={cat.id}
                            id={String(cat.id)}
                            tabValue={cat.slug}
                            isActive={isCategorySelected(cat.slug)}
                            onClick={() => activateCategory(cat.slug)}
                            icon={getIcon(cat.icon)}
                            label={cat.name}
                            isAdmin={isAdmin}
                          />
                      ))}
                    </SortableContext>
                  </DndContext>
                ) : (
                  visibleCategoryTabs
                    .filter((tab) => tab.value !== "all" && !isUpcomingEventsTabValue(tab.value))
                    .map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <div key={tab.value} className="relative flex-shrink-0">
                          <button
                            type="button"
                            data-category-tab={tab.value}
                            onClick={() => activateCategory(tab.value)}
                            className={`flex h-[74px] w-[88px] flex-col items-center justify-center gap-1.5 rounded-[1rem] border-2 bg-white px-2 py-2 text-center transition-colors lg:h-[78px] lg:w-[92px] ${
                              isCategorySelected(tab.value)
                                ? "border-[hsl(var(--primary))] text-[hsl(var(--primary))]"
                                : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-800"
                            }`}
                          >
                            <Icon className="h-5 w-5 shrink-0" />
                            <span className="text-[10px] font-medium leading-[1.05] lg:text-[11px]">{tab.label}</span>
                          </button>
                        </div>
                      );
                    })
                )}
              </div>

              {canScrollRight && (
                <>
                  <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-[5] w-16 rounded-l-2xl bg-gradient-to-l from-white via-white/96 to-transparent" />
                  <HoverCard openDelay={0} closeDelay={120}>
                    <HoverCardTrigger asChild>
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 z-[6] flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/94 text-slate-500 shadow-sm ring-1 ring-slate-200/80 transition-colors hover:bg-white"
                        aria-label="Browse categories"
                        title="Browse categories"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </HoverCardTrigger>
                    <HoverCardContent align="end" className="w-[20rem] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                      {categoryBrowserPanel()}
                    </HoverCardContent>
                  </HoverCard>
                </>
              )}
            </div>

            <div className="pb-3 pt-1">
              <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50/85 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={toggleCalendarView}
                      className={utilityButtonClass}
                      aria-label={showCalendarView ? "View need cards" : "View needs on calendar"}
                    >
                      {showCalendarView ? <LayoutGrid className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
                      <span>{showCalendarView ? "View Needs" : "View on Calendar"}</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex min-h-11 items-center gap-2 rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                        aria-label="Open sort options"
                      >
                        <SlidersHorizontal className="h-4 w-4" />
                        <span>Sort By</span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2">
                      <DropdownMenuRadioGroup value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}>
                        {sortModes.map((mode) => (
                          <DropdownMenuRadioItem key={mode.value} value={mode.value} className="rounded-xl py-2 pl-9 pr-3 text-sm">
                            {mode.label}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <button
                    type="button"
                    onClick={shareCurrentView}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-100"
                    aria-label="Share this view"
                    title="Share this view"
                  >
                    <Share className="h-4 w-4" />
                  </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {showCalendarView ? (
        <div className="py-4">
          <div className="clh-inset-group p-3 sm:p-4">
            <div className="mb-4 flex flex-col gap-1 rounded-[1.15rem] border border-slate-200 bg-slate-50/85 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">{filteredCalendarLabel}</p>
                <p className="text-sm text-slate-600">Showing scheduled need events that match the current filters.</p>
              </div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Calendar view</p>
            </div>
            <PublicCalendar
              key={`needs-calendar-${calendarFilterKey}`}
              sourceUrl="/api/public/events"
              filterOccurrence={calendarMatchesSelectedCategories}
            />
          </div>
        </div>
      ) : (
        <>
          {/* ===== Featured Section ===== */}
          {shouldShowFeatured && (
            <div className={topNeedsExpanded ? "mb-8" : "mb-6"}>
              <div className="mb-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setTopNeedsExpanded((current) => !current)}
                  className="group inline-flex items-center gap-2 rounded-full border border-amber-200 bg-gradient-to-r from-amber-50 via-white to-white px-4 py-2 text-left text-[0.98rem] font-semibold text-[#231F20] shadow-sm transition-[color,background-color,border-color,box-shadow,transform] hover:border-amber-300 hover:from-amber-100 hover:to-slate-50 hover:shadow-md active:translate-y-px"
                  aria-expanded={topNeedsExpanded}
                  aria-controls="top-needs-grid"
                  aria-label={topNeedsExpanded ? "Hide top needs" : "Show top needs"}
                  title={topNeedsExpanded ? "Hide top needs" : "Show top needs"}
                >
                  <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                  <span>Top needs right now</span>
                  <span className="ml-1 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500 transition-colors group-hover:text-slate-600">
                    {topNeedsExpanded ? "Hide" : "Show"}
                  </span>
                  <span className="ml-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border border-amber-200 bg-white text-slate-500 transition-colors group-hover:border-amber-300 group-hover:text-slate-700">
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${topNeedsExpanded ? "rotate-0" : "-rotate-90"}`}
                    />
                  </span>
                </button>
                <div className="h-px flex-1 bg-gradient-to-r from-amber-200/90 via-slate-200/85 to-transparent" />
              </div>
              {topNeedsExpanded && (
                <div id="top-needs-grid" className={needGridClass}>
                  {isAdmin && sortMode === "priority" ? (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleNeedDragEnd}>
                      <SortableContext items={visibleFeatured.map((n) => n.id)} strategy={rectSortingStrategy}>
                        {visibleFeatured.map((need) => (
                          <SortableNeedCard
                            key={need.id}
                            need={need}
                            isAdmin={isAdmin}
                            onCardClick={handleCardClick}
                            onPledge={handlePledge}
                            onEdit={handleEdit}
                            onDuplicateAndEdit={handleDuplicateAndEdit}
                            onDelete={handleDelete}
                            onToggleHighlight={handleToggleHighlight}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                  ) : (
                    visibleFeatured.map((need) => (
                      <NeedCard
                        key={need.id}
                        need={need}
                        onCardClick={handleCardClick}
                        onPledge={handlePledge}
                        isAdmin={isAdmin}
                        onEdit={handleEdit}
                        onDuplicateAndEdit={handleDuplicateAndEdit}
                        onDelete={handleDelete}
                        onToggleHighlight={handleToggleHighlight}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* ===== Main Grid ===== */}
          <div className="py-4">
            {shouldPinFeatured && mainGridNeeds.length > 0 && (
              <div className="mb-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-200/70 to-slate-200/80" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  More needs
                </span>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent via-amber-200/70 to-slate-200/80" />
              </div>
            )}

            {shouldGroupNeedsByMonth ? (
              <>
                {isAdmin && (
                  <div className={`${needGridClass} mb-6`}>
                    <button
                      onClick={() => setCreateDialogOpen(true)}
                      className="group relative flex h-40 w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border-2 border-dashed border-gray-300 transition-all hover:border-[#991A1E]/50 hover:bg-[#991A1E]/5 sm:h-44 sm:gap-4 md:h-auto md:aspect-[5/6]"
                    >
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#991A1E]/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Plus className="w-7 h-7 sm:w-8 sm:h-8 text-[#991A1E]" />
                      </div>
                      <span className="text-base sm:text-lg font-medium text-gray-500 group-hover:text-[#991A1E]">
                        Add a Need
                      </span>
                    </button>
                  </div>
                )}

                {monthNeededSections.map((section) => (
                  <section key={section.key} className="mb-8 last:mb-0">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm">
                        {section.title}
                      </div>
                      <div className="h-px flex-1 bg-gradient-to-r from-slate-200/90 via-slate-200/60 to-transparent" />
                      <span className="shrink-0 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                        {section.needs.length} {section.needs.length === 1 ? "Need" : "Needs"}
                      </span>
                    </div>

                    <div className={needGridClass}>
                      {section.needs.map((need) => (
                        <NeedCard
                          key={need.id}
                          need={need}
                          onCardClick={handleCardClick}
                          onPledge={handlePledge}
                          isAdmin={isAdmin}
                          onEdit={handleEdit}
                          onDuplicateAndEdit={handleDuplicateAndEdit}
                          onDelete={handleDelete}
                          onToggleHighlight={handleToggleHighlight}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </>
            ) : (
              <div className={needGridClass}>
                {/* Admin: Add Need card */}
                {isAdmin && (
                  <button
                    onClick={() => setCreateDialogOpen(true)}
                    className="group relative flex h-40 w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border-2 border-dashed border-gray-300 transition-all hover:border-[#991A1E]/50 hover:bg-[#991A1E]/5 sm:h-44 sm:gap-4 md:h-auto md:aspect-[5/6]"
                  >
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#991A1E]/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Plus className="w-7 h-7 sm:w-8 sm:h-8 text-[#991A1E]" />
                    </div>
                    <span className="text-base sm:text-lg font-medium text-gray-500 group-hover:text-[#991A1E]">
                      Add a Need
                    </span>
                  </button>
                )}

                {/* Need Cards — sortable for admins in Priority mode */}
                {isAdmin && sortMode === "priority" ? (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleNeedDragEnd}>
                    <SortableContext items={mainGridNeeds.map((n) => n.id)} strategy={rectSortingStrategy}>
                      {mainGridNeeds.map((need) => (
                        <SortableNeedCard
                          key={need.id}
                          need={need}
                          isAdmin={isAdmin}
                          onCardClick={handleCardClick}
                          onPledge={handlePledge}
                          onEdit={handleEdit}
                          onDuplicateAndEdit={handleDuplicateAndEdit}
                          onDelete={handleDelete}
                          onToggleHighlight={handleToggleHighlight}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                ) : (
                  mainGridNeeds.map((need) => (
                    <NeedCard
                      key={need.id}
                      need={need}
                      onCardClick={handleCardClick}
                      onPledge={handlePledge}
                      isAdmin={isAdmin}
                      onEdit={handleEdit}
                      onDuplicateAndEdit={handleDuplicateAndEdit}
                      onDelete={handleDelete}
                      onToggleHighlight={handleToggleHighlight}
                    />
                  ))
                )}
              </div>
            )}

            {/* Empty state */}
            {mainGridNeeds.length === 0 && !shouldShowFeatured && (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <Heart className="w-10 h-10 text-gray-300" />
                </div>
                <h3 className="text-xl font-semibold text-gray-600 mb-2">Nothing Here Right Now</h3>
                <p className="text-gray-400 text-center max-w-md">
                  There are no open needs in this category right now. Try another category or check back soon.
                </p>
              </div>
            )}
          </div>
        </>
      )}

      <ShareDialog
        open={tabShareOpen}
        onOpenChange={setTabShareOpen}
        title={`${tabShareTitle} | VFW Post 7570 Serving Network`}
        url={tabShareUrl}
        heading="Share this view"
        description={`Share a direct link to the "${tabShareTitle}" needs view.`}
        shareText={`View ${tabShareTitle} needs on VFW Post 7570: ${tabShareUrl}`}
      />

      {/* ===== Admin: Create Need Dialog ===== */}
      {isAdmin && (
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] rounded-2xl overflow-hidden top-[5%] translate-y-0 p-4 sm:p-5">
            <DialogHeader className="pb-0">
              <DialogTitle className="text-base">Create New Need</DialogTitle>
            </DialogHeader>
            <NeedForm onClose={() => setCreateDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      )}

      {/* ===== Admin: Delete Confirmation ===== */}
      {isAdmin && (
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Need</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "<strong>{deleteNeed?.title}</strong>"?
                This action cannot be undone and all associated pledges will also be removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => {
                  if (deleteNeed) deleteNeedMutation.mutate(deleteNeed.id);
                }}
              >
                {deleteNeedMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};

export default NeedsTabs;
