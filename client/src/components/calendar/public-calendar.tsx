import dayGridPlugin from "@fullcalendar/daygrid";
import type {
  DatesSetArg,
  EventClickArg,
  EventContentArg,
  EventDropArg,
  EventMountArg,
  EventSourceFunc,
} from "@fullcalendar/core";
import type { DateClickArg } from "@fullcalendar/interaction";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import FullCalendar from "@fullcalendar/react";
import { useCallback, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, List, MapPin, Trash2 } from "lucide-react";

import type { CalendarOccurrence } from "@/lib/calendar-domain";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

interface PublicCalendarProps {
  sourceUrl?: string;
  occurrences?: CalendarOccurrence[];
  onDeleteOccurrence?: (occurrence: CalendarOccurrence) => Promise<void> | void;
  deletingOccurrenceId?: string | null;
  onDateClick?: (payload: { date: Date; dateStr: string; allDay: boolean }) => void;
  filterOccurrence?: (occurrence: CalendarOccurrence) => boolean;
  onEventSelect?: (occurrence: CalendarOccurrence) => void;
  onEventDrop?: (payload: {
    occurrence: CalendarOccurrence;
    oldStart: string;
    oldEnd: string;
    newStart: string;
    newEnd: string;
  }) => Promise<void> | void;
}

function CalendarEventContent({ title }: { title: string }) {
  return (
    <div className="clh-event-pill" title={title}>
      {title}
    </div>
  );
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.trim().replace(/^#/, "");
  if (!/^[\da-fA-F]{6}$/.test(normalized)) {
    return `rgba(37, 99, 235, ${alpha})`;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function formatOccurrenceDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatOccurrenceTime(start: string, end: string, allDay: boolean) {
  if (allDay) {
    return "All day";
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${formatter.format(new Date(start))} - ${formatter.format(new Date(end))}`;
}

function EventSheetContent({
  selected,
  actionError,
  onClose,
  onDeleteSelectedOccurrence,
  canDelete,
  deleting,
}: {
  selected: CalendarOccurrence;
  actionError: string | null;
  onClose: () => void;
  onDeleteSelectedOccurrence: () => Promise<void>;
  canDelete: boolean;
  deleting: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-[1.25rem] bg-slate-50 p-4">
        <p className="text-sm font-medium text-slate-900">{selected.title}</p>
        <p className="text-sm text-slate-600">
          {formatOccurrenceDate(selected.occurrenceStart)}
          {selected.occurrenceStart
            ? ` • ${formatOccurrenceTime(selected.occurrenceStart, selected.occurrenceEnd, selected.allDay)}`
            : ""}
        </p>
        {selected.location ? (
          <p className="inline-flex items-center gap-2 text-sm text-slate-600">
            <MapPin className="h-4 w-4" />
            <span>{selected.location}</span>
          </p>
        ) : null}
      </div>

      {selected.descriptionHtml ? (
        <div
          className="rounded-[1.25rem] bg-slate-50 p-4 text-sm leading-7 text-slate-700 [&_a]:text-[hsl(var(--primary))]"
          dangerouslySetInnerHTML={{ __html: selected.descriptionHtml }}
        />
      ) : null}

      {actionError ? <p className="rounded-[1rem] bg-rose-50 px-3 py-2 text-sm text-rose-700">{actionError}</p> : null}

      <div className="flex flex-wrap gap-2">
        {canDelete ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => void onDeleteSelectedOccurrence()}
            disabled={deleting}
            className="w-full justify-center sm:w-auto"
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? "Deleting..." : "Delete occurrence"}
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto">
          Close
        </Button>
      </div>
    </div>
  );
}

export function PublicCalendar({
  sourceUrl,
  occurrences,
  onDeleteOccurrence,
  deletingOccurrenceId,
  onDateClick,
  filterOccurrence,
  onEventSelect,
  onEventDrop,
}: PublicCalendarProps) {
  const isMobile = useIsMobile();
  const calendarRef = useRef<FullCalendar | null>(null);
  const [selected, setSelected] = useState<CalendarOccurrence | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [calendarTitle, setCalendarTitle] = useState("");
  const [isOnToday, setIsOnToday] = useState(true);
  const [currentView, setCurrentView] = useState<"dayGridMonth" | "listMonth">("dayGridMonth");
  const plugins = useMemo(() => [dayGridPlugin, listPlugin, interactionPlugin], []);

  const loadEvents = useCallback<EventSourceFunc>(
    async (info, successCallback, failureCallback) => {
      try {
        let resolvedOccurrences: CalendarOccurrence[] = [];

        if (occurrences) {
          resolvedOccurrences = occurrences.filter((occurrence) => {
            const start = new Date(occurrence.occurrenceStart);
            const end = new Date(occurrence.occurrenceEnd);
            return start < info.end && end > info.start;
          });
        } else if (sourceUrl) {
          const response = await fetch(
            `${sourceUrl}?start=${encodeURIComponent(info.start.toISOString())}&end=${encodeURIComponent(info.end.toISOString())}`,
            { cache: "no-store" },
          );

          if (!response.ok) {
            throw new Error(`Failed to load events (${response.status})`);
          }

          const data = await response.json();
          resolvedOccurrences = (data.events ?? data.occurrences ?? []) as CalendarOccurrence[];
        }

        const visibleOccurrences = filterOccurrence
          ? resolvedOccurrences.filter((occurrence) => filterOccurrence(occurrence))
          : resolvedOccurrences;

        successCallback(
          visibleOccurrences.map((event) => ({
            id: event.id,
            title: event.title,
            allDay: event.allDay,
            start: event.occurrenceStart,
            end: event.occurrenceEnd,
            backgroundColor: event.eventColor,
            borderColor: event.eventColor,
            textColor: event.textColor,
            extendedProps: event,
          })),
        );
      } catch (error) {
        failureCallback(error as Error);
      }
    },
    [filterOccurrence, occurrences, sourceUrl],
  );

  const handleEventClick = useCallback((clickInfo: EventClickArg) => {
    clickInfo.jsEvent.preventDefault();
    const occurrence = clickInfo.event.extendedProps as CalendarOccurrence;

    if (onEventSelect) {
      onEventSelect(occurrence);
      return;
    }

    setActionError(null);
    setSelected(occurrence);
  }, [onEventSelect]);

  const handleEventDrop = useCallback(
    async (dropInfo: EventDropArg) => {
      if (!onEventDrop) {
        dropInfo.revert();
        return;
      }

      const occurrence = dropInfo.oldEvent.extendedProps as CalendarOccurrence;
      const oldStart = dropInfo.oldEvent.start?.toISOString() ?? occurrence.occurrenceStart;
      const oldEnd = dropInfo.oldEvent.end?.toISOString() ?? occurrence.occurrenceEnd;
      const newStart = dropInfo.event.start?.toISOString();
      const newEnd = dropInfo.event.end?.toISOString();

      if (!newStart || !newEnd) {
        dropInfo.revert();
        return;
      }

      try {
        await onEventDrop({
          occurrence,
          oldStart,
          oldEnd,
          newStart,
          newEnd,
        });
        calendarRef.current?.getApi().refetchEvents();
      } catch {
        dropInfo.revert();
      }
    },
    [onEventDrop],
  );

  const handleDateClick = useCallback(
    (clickInfo: DateClickArg) => {
      if (!onDateClick) {
        return;
      }

      onDateClick({
        date: clickInfo.date,
        dateStr: clickInfo.dateStr,
        allDay: clickInfo.allDay,
      });
    },
    [onDateClick],
  );

  async function handleDeleteSelectedOccurrence() {
    if (!selected || !onDeleteOccurrence) {
      return;
    }

    setActionError(null);

    try {
      await onDeleteOccurrence(selected);
      setSelected(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete occurrence";
      setActionError(message);
    }
  }

  const renderEventContent = useCallback((contentArg: EventContentArg) => {
    return <CalendarEventContent title={contentArg.event.title} />;
  }, []);

  const handleEventDidMount = useCallback((mountArg: EventMountArg) => {
    const color = mountArg.event.backgroundColor || mountArg.event.borderColor || "#2563eb";
    const textColor = mountArg.event.textColor || "#ffffff";

    if (mountArg.view.type === "dayGridMonth") {
      mountArg.el.style.backgroundColor = color;
      mountArg.el.style.borderColor = color;
      mountArg.el.style.color = textColor;
      mountArg.el.style.opacity = "1";
      mountArg.el.style.boxShadow = "inset 0 0 0 1px rgba(255,255,255,0.08)";
      return;
    }

    if (mountArg.view.type === "listMonth") {
      const listRow = mountArg.el.closest(".fc-list-event") as HTMLElement | null;
      if (listRow) {
        listRow.style.borderLeft = `4px solid ${color}`;
        listRow.style.backgroundColor = hexToRgba(color, 0.1);
      }

      const dot = mountArg.el.querySelector(".fc-list-event-dot") as HTMLElement | null;
      if (dot) {
        dot.style.borderColor = color;
        dot.style.backgroundColor = color;
      }

      const titleLink = mountArg.el.querySelector(".fc-list-event-title a") as HTMLElement | null;
      if (titleLink) {
        titleLink.style.color = "#0f172a";
        titleLink.style.fontWeight = "600";
      }
    }
  }, []);

  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    setCalendarTitle(arg.view.title);
    if (arg.view.type === "listMonth" || arg.view.type === "dayGridMonth") {
      setCurrentView(arg.view.type);
    }
    const currentDate = arg.view.calendar.getDate();
    setIsOnToday(isSameDay(currentDate, new Date()));
  }, []);

  const goToPrevious = useCallback(() => {
    calendarRef.current?.getApi().prev();
  }, []);

  const goToNext = useCallback(() => {
    calendarRef.current?.getApi().next();
  }, []);

  const goToToday = useCallback(() => {
    calendarRef.current?.getApi().today();
  }, []);

  const switchView = useCallback((view: "dayGridMonth" | "listMonth") => {
    calendarRef.current?.getApi().changeView(view);
  }, []);

  const viewOptions = [
    { value: "dayGridMonth" as const, label: "Month", icon: <CalendarDays className="h-4 w-4" /> },
    { value: "listMonth" as const, label: "List", icon: <List className="h-4 w-4" /> },
  ];

  const canDelete = Boolean(onDeleteOccurrence && selected);
  const deleting = Boolean(selected && deletingOccurrenceId === selected.id);
  const detailContent = selected ? (
    <EventSheetContent
      selected={selected}
      actionError={actionError}
      onClose={() => setSelected(null)}
      onDeleteSelectedOccurrence={handleDeleteSelectedOccurrence}
      canDelete={canDelete}
      deleting={deleting}
    />
  ) : null;

  return (
    <>
      <div className="mb-4 rounded-[1.5rem] border border-slate-200 bg-white/96 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Calendar</p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-slate-950">{calendarTitle}</h2>
          </div>

          <div className="flex flex-col gap-3 md:items-end">
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="icon" onClick={goToPrevious} aria-label="Previous">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button type="button" variant={isOnToday ? "secondary" : "outline"} onClick={goToToday} disabled={isOnToday}>
                Today
              </Button>
              <Button type="button" variant="outline" size="icon" onClick={goToNext} aria-label="Next">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <SegmentedControl value={currentView} onValueChange={switchView} options={viewOptions} />
          </div>
        </div>
      </div>

      <FullCalendar
        ref={calendarRef}
        plugins={plugins}
        initialView="dayGridMonth"
        headerToolbar={false}
        dayMaxEvents
        moreLinkClick="popover"
        height="auto"
        eventDisplay="block"
        displayEventTime={false}
        eventTimeFormat={{
          hour: "numeric",
          minute: "2-digit",
          meridiem: "short",
        }}
        eventContent={renderEventContent}
        eventDidMount={handleEventDidMount}
        events={loadEvents}
        eventClick={handleEventClick}
        editable={Boolean(onEventDrop)}
        eventStartEditable={Boolean(onEventDrop)}
        eventDurationEditable={false}
        eventDrop={handleEventDrop}
        dateClick={handleDateClick}
        datesSet={handleDatesSet}
      />

      {isMobile ? (
        <Drawer open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{selected?.title || "Event"}</DrawerTitle>
              <DrawerDescription>{selected ? formatOccurrenceDate(selected.occurrenceStart) : "Event details"}</DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-5">{detailContent}</div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>{selected?.title || "Event"}</DialogTitle>
              <DialogDescription>{selected ? formatOccurrenceDate(selected.occurrenceStart) : "Event details"}</DialogDescription>
            </DialogHeader>
            {detailContent}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
