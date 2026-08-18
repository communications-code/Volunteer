import { useState, type ComponentType } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Need, NeedStatus, NeedType, type EventSignupSummary } from "@shared/schema";
import { useCategories } from "@/hooks/use-categories";
import {
  Calendar,
  Clock,
  MapPin,
  DollarSign,
  Share,
  HelpCircle,
  Users,
} from "lucide-react";
import ShareDialog from "@/components/share-dialog";
import { formatDateInNewYork, formatEventTimeForDisplay, formatTimeRangeForDisplay, isPastNewYorkDate } from "@/lib/utils";
import { buildNeedShareUrl } from "@/lib/public-url";
import { apiRequest } from "@/lib/queryClient";

interface NeedDetailDialogProps {
  need: Need | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  variant?: "dialog" | "page";
}

type DetailItem = {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
};

type EventRoleWithStats = {
  id: number;
  name: string;
  slotDate?: string | null;
  startTime: string;
  endTime: string;
  capacity: number | null;
  filledCount: number;
  remainingCount: number | null;
  isFull: boolean;
};

const NeedDetailDialog = ({
  need,
  open = false,
  onOpenChange,
  variant = "dialog",
}: NeedDetailDialogProps) => {
  const [shareOpen, setShareOpen] = useState(false);
  const [_, navigate] = useLocation();
  const isDialogVariant = variant === "dialog";
  const { data: dbCategories } = useCategories();
  const eventSlugs = new Set((dbCategories || []).filter((c) => c.isEvent).map((c) => c.slug));
  const needId = need?.id ?? 0;
  const isEventNeed = need?.needType === NeedType.EVENT;
  const isEvent = need ? eventSlugs.has(need.category) : false;
  const {
    data: rawEventRoles = [],
    isLoading: isEventRolesLoading,
  } = useQuery<EventRoleWithStats[]>({
    queryKey: ["/api/needs", needId, "event-roles"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/needs/${needId}/event-roles`);
      return await res.json();
    },
    enabled: (isDialogVariant ? open : true) && needId > 0 && Boolean(isEventNeed),
    staleTime: 30_000,
  });
  const eventRoles = rawEventRoles.filter((role) => !isPastNewYorkDate(role.slotDate || need?.eventDate));
  const {
    data: eventSignupSummary,
    isLoading: isEventSignupSummaryLoading,
  } = useQuery<EventSignupSummary>({
    queryKey: ["/api/needs", needId, "event-signup-summary"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/needs/${needId}/event-signup-summary`);
      return await res.json();
    },
    enabled: (isDialogVariant ? open : true) && needId > 0 && Boolean(isEventNeed),
    staleTime: 15_000,
  });

  if (!need) return null;

  const shareUrl = buildNeedShareUrl(
    need.id,
    import.meta.env.VITE_PUBLIC_URL as string | undefined,
  );

  const roleBasedSignupsCount = eventRoles.reduce((sum, role) => sum + role.filledCount, 0);
  const totalRoleCapacity = eventRoles.some((role) => role.capacity === null)
    ? null
    : eventRoles.reduce((sum, role) => sum + (role.capacity || 0), 0);
  const fallbackEventSummary: EventSignupSummary = {
    slotSignupsTotal: eventRoles.length > 0 ? roleBasedSignupsCount : (need.volunteersCount || 0),
    slotCapacityTotal: eventRoles.length > 0 ? totalRoleCapacity : (need.volunteersNeeded ?? null),
    uniquePeopleTotal: need.volunteersCount || 0,
    hasRoleSlots: eventRoles.length > 0,
  };
  const resolvedEventSummary = isEventNeed ? (eventSignupSummary ?? fallbackEventSummary) : null;

  const handleShare = () => {
    setShareOpen(true);
  };

  const openPledgePage = () => {
    if (isDialogVariant) {
      onOpenChange?.(false);
    }
    navigate(`/pledge/${need.id}`);
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return "";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount / 100);
  };

  const formatDate = (date?: Date | string | null) => {
    if (!date) return "Not specified";
    return (
      formatDateInNewYork(date, {
        year: "numeric",
        month: "long",
        day: "numeric",
      }) || "Not specified"
    );
  };

  const getStatusLabel = () => {
    if (need.needType === NeedType.GROUP && need.status !== NeedStatus.FULFILLED) {
      return "Volunteers Needed";
    }

    if (need.status === NeedStatus.FLOATING) {
      if (need.needType === NeedType.EVENT) return "Open for Sign-Ups";
      if (isEvent) return "Volunteers Needed";
      return "Still Needed";
    }

    if (need.status === NeedStatus.PLEDGED) return "Pledged";
    if (need.status === NeedStatus.FULFILLED) return "Fulfilled";
    if (need.status === NeedStatus.RECURRING) return "Recurring";
    return need.status;
  };

  const detailItems: DetailItem[] = [];

  if (need.needType === NeedType.ONGOING) {
    const timeline = need.startDate && need.endDate
      ? `From ${formatDate(need.startDate)} to ${formatDate(need.endDate)}`
      : need.startDate
        ? `Starting ${formatDate(need.startDate)}`
        : `Until ${formatDate(need.endDate || need.neededBy)}`;

    detailItems.push({
      label: "Timeline",
      value: timeline,
      icon: Calendar,
    });
  } else {
    if (need.eventDate && (isEvent || need.needType === NeedType.GROUP || need.needType === NeedType.EVENT)) {
      detailItems.push({
        label: "Event Date",
        value: formatDate(need.eventDate),
        icon: Calendar,
      });
    }

    if (need.eventTime && (isEvent || need.needType === NeedType.EVENT)) {
      detailItems.push({
        label: "Event Time",
        value: formatEventTimeForDisplay(need.eventTime),
        icon: Clock,
      });
    }

    if (need.eventLocation && (isEvent || need.needType === NeedType.EVENT)) {
      detailItems.push({
        label: "Location",
        value: need.eventLocation,
        icon: MapPin,
      });
    }

    if (need.neededBy) {
      detailItems.push({
        label: "Needed By",
        value: formatDate(need.neededBy),
        icon: Calendar,
      });
    }
  }

  if (need.estimatedCost) {
    detailItems.push({
      label: "Cost",
      value: formatCurrency(need.estimatedCost),
      icon: DollarSign,
    });
  }

  if (need.needType === NeedType.GROUP) {
    const countValue = need.volunteersNeeded
      ? `${need.volunteersCount || 0}/${need.volunteersNeeded} Volunteers`
      : `${need.volunteersCount || 0} Volunteers (Unlimited)`;

    detailItems.push({
      label: "Volunteers",
      value: countValue,
      icon: Users,
    });
  }

  if (detailItems.length === 0) {
    detailItems.push({
      label: "Need Type",
      value: need.needType,
      icon: HelpCircle,
    });
  }

  const hasDescription = Boolean((need.description || "").trim());
  const slotsFilledValue =
    isEventSignupSummaryLoading && !eventSignupSummary
      ? "Loading..."
      : resolvedEventSummary
        ? resolvedEventSummary.slotCapacityTotal === null
          ? `${resolvedEventSummary.slotSignupsTotal} (Unlimited)`
          : `${resolvedEventSummary.slotSignupsTotal} / ${resolvedEventSummary.slotCapacityTotal}`
        : "0";
  const peopleSignedUpValue =
    isEventSignupSummaryLoading && !eventSignupSummary
      ? "Loading..."
      : `${resolvedEventSummary?.uniquePeopleTotal || 0}`;
  const summaryCardTitle =
    need.needType === NeedType.EVENT
      ? "Sign-Up Snapshot"
      : need.needType === NeedType.GROUP
        ? "Volunteer Snapshot"
        : "Need Snapshot";
  const summaryAccentClass = "text-slate-700";
  const summaryItems: Array<{ label: string; value: string }> =
    need.needType === NeedType.EVENT
      ? [
          { label: "Slots Filled", value: slotsFilledValue },
          { label: "People Signed Up", value: peopleSignedUpValue },
        ]
      : need.needType === NeedType.GROUP
        ? [
            {
              label: "Volunteers",
              value: need.volunteersNeeded
                ? `${need.volunteersCount || 0} / ${need.volunteersNeeded}`
                : `${need.volunteersCount || 0} (Unlimited)`,
            },
            { label: "Status", value: getStatusLabel() },
          ]
        : [
            { label: "Status", value: getStatusLabel() },
            {
              label: need.estimatedCost ? "Estimated Cost" : "Needed By",
              value: need.estimatedCost ? formatCurrency(need.estimatedCost) : formatDate(need.neededBy),
            },
          ];
  const summaryHelperText = need.needType === NeedType.EVENT
    ? "Slots count selected roles. One person can choose multiple slots."
    : "Use the action below to respond to this need.";

  const renderActionButton = () => {
    if (need.status === NeedStatus.RECURRING) {
      return (
        <Button
          className="w-full"
          onClick={openPledgePage}
        >
          Contribute
        </Button>
      );
    }

    if (need.needType === NeedType.GROUP) {
      if (need.status !== NeedStatus.FULFILLED) {
        return (
          <Button
            className="w-full"
            onClick={openPledgePage}
          >
            Sign Up to Volunteer
          </Button>
        );
      }

      return <div className="text-center text-gray-500 italic w-full">This need has been fulfilled</div>;
    }

    if (need.needType === NeedType.EVENT) {
      if (need.status !== NeedStatus.PLEDGED && need.status !== NeedStatus.FULFILLED) {
        return (
          <Button
            className="w-full"
            onClick={openPledgePage}
          >
            Sign Up
          </Button>
        );
      }

      if (need.status === NeedStatus.FULFILLED) {
        return <div className="text-center text-gray-500 italic w-full">This event has been fulfilled</div>;
      }

      return <div className="text-center text-gray-500 italic w-full">Registration is full</div>;
    }

    if (need.status === NeedStatus.FLOATING) {
      return (
        <Button
          className="w-full"
          onClick={openPledgePage}
        >
          {isEvent ? "Sign Up" : "Pledge to Help"}
        </Button>
      );
    }

    return (
      <div className="text-center text-gray-500 italic w-full">
        {need.status === NeedStatus.PLEDGED
          ? "This need has been pledged"
          : need.status === NeedStatus.FULFILLED
            ? "This need has been fulfilled"
            : ""}
      </div>
    );
  };

  const renderRoleCards = (maxHeightClass = "max-h-56") => {
    if (isEventRolesLoading) {
      return <p className="text-xs text-slate-500">Loading role details...</p>;
    }

    if (eventRoles.length === 0) {
      return (
        <p className="text-xs text-slate-600">
          {rawEventRoles.length > 0
            ? "No current role slots are available for this event."
            : "No specific role slots are configured for this event."}
        </p>
      );
    }

    return (
      <div className={`space-y-1.5 overflow-y-auto pr-1 ${maxHeightClass}`}>
        {eventRoles.map((role) => {
          const roleDate = role.slotDate || need.eventDate;
          return (
            <div
              key={role.id}
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5"
            >
              <p className="text-xs font-medium text-slate-800">{role.name}</p>
              <p className="text-[11px] text-slate-500">
                {roleDate
                  ? formatDateInNewYork(roleDate, {
                      month: "2-digit",
                      day: "2-digit",
                      year: "2-digit",
                      weekday: "long",
                    })
                  : "Date TBD"}
              </p>
              <p className="text-[11px] text-slate-500">
                {formatTimeRangeForDisplay(role.startTime, role.endTime)}
              </p>
              <p className="text-[11px] text-slate-600">
                {role.remainingCount === null
                  ? `${role.filledCount} filled (unlimited)`
                  : `${role.filledCount}/${role.capacity} filled`}
              </p>
            </div>
          );
        })}
      </div>
    );
  };

  const pageContent = (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="relative border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(25,121,145,0.14),transparent_55%),linear-gradient(145deg,rgba(255,255,255,1),rgba(248,250,252,1))] px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            {need.imageUrl ? (
              <img
                src={need.imageUrl}
                alt={need.title}
                className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl border border-slate-200 object-cover flex-shrink-0 bg-white"
              />
            ) : (
              <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400 flex-shrink-0">
                <HelpCircle className="h-5 w-5" />
              </div>
            )}

            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Need Details</p>
              <h1 className="mt-2 text-2xl font-bold leading-tight text-[#212421] sm:text-3xl">
                {need.title}
              </h1>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="hidden md:inline-flex rounded-full px-3 h-9"
            onClick={handleShare}
          >
            <Share className="h-4 w-4 mr-1.5" />
            Share
          </Button>
        </div>

        <div className="mt-4 space-y-2 md:hidden">
          <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
            {renderActionButton()}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full rounded-full h-9"
            onClick={handleShare}
          >
            <Share className="h-4 w-4 mr-1.5" />
            Share
          </Button>
        </div>

        {detailItems.length > 0 && (
          <div className="mt-4 border-t border-slate-200 pt-3">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {detailItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={`inline-${item.label}-${item.value}`} className="flex items-center gap-1.5 text-sm text-slate-700">
                    <Icon className="h-3.5 w-3.5 text-slate-500" />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">{item.label}</span>
                    <span className="font-medium text-slate-800">{item.value}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="p-4 sm:p-6">
        <div className="grid gap-4 xl:grid-cols-12">
          <div className="xl:col-span-8 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-[#212421] mb-3">Description</h3>
            {hasDescription ? (
              <div
                className="text-sm text-slate-700 leading-relaxed break-words whitespace-pre-wrap
                  [&_h1]:text-base [&_h1]:font-semibold [&_h1]:mb-2
                  [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mb-2
                  [&_p]:mb-3 [&_p:last-child]:mb-0
                  [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3
                  [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3
                  [&_li]:mb-1
                  [&_strong]:font-semibold
                  [&_a]:text-[hsl(var(--primary))] [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: need.description }}
              />
            ) : (
              <p className="text-sm text-slate-700 leading-relaxed">No description provided.</p>
            )}
          </div>

          <div className="xl:col-span-4 space-y-4">
            {isEventNeed && (
              <div className={`rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5 min-h-[390px] flex flex-col shadow-sm ${summaryAccentClass}`}>
                <h3 className="text-sm font-semibold text-[#212421] mb-3">Sign-Up Roles</h3>
                <div className="flex-1 min-h-0">
                  {renderRoleCards("max-h-[300px]")}
                </div>
                <div className="mt-4 pt-3 border-t border-slate-200 hidden md:block">
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    {renderActionButton()}
                  </div>
                </div>
              </div>
            )}

            <div
              className={`rounded-2xl border border-slate-200 shadow-sm ${
                isEventNeed ? "bg-white p-3 sm:p-4" : `bg-slate-50 p-4 sm:p-5 ${summaryAccentClass}`
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700">{summaryCardTitle}</p>
              <div className={isEventNeed ? "mt-2 grid grid-cols-2 gap-2" : "mt-3 space-y-2"}>
                {summaryItems.map((item) => (
                  <div key={item.label} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-slate-600">{item.label}</p>
                    <p className={`${isEventNeed ? "text-base" : "text-lg"} font-semibold text-slate-900`}>{item.value}</p>
                  </div>
                ))}
              </div>
              <p className={`${isEventNeed ? "mt-2" : "mt-3"} text-xs text-slate-600`}>{summaryHelperText}</p>
              {!isEventNeed && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 hidden md:block">
                  {renderActionButton()}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const defaultContent = (
    <div className={isDialogVariant ? "bg-white max-h-[92vh] flex flex-col" : "bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col"}>
      <div className={`px-4 sm:px-5 py-4 border-b bg-gradient-to-b from-white to-slate-50 ${isDialogVariant ? "pr-11 sm:pr-12" : ""}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-[#212421] leading-tight line-clamp-2">
              {need.title}
            </h1>
            <p className="text-xs text-slate-500 mt-1">Need details</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full p-0 w-8 h-8 flex items-center justify-center flex-shrink-0"
            onClick={handleShare}
          >
            <Share className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-3 md:hidden rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
          {renderActionButton()}
        </div>
      </div>

      <div className={`p-4 sm:p-5 ${isDialogVariant ? "flex-1 min-h-0 flex flex-col" : "flex flex-col"}`}>
        <div className={isDialogVariant ? "flex-1 min-h-0 overflow-y-auto md:overflow-hidden" : ""}>
          <div className={`grid items-start gap-3 md:grid-cols-[minmax(0,1fr)_360px] ${isDialogVariant ? "md:h-full" : ""}`}>
            <div className={`space-y-3 ${isDialogVariant ? "md:min-h-0 md:overflow-y-auto md:pr-1" : ""}`}>
              {need.imageUrl ? (
                <img
                  src={need.imageUrl}
                  alt={need.title}
                  className="w-full h-36 sm:h-44 md:h-40 object-cover rounded-xl border border-slate-200"
                />
              ) : (
                <div className="w-full h-36 sm:h-44 md:h-40 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400">
                  <HelpCircle className="h-6 w-6 mr-2" /> No image provided
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <h3 className="text-xs font-semibold text-[#212421] mb-2">Description</h3>
                {hasDescription ? (
                  <div
                    className={`${isDialogVariant ? "max-h-[42vh] overflow-y-auto pr-2 " : ""}text-sm text-slate-700 leading-relaxed break-words whitespace-pre-wrap
                      [&_h1]:text-base [&_h1]:font-semibold [&_h1]:mb-2
                      [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mb-2
                      [&_p]:mb-3 [&_p:last-child]:mb-0
                      [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3
                      [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3
                      [&_li]:mb-1
                      [&_strong]:font-semibold
                      [&_a]:text-[hsl(var(--primary))] [&_a]:underline`}
                    dangerouslySetInnerHTML={{ __html: need.description }}
                  />
                ) : (
                  <p className="text-sm text-slate-700 leading-relaxed">No description provided.</p>
                )}
              </div>
            </div>

            <div className={`rounded-xl border border-slate-200 bg-white p-3 self-start ${isDialogVariant ? "md:min-h-0 md:overflow-y-auto" : ""}`}>
              <h3 className="text-xs font-semibold text-[#212421] mb-2">Details</h3>
              <div className="grid grid-cols-1 gap-2">
                {detailItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={`${item.label}-${item.value}`} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                      <div className="flex items-start gap-2">
                        <Icon className="h-4 w-4 text-[hsl(var(--primary))] mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">{item.label}</p>
                          <p className="text-xs sm:text-sm text-slate-700 leading-snug break-words">{item.value}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {isEventNeed && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5 space-y-2">
                  <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                    Sign-Ups
                  </p>
                  <div className="rounded-md border border-slate-200 bg-white p-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Slots Filled
                    </p>
                    <p className="text-sm font-medium text-slate-800">{slotsFilledValue}</p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-white p-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      People Signed Up
                    </p>
                    <p className="text-sm font-medium text-slate-800">{peopleSignedUpValue}</p>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2">
                    Slots count selected roles. One person can choose multiple slots.
                  </p>
                </div>
              )}

              {isEventNeed && (
                <>
                  <div className="hidden md:block mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                    <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2">
                      Sign-Up Roles
                    </p>
                    {renderRoleCards()}
                  </div>

                  <Accordion type="single" collapsible className="md:hidden mt-3 rounded-lg border border-slate-200 bg-slate-50 px-2.5">
                    <AccordionItem value="sign-up-roles" className="border-none">
                      <AccordionTrigger className="py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))] rounded-sm">
                        Sign-Up Roles
                      </AccordionTrigger>
                      <AccordionContent className="pt-0 pb-2">
                        {renderRoleCards()}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t bg-white shrink-0 hidden md:block">{renderActionButton()}</div>
      </div>
    </div>
  );
  const content = isDialogVariant ? defaultContent : pageContent;

  return (
    <>
      {isDialogVariant ? (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="w-[95vw] max-w-5xl rounded-3xl p-0 border border-slate-200 shadow-xl overflow-hidden animate-scale-in max-h-[92vh]">
            {content}
          </DialogContent>
        </Dialog>
      ) : (
        <div className="w-full">{content}</div>
      )}

      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} title={need.title} url={shareUrl} />
    </>
  );
};

export default NeedDetailDialog;
