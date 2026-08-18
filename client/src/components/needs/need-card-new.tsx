import { Card } from "@/components/ui/card";
import { Need, NeedStatus, NeedType, NeedCategory } from "@shared/schema";
import { Pencil, Trash2, Star, Copy, CalendarDays, Clock3 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatDateInNewYork } from "@/lib/utils";
import type { NeedListItem } from "@/types/need-list-item";

export type NeedCardDensity = "auto" | "compact-mobile" | "full";

interface NeedCardProps {
  need: NeedListItem;
  onCardClick?: (need: NeedListItem) => void;
  onPledge?: (need: NeedListItem) => void;
  isAdmin?: boolean;
  onEdit?: (need: NeedListItem) => void;
  onDuplicateAndEdit?: (need: NeedListItem) => void;
  onDelete?: (need: NeedListItem) => void;
  onToggleHighlight?: (need: NeedListItem) => void;
  density?: NeedCardDensity;
}

/** Strip HTML tags for plain-text description excerpts */
function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent || "";
}

/** Get a lucide-style SVG path per category when no image is available */
function CategoryPlaceholder({
  category,
  compact = false,
}: {
  category: string;
  compact?: boolean;
}) {
  const iconClass = compact
    ? "w-10 h-10 text-muted-foreground/40"
    : "w-16 h-16 text-muted-foreground/40";

  switch (category) {
    case NeedCategory.FOOD:
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
          />
        </svg>
      );
    case NeedCategory.CLOTHING:
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
      );
    case NeedCategory.SERVICE:
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      );
    case NeedCategory.EDUCATION:
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
      );
    case NeedCategory.HOUSING:
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      );
    case NeedCategory.EVENT:
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      );
    default:
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
          />
        </svg>
      );
  }
}

/** Get the CTA button text and style for a given need */
function getCtaConfig(need: Need) {
  // Recurring needs
  if (need.status === NeedStatus.RECURRING) {
    return { text: "Contribute", className: "bg-primary hover:bg-primary/90" };
  }

  // Group volunteer counts are informational and do not close sign-ups.
  if (need.needType === NeedType.GROUP) {
    if (need.status !== NeedStatus.FULFILLED) {
      return { text: "Sign Up", className: "bg-primary hover:bg-primary/90" };
    }
    return { text: "Volunteers Filled", className: "bg-slate-300 cursor-default", disabled: true };
  }

  // Event availability is driven by real slot capacity/status, not volunteersNeeded.
  if (need.needType === NeedType.EVENT) {
    if (need.status === NeedStatus.FULFILLED) {
      return { text: "Event Ended", className: "bg-slate-300 cursor-default", disabled: true };
    }
    if (need.status !== NeedStatus.PLEDGED) {
      return { text: "Sign Up", className: "bg-primary hover:bg-primary/90" };
    }
    return { text: "Registration Full", className: "bg-slate-300 cursor-default", disabled: true };
  }

  // Open needs
  if (need.status === NeedStatus.FLOATING) {
    return { text: "Pledge to Help", className: "bg-primary hover:bg-primary/90" };
  }

  // Pledged / Fulfilled / Draft
  if (need.status === NeedStatus.PLEDGED) {
    return { text: "Pledged", className: "bg-slate-300 cursor-default", disabled: true };
  }
  if (need.status === NeedStatus.FULFILLED) {
    return { text: "Fulfilled", className: "bg-emerald-600 cursor-default", disabled: true };
  }
  return { text: "View Details", className: "bg-primary hover:bg-primary/90" };
}

/** Get user-friendly status label */
function getStatusLabel(need: Need): string {
  if (need.needType === NeedType.GROUP) {
    return need.status === NeedStatus.FULFILLED ? "Volunteers Filled" : "Volunteers Needed";
  }

  if (need.needType === NeedType.EVENT) {
    if (need.status === NeedStatus.FULFILLED) {
      return "Event Ended";
    }
    if (need.status !== NeedStatus.PLEDGED) {
      return "Open for Sign-Ups";
    }
    return "Registration Full";
  }

  if (need.status === NeedStatus.FLOATING) {
    return "Still Needed";
  }

  const labels: Record<string, string> = {
    [NeedStatus.DRAFT]: "Draft",
    [NeedStatus.PLEDGED]: "Pledged",
    [NeedStatus.FULFILLED]: "Fulfilled",
    [NeedStatus.RECURRING]: "Recurring",
  };
  return labels[need.status] || need.status;
}

function getEventDateMetaLabel(need: Need): string | null {
  if (need.needType !== NeedType.EVENT) return null;
  const eventDate = need.eventDate || need.neededBy;
  if (!eventDate) return null;
  return formatDateInNewYork(eventDate, {
    month: "short",
    day: "numeric",
  });
}

function getVolunteerSummary(need: Need): string | null {
  if (need.needType !== NeedType.GROUP && need.needType !== NeedType.EVENT) return null;

  const volunteersCount = typeof need.volunteersCount === "number" ? need.volunteersCount : 0;
  const volunteersNeeded = typeof need.volunteersNeeded === "number" ? need.volunteersNeeded : null;

  if (volunteersNeeded && volunteersNeeded > 0) {
    if (volunteersCount > 0) {
      return `${volunteersCount} signed up · ${volunteersNeeded} requested`;
    }
    return `${volunteersNeeded} volunteer${volunteersNeeded === 1 ? "" : "s"} requested`;
  }

  if (volunteersCount > 0) {
    return `${volunteersCount} volunteer${volunteersCount === 1 ? "" : "s"} signed up`;
  }

  return need.needType === NeedType.EVENT ? "Open sign-ups" : "Volunteers welcome";
}

function formatMetaLabel(value: string): string {
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const NeedCard = ({
  need,
  onCardClick,
  onPledge,
  isAdmin,
  onEdit,
  onDuplicateAndEdit,
  onDelete,
  onToggleHighlight,
  density = "auto",
}: NeedCardProps) => {
  const isMobile = useIsMobile();

  const useCompactLayout = density === "compact-mobile" || (density === "auto" && isMobile);

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't open detail dialog when clicking admin buttons or CTA actions.
    const target = e.target as HTMLElement;
    if (target.closest("[data-no-card-click]")) return;

    onCardClick?.(need);
  };

  const cta = getCtaConfig(need);
  const isFeatured = need.isHighlighted;
  const plainDesc = stripHtml(need.description || "");
  const seeMoreLabel = plainDesc.trim().length > 0 ? "View details" : "Details";
  const statusLabel = getStatusLabel(need);
  const eventDateMetaLabel = getEventDateMetaLabel(need);
  const eventRolePreviewLabel = need.eventRolePreviewLabel?.trim() || null;
  const volunteerSummary = getVolunteerSummary(need);
  const isEventCard = need.needType === NeedType.EVENT;
  const showSupportingStatus =
    statusLabel !== "Still Needed" &&
    statusLabel !== "Open for Sign-Ups" &&
    statusLabel !== "Volunteers Needed";

  const adminButtonClass =
    "h-11 w-11 rounded-[14px] bg-white/95 hover:bg-white shadow-sm flex items-center justify-center transition-colors";

  const adminButtons = (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onEdit?.(need);
        }}
        className={adminButtonClass}
        title="Edit need"
      >
        <Pencil className="w-4 h-4 text-gray-600" />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDuplicateAndEdit?.(need);
        }}
        className={`${adminButtonClass} hover:bg-blue-50`}
        title="Duplicate as draft and edit"
      >
        <Copy className="w-4 h-4 text-gray-600 hover:text-blue-600" />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete?.(need);
        }}
        className={`${adminButtonClass} hover:bg-red-50`}
        title="Delete need"
      >
        <Trash2 className="w-4 h-4 text-gray-600 hover:text-red-600" />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleHighlight?.(need);
        }}
        className={`${adminButtonClass} hover:bg-amber-50`}
        title={need.isHighlighted ? "Remove highlight" : "Highlight need"}
      >
        <Star
          className={`w-4 h-4 transition-colors ${
            need.isHighlighted
              ? "text-amber-500 fill-amber-500"
              : "text-gray-600 hover:text-amber-500"
          }`}
        />
      </button>
    </>
  );

  const metadataRow = isEventCard && (eventDateMetaLabel || eventRolePreviewLabel) ? (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-600 ${useCompactLayout ? "mt-2 text-[12px]" : "mt-2.5 text-[13px]"}`}>
      {eventDateMetaLabel ? (
        <div className="inline-flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
          <span className="font-medium">{eventDateMetaLabel}</span>
        </div>
      ) : null}
      {eventRolePreviewLabel ? (
        <div className="inline-flex items-center gap-1.5">
          <Clock3 className="h-3.5 w-3.5 text-slate-400" />
          <span className="font-medium">{eventRolePreviewLabel}</span>
        </div>
      ) : null}
    </div>
  ) : null;

  const supportingInfo = (
    <div className={useCompactLayout ? "mt-2 space-y-1" : "mt-3 space-y-1.5"}>
      {volunteerSummary ? (
        <p className={useCompactLayout ? "text-xs font-medium text-slate-600" : "text-sm font-medium text-slate-600"}>
          {volunteerSummary}
        </p>
      ) : null}
      {showSupportingStatus ? (
        <p className={useCompactLayout ? "text-[11px] text-slate-500" : "text-[12px] text-slate-500"}>
          {statusLabel}
        </p>
      ) : null}
      {plainDesc ? (
        <p className={useCompactLayout ? "line-clamp-2 text-xs leading-relaxed text-slate-500" : "line-clamp-3 text-sm leading-relaxed text-slate-500"}>
          {plainDesc}
        </p>
      ) : null}
    </div>
  );

  return (
    <>
      <div className="relative group">
        <Card
          className={`relative flex cursor-pointer flex-col overflow-hidden rounded-[1.5rem] border border-white/70 bg-white/96 transition-all hover:shadow-[0_16px_28px_rgba(15,23,42,0.08)] ${
            useCompactLayout ? "" : "aspect-[5/6]"
          }`}
          onClick={handleCardClick}
        >
          {useCompactLayout ? (
            <div className="flex items-stretch gap-3 px-4 py-3">
              {/* Mobile image area */}
              {need.imageUrl ? (
                <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl bg-muted">
                  <img
                    src={need.imageUrl}
                    alt={need.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              ) : (
                <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-xl bg-muted">
                  <CategoryPlaceholder category={need.category} compact />
                </div>
              )}

              {/* Compact content */}
              <div className="min-w-0 flex-1 flex flex-col">
                <h3 className="line-clamp-2 text-[15px] font-semibold leading-[1.3] tracking-[-0.01em] text-slate-950">
                  {need.title}
                </h3>

                {metadataRow}
                {isFeatured ? (
                  <div className="mt-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-amber-800">
                      <Star className="h-2.5 w-2.5 fill-current" />
                      Featured
                    </span>
                  </div>
                ) : null}
                {supportingInfo}

                <div className="mt-auto pt-3">
                  <button
                    data-cta-button
                    data-no-card-click
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!cta.disabled) onPledge?.(need);
                    }}
                    className={`w-full rounded-xl px-3 py-2 text-sm font-bold text-white shadow-md transition-colors ${cta.className}`}
                    disabled={cta.disabled}
                  >
                    {cta.text}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Desktop image area */}
              {need.imageUrl ? (
                <div className="relative w-full h-36 lg:h-40 overflow-hidden bg-muted">
                  <img
                    src={need.imageUrl}
                    alt={need.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              ) : (
                <div className="relative w-full h-36 lg:h-40 bg-slate-100" />
              )}

              {isFeatured && (
                <div className="absolute right-0 top-0 z-10 overflow-hidden rounded-bl-[1.35rem] rounded-tr-[1.5rem] border-b-[3px] border-l-[3px] border-amber-500 bg-amber-400 shadow-[0_10px_22px_rgba(120,53,15,0.18)]">
                  <div className="inline-flex items-center gap-2 px-4 py-2 pr-5 text-[13px] font-extrabold tracking-[-0.01em] text-amber-950">
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span>Featured</span>
                  </div>
                </div>
              )}

              <div className="flex-1 flex flex-col p-5 pb-3">
                <h3 className="line-clamp-2 text-[1.34rem] font-semibold leading-[1.2] tracking-[-0.02em] text-slate-950">
                  {need.title}
                </h3>

                {metadataRow}

                {!isEventCard && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
                    <span className="font-medium">{formatMetaLabel(need.category)}</span>
                    {need.needType === NeedType.GROUP ? <span>Group project</span> : null}
                    {need.needType === NeedType.ONGOING ? <span>Ongoing</span> : null}
                  </div>
                )}

                {supportingInfo}

                <div className="mt-3 flex items-center justify-end">
                  <span className="cursor-pointer text-xs font-medium text-slate-500 transition-colors group-hover:text-slate-700">
                    {seeMoreLabel}
                  </span>
                </div>

                <div className="mt-auto pt-3">
                  <button
                    data-cta-button
                    data-no-card-click
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!cta.disabled) onPledge?.(need);
                    }}
                    className={`w-full h-10 rounded-xl text-sm font-bold text-white shadow-md transition-colors ${cta.className}`}
                    disabled={cta.disabled}
                  >
                    {cta.text}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Admin controls: always visible on mobile */}
          {isAdmin && (
            <div
              className={`flex md:hidden items-center justify-end gap-2 ${
                useCompactLayout ? "px-3 pb-3" : "px-6 pb-4"
              }`}
              data-no-card-click
            >
              {adminButtons}
            </div>
          )}
        </Card>

        {/* Admin Controls — hover on desktop */}
        {isAdmin && (
          <div
            className="absolute right-2 top-14 hidden md:flex items-center gap-2 opacity-0 transition-opacity z-10 group-hover:opacity-100"
            data-no-card-click
          >
            {adminButtons}
          </div>
        )}
      </div>

    </>
  );
};

export default NeedCard;
