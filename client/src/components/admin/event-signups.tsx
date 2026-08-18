import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Need, NeedStatus, NeedType, Pledge } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarCheck2, CalendarDays, Mail, Phone, User, Pencil, Trash2, Loader2, MoreHorizontal, CheckCircle, Edit, ExternalLink, Copy } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  formatDateInNewYork,
  formatDateTimeInNewYork,
  formatEventTimeForDisplay,
  formatTimeRangeForDisplay,
} from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { NeedListItem } from "@/types/need-list-item";
import { buildNeedShareUrl } from "@/lib/public-url";
import { buildEmailDraftUrl, copyTextToClipboard, openEmailDraft } from "@/lib/email-draft";

type EventRoleSummary = {
  id: number;
  name: string;
  slotDate?: string | null;
  startTime: string;
  endTime: string;
  quantity?: number;
};

type EventRoleWithStats = EventRoleSummary & {
  filledCount: number;
  remainingCount: number | null;
  isFull: boolean;
};

type PledgeWithEventRoles = Pledge & {
  selectedEventRoles?: EventRoleSummary[];
};

type EventWithSignups = {
  event: NeedListItem;
  signups: PledgeWithEventRoles[];
  participantCount: number;
};

type EditableSignup = {
  event: NeedListItem;
  signup: PledgeWithEventRoles;
};

type EditSignupFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  organization: string;
  notes: string;
  selectedEventRoleIds: number[];
};

function formatRoleSlot(role: EventRoleSummary): string {
  const dateLabel = role.slotDate
    ? `${formatDateInNewYork(role.slotDate, { month: "2-digit", day: "2-digit", year: "2-digit" })} `
    : "";
  const quantityLabel =
    typeof role.quantity === "number" && role.quantity > 1 ? ` x${role.quantity}` : "";
  return `${role.name}${quantityLabel} (${dateLabel}${formatTimeRangeForDisplay(role.startTime, role.endTime)})`;
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

function collectUniqueEmails(signups: PledgeWithEventRoles[]): string[] {
  return Array.from(
    new Set(
      signups
        .map((signup) => (signup.email || "").trim())
        .filter((email) => email.length > 0)
        .map((email) => email.toLowerCase()),
    ),
  );
}

function getSignupsForSlotDate(signups: PledgeWithEventRoles[], dateKey: string): PledgeWithEventRoles[] {
  return signups.filter((signup) =>
    (signup.selectedEventRoles || []).some((role) => normalizeSlotDateKey(role.slotDate) === dateKey),
  );
}

function getEventSignupDayOptions(signups: PledgeWithEventRoles[]) {
  const dateKeys = Array.from(
    new Set(
      signups.flatMap((signup) =>
        (signup.selectedEventRoles || [])
          .map((role) => normalizeSlotDateKey(role.slotDate))
          .filter((dateKey): dateKey is string => Boolean(dateKey)),
      ),
    ),
  ).sort();

  return dateKeys.map((dateKey) => {
    const signupsForDay = getSignupsForSlotDate(signups, dateKey);
    return {
      dateKey,
      label: formatSlotDateLabel(dateKey),
      emailCount: collectUniqueEmails(signupsForDay).length,
      signups: signupsForDay,
    };
  });
}

function formatEventDate(need: Need): string {
  if (need.eventDate) {
    return formatDateInNewYork(need.eventDate, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  if (need.neededBy) {
    return formatDateInNewYork(need.neededBy, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  return "Date not set";
}

function formatSignupDate(createdAt?: string | Date | null): string {
  return (
    formatDateTimeInNewYork(createdAt, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }) || "Unknown"
  );
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

function hasEventEnded(event: Pick<NeedListItem, "status" | "eventLastDate" | "endDate" | "eventDate" | "neededBy" | "startDate">): boolean {
  if (event.status === NeedStatus.FULFILLED) {
    return true;
  }

  const eventLastDate = event.eventLastDate || event.endDate || event.eventDate || event.neededBy || event.startDate || null;
  if (!eventLastDate) {
    return false;
  }

  return getCurrentDateInNewYork() > eventLastDate;
}

type EventViewTab = "current" | "ended";

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

function toEditFormState(signup: PledgeWithEventRoles): EditSignupFormState {
  return {
    firstName: signup.firstName || "",
    lastName: signup.lastName || "",
    email: signup.email || "",
    phone: signup.phone || "",
    organization: signup.organization || "",
    notes: signup.notes || "",
    selectedEventRoleIds: (signup.selectedEventRoles || []).map((role) => role.id),
  };
}

export default function EventSignups() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [editingSignup, setEditingSignup] = useState<EditableSignup | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditSignupFormState | null>(null);
  const [eventViewTab, setEventViewTab] = useState<EventViewTab>("current");

  const { data: needs, isLoading: isLoadingNeeds } = useQuery<NeedListItem[]>({
    queryKey: ["/api/needs"],
  });

  const { data: pledgesByNeedId, isLoading: isLoadingPledges } = useQuery<Record<string, PledgeWithEventRoles[]>>({
    queryKey: ["/api/all-pledges"],
    enabled: !!needs,
  });

  const { data: editableEventRoles = [], isLoading: isLoadingEditableRoles } = useQuery<EventRoleWithStats[]>({
    queryKey: ["/api/needs", editingSignup?.event.id, "event-roles", "admin-event-signups-edit"],
    queryFn: async () => {
      if (!editingSignup?.event.id) return [];
      const res = await apiRequest("GET", `/api/needs/${editingSignup.event.id}/event-roles`);
      if (!res.ok) {
        throw new Error("Failed to load event slots");
      }
      return await res.json();
    },
    enabled: isEditOpen && !!editingSignup?.event.id,
    staleTime: 30_000,
  });

  const updateSignupMutation = useMutation({
    mutationFn: async (payload: EditSignupFormState) => {
      if (!editingSignup) throw new Error("No sign-up selected");
      const res = await apiRequest("PATCH", `/api/admin/event-signups/${editingSignup.signup.id}`, payload);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/all-pledges"] });
      queryClient.invalidateQueries({ queryKey: ["/api/needs"] });
      if (editingSignup?.event.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/needs", editingSignup.event.id, "event-roles"] });
        queryClient.invalidateQueries({ queryKey: ["/api/needs", editingSignup.event.id, "event-signup-summary"] });
      }
      toast({
        title: "Sign-up updated",
        description: "The participant information was updated.",
      });
      setIsEditOpen(false);
      setEditingSignup(null);
      setEditForm(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Could not update sign-up",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeSignupMutation = useMutation({
    mutationFn: async (signupId: number) => {
      const res = await apiRequest("DELETE", `/api/admin/event-signups/${signupId}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/all-pledges"] });
      queryClient.invalidateQueries({ queryKey: ["/api/needs"] });
      if (editingSignup?.event.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/needs", editingSignup.event.id, "event-roles"] });
        queryClient.invalidateQueries({ queryKey: ["/api/needs", editingSignup.event.id, "event-signup-summary"] });
      }
      toast({
        title: "Sign-up removed",
        description: "The participant has been removed from this event.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not remove sign-up",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateEventStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: NeedStatus }) => {
      const res = await apiRequest("PATCH", `/api/needs/${id}/status`, { status });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/needs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/all-pledges"] });
      toast({
        title: "Event updated",
        description: "The event status has been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not update event",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const duplicateEventMutation = useMutation({
    mutationFn: async (event: NeedListItem) => {
      const res = await apiRequest("POST", `/api/needs/${event.id}/duplicate`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/needs"] });
      toast({
        title: "Event duplicated",
        description: "A draft copy has been created and can be edited.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not duplicate event",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const {
    eventsWithSignups,
    eventsWithoutSignups,
    currentEventsWithSignups,
    currentEventsWithoutSignups,
    endedEventsWithSignups,
    endedEventsWithoutSignups,
    totalSignups,
    totalParticipants,
  } = useMemo(() => {
    const eventNeeds = (needs || [])
      .filter((need) => need.needType === NeedType.EVENT)
      .sort((a, b) => {
        const aDate = new Date(a.eventLastDate || a.endDate || a.eventDate || a.neededBy || a.createdAt || 0).getTime();
        const bDate = new Date(b.eventLastDate || b.endDate || b.eventDate || b.neededBy || b.createdAt || 0).getTime();
        return bDate - aDate;
      });

    const grouped: EventWithSignups[] = eventNeeds.map((event) => {
      const signups = [...(pledgesByNeedId?.[String(event.id)] || [])].sort((a, b) => {
        const aDate = new Date(a.createdAt || 0).getTime();
        const bDate = new Date(b.createdAt || 0).getTime();
        return bDate - aDate;
      });
      const participantCount = signups.reduce((sum, signup) => sum + getSignupParticipantCount(signup), 0);
      return {
        event,
        signups,
        participantCount,
      };
    });

    const currentEntries = grouped.filter((entry) => !hasEventEnded(entry.event));
    const endedEntries = grouped.filter((entry) => hasEventEnded(entry.event));
    const allWithSignups = grouped.filter((entry) => entry.signups.length > 0);
    const allWithoutSignups = grouped.filter((entry) => entry.signups.length === 0);
    const currentWithSignups = currentEntries.filter((entry) => entry.signups.length > 0);
    const currentWithoutSignups = currentEntries.filter((entry) => entry.signups.length === 0);
    const endedWithSignups = endedEntries.filter((entry) => entry.signups.length > 0);
    const endedWithoutSignups = endedEntries.filter((entry) => entry.signups.length === 0);
    const signupCount = allWithSignups.reduce((count, entry) => count + entry.signups.length, 0);
    const participantsCount = allWithSignups.reduce((count, entry) => count + entry.participantCount, 0);

    return {
      eventsWithSignups: allWithSignups,
      eventsWithoutSignups: allWithoutSignups,
      currentEventsWithSignups: currentWithSignups,
      currentEventsWithoutSignups: currentWithoutSignups,
      endedEventsWithSignups: endedWithSignups,
      endedEventsWithoutSignups: endedWithoutSignups,
      totalSignups: signupCount,
      totalParticipants: participantsCount,
    };
  }, [needs, pledgesByNeedId]);

  const visibleEventsWithSignups =
    eventViewTab === "current" ? currentEventsWithSignups : endedEventsWithSignups;
  const visibleEventsWithoutSignups =
    eventViewTab === "current" ? currentEventsWithoutSignups : endedEventsWithoutSignups;

  const eventViewSegments = [
    { value: "current" as const, label: "Current", badge: currentEventsWithSignups.length + currentEventsWithoutSignups.length },
    { value: "ended" as const, label: "Ended", badge: endedEventsWithSignups.length + endedEventsWithoutSignups.length },
  ];

  const isLoading = isLoadingNeeds || isLoadingPledges;

  const openEditDialog = (event: NeedListItem, signup: PledgeWithEventRoles) => {
    setEditingSignup({ event, signup });
    setEditForm(toEditFormState(signup));
    setIsEditOpen(true);
  };

  const handleToggleRole = (roleId: number, checked: boolean) => {
    if (!editForm) return;
    const next = new Set(editForm.selectedEventRoleIds);
    if (checked) {
      next.add(roleId);
    } else {
      next.delete(roleId);
    }
    setEditForm({ ...editForm, selectedEventRoleIds: Array.from(next) });
  };

  const handleSaveEdit = () => {
    if (!editForm || !editingSignup) return;

    if (!editForm.firstName.trim() || !editForm.lastName.trim() || !editForm.email.trim()) {
      toast({
        title: "Missing required fields",
        description: "First name, last name, and email are required.",
        variant: "destructive",
      });
      return;
    }

    if (editableEventRoles.length > 0 && editForm.selectedEventRoleIds.length === 0) {
      toast({
        title: "Select at least one slot",
        description: "Please select one or more event slots for this participant.",
        variant: "destructive",
      });
      return;
    }

    updateSignupMutation.mutate({
      ...editForm,
      firstName: editForm.firstName.trim(),
      lastName: editForm.lastName.trim(),
      email: editForm.email.trim(),
      phone: editForm.phone.trim(),
      organization: editForm.organization.trim(),
      notes: editForm.notes.trim(),
    });
  };

  const handleRemoveSignup = (signup: PledgeWithEventRoles) => {
    const fullName = [signup.firstName, signup.lastName].filter(Boolean).join(" ") || signup.email || "this participant";
    const confirmed = window.confirm(`Remove ${fullName} from this event sign-up list?`);
    if (!confirmed) return;
    removeSignupMutation.mutate(signup.id);
  };

  const handleEditEvent = (event: NeedListItem) => {
    navigate(`/admin/needs/${event.id}/edit`);
  };

  const handleEmailEventParticipants = async (
    event: NeedListItem,
    signups: PledgeWithEventRoles[],
    scopeLabel?: string,
  ) => {
    const uniqueEmails = collectUniqueEmails(signups);

    if (uniqueEmails.length === 0) {
      window.alert(
        scopeLabel
          ? `No email addresses are available for "${event.title}" on ${scopeLabel}.`
          : `No email addresses are available for "${event.title}".`,
      );
      return;
    }

    const copied = await copyTextToClipboard(uniqueEmails.join(", "));
    openEmailDraft(buildEmailDraftUrl({ bcc: uniqueEmails, subject: event.title }));
    toast({
      title: "Email draft opened",
      description: copied
        ? "Participant emails were also copied to your clipboard."
        : "If your email app did not open, copy the participant emails from the sign-up table.",
      variant: copied ? "default" : "destructive",
    });
  };

  const handleOpenPublicEvent = (event: NeedListItem) => {
    window.open(buildNeedShareUrl(event.id), "_blank", "noopener,noreferrer");
  };

  const handleEndEvent = (event: NeedListItem) => {
    const confirmed = window.confirm(`End "${event.title}"? This will close sign-ups and remove it from the public homepage without deleting the event data.`);
    if (!confirmed) return;
    updateEventStatusMutation.mutate({ id: event.id, status: NeedStatus.FULFILLED });
  };

  const renderEventActions = (event: NeedListItem) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={(eventClick) => eventClick.stopPropagation()}
          onPointerDown={(eventClick) => eventClick.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Event actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => handleEditEvent(event)}
        >
          <Edit className="mr-2 h-4 w-4" />
          <span>Edit Details and Slots</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleOpenPublicEvent(event)}
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          <span>Open Public Page</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => duplicateEventMutation.mutate(event)}
          disabled={duplicateEventMutation.isPending}
        >
          <Copy className="mr-2 h-4 w-4" />
          <span>Duplicate Event</span>
        </DropdownMenuItem>
        {event.status !== NeedStatus.FULFILLED && (
          <DropdownMenuItem
            onClick={() => handleEndEvent(event)}
            disabled={updateEventStatusMutation.isPending}
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            <span>End Event</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-10">
          <div className="flex items-center justify-center gap-3 text-sm text-gray-600">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-[#197991]" />
            Loading event sign-ups...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!needs || needs.filter((need) => need.needType === NeedType.EVENT).length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-gray-600">
          No event needs found yet. Create an event need to track sign-ups here.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarCheck2 className="h-4 w-4 text-[#197991]" />
            Events Overview
          </CardTitle>
          <CardDescription>
            {eventsWithSignups.length} events with sign-ups, {eventsWithoutSignups.length} with no sign-ups, {totalSignups} sign-up
            {totalSignups === 1 ? "" : "s"} representing {totalParticipants} participant
            {totalParticipants === 1 ? "" : "s"}.
          </CardDescription>
        </CardHeader>
      </Card>

      <SegmentedControl value={eventViewTab} onValueChange={setEventViewTab} options={eventViewSegments} />

      {visibleEventsWithSignups.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-gray-600">
            {eventViewTab === "current"
              ? "No one has signed up for current events yet."
              : "No one signed up for ended events."}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {eventViewTab === "current" ? "Current Events With Sign-Ups" : "Ended Events With Sign-Ups"}
            </CardTitle>
            <CardDescription>
              {eventViewTab === "current"
                ? "Open an event to manage participant sign-ups or end the event."
                : "Review ended events and the participant history attached to them."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {visibleEventsWithSignups.map(({ event, signups, participantCount }) => {
                const dayEmailOptions = getEventSignupDayOptions(signups);
                const canEmailByDay = dayEmailOptions.length > 1;

                return (
                <AccordionItem key={event.id} value={`event-${event.id}`}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex w-full items-center justify-between gap-3 pr-2 text-left">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm text-gray-900">{event.title}</p>
                        <p className="text-xs text-gray-500">
                          {formatEventDate(event)}
                          {event.eventTime ? ` at ${formatEventTimeForDisplay(event.eventTime)}` : ""}
                          {event.eventLocation ? ` • ${event.eventLocation}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-[#197991] text-white hover:bg-[#197991]">
                          {signups.length} sign-up{signups.length === 1 ? "" : "s"}
                        </Badge>
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border border-emerald-200">
                          {participantCount} participant{participantCount === 1 ? "" : "s"}
                        </Badge>
                        {renderEventActions(event)}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="mb-3 flex flex-wrap gap-2 rounded-md border border-slate-200 bg-slate-50 p-2.5">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleEmailEventParticipants(event, signups)}
                      >
                        <Mail className="h-3.5 w-3.5 mr-1" />
                        Email participants
                      </Button>
                      {canEmailByDay ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              <CalendarDays className="h-3.5 w-3.5 mr-1" />
                              Email by day
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="min-w-[16rem]">
                            <DropdownMenuLabel>Choose a day</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {dayEmailOptions.map((dayOption) => (
                              <DropdownMenuItem
                                key={dayOption.dateKey}
                                onClick={() => handleEmailEventParticipants(event, dayOption.signups, dayOption.label)}
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditEvent(event)}
                      >
                        <Edit className="h-3.5 w-3.5 mr-1" />
                        Edit details and slots
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => duplicateEventMutation.mutate(event)}
                        disabled={duplicateEventMutation.isPending}
                      >
                        <Copy className="h-3.5 w-3.5 mr-1" />
                        Duplicate
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenPublicEvent(event)}
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-1" />
                        Open public page
                      </Button>
                      {event.status !== NeedStatus.FULFILLED ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEndEvent(event)}
                          disabled={updateEventStatusMutation.isPending}
                        >
                          <CheckCircle className="h-3.5 w-3.5 mr-1" />
                          End event
                        </Button>
                      ) : null}
                    </div>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Participant</TableHead>
                            <TableHead>Contact</TableHead>
                            <TableHead>Selected Slots</TableHead>
                            <TableHead>Participants</TableHead>
                            <TableHead>Signed Up</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {signups.map((signup) => (
                            <TableRow key={signup.id}>
                              <TableCell>
                                <div className="space-y-0.5">
                                  <p className="font-medium text-gray-900">
                                    {[signup.firstName, signup.lastName].filter(Boolean).join(" ") || "Unknown name"}
                                  </p>
                                  {signup.organization && (
                                    <p className="text-xs text-gray-500">{signup.organization}</p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <p className="text-sm flex items-center gap-1.5 text-gray-700">
                                    <Mail className="h-3.5 w-3.5" />
                                    {signup.email ? (
                                      <a href={`mailto:${signup.email}`} className="hover:underline">
                                        {signup.email}
                                      </a>
                                    ) : (
                                      "No email"
                                    )}
                                  </p>
                                  <p className="text-sm flex items-center gap-1.5 text-gray-700">
                                    <Phone className="h-3.5 w-3.5" />
                                    {signup.phone ? (
                                      <a href={`tel:${signup.phone}`} className="hover:underline">
                                        {signup.phone}
                                      </a>
                                    ) : (
                                      "No phone"
                                    )}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell>
                                {signup.selectedEventRoles && signup.selectedEventRoles.length > 0 ? (
                                  <div className="space-y-1">
                                    {signup.selectedEventRoles.map((slot) => (
                                      <p key={`${signup.id}-${slot.id}`} className="text-sm text-gray-700">
                                        {formatRoleSlot(slot)}
                                      </p>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-500">General sign-up</p>
                                )}
                              </TableCell>
                              <TableCell className="text-sm font-medium text-gray-800">
                                {getSignupParticipantCount(signup)}
                              </TableCell>
                              <TableCell className="text-sm text-gray-700">
                                {formatSignupDate(signup.createdAt)}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openEditDialog(event, signup)}
                                    disabled={updateSignupMutation.isPending || removeSignupMutation.isPending}
                                  >
                                    <Pencil className="h-3.5 w-3.5 mr-1" />
                                    Edit
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleRemoveSignup(signup)}
                                    disabled={removeSignupMutation.isPending || updateSignupMutation.isPending}
                                  >
                                    {removeSignupMutation.isPending ? (
                                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                                    )}
                                    Remove
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </AccordionContent>
                </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {visibleEventsWithoutSignups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {eventViewTab === "current" ? "Current Events With No Sign-Ups Yet" : "Ended Events With No Sign-Ups"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {visibleEventsWithoutSignups.map(({ event }) => (
              <div key={event.id} className="rounded-md border px-3 py-2 text-sm text-gray-700 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 mt-0.5 text-gray-500" />
                  <div>
                    <p className="font-medium text-gray-900">{event.title}</p>
                    <p className="text-xs text-gray-500">
                      {formatEventDate(event)}
                      {event.eventTime ? ` at ${formatEventTimeForDisplay(event.eventTime)}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleEditEvent(event)}>
                    <Edit className="h-3.5 w-3.5 mr-1" />
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => duplicateEventMutation.mutate(event)} disabled={duplicateEventMutation.isPending}>
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    Duplicate
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleOpenPublicEvent(event)}>
                    <ExternalLink className="h-3.5 w-3.5 mr-1" />
                    Open
                  </Button>
                  {renderEventActions(event)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog
        open={isEditOpen}
        onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open && !updateSignupMutation.isPending) {
            setEditingSignup(null);
            setEditForm(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Event Sign-Up</DialogTitle>
            <DialogDescription>
              Update participant contact details and selected slots.
            </DialogDescription>
          </DialogHeader>

          {!editForm || !editingSignup ? (
            <div className="py-6 text-sm text-gray-500">Select a participant to edit.</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-600">First Name *</p>
                  <Input
                    value={editForm.firstName}
                    onChange={(event) => setEditForm({ ...editForm, firstName: event.target.value })}
                    placeholder="First name"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-600">Last Name *</p>
                  <Input
                    value={editForm.lastName}
                    onChange={(event) => setEditForm({ ...editForm, lastName: event.target.value })}
                    placeholder="Last name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-600">Email *</p>
                  <Input
                    type="email"
                    value={editForm.email}
                    onChange={(event) => setEditForm({ ...editForm, email: event.target.value })}
                    placeholder="email@example.com"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-600">Phone</p>
                  <Input
                    value={editForm.phone}
                    onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-600">Organization</p>
                <Input
                  value={editForm.organization}
                  onChange={(event) => setEditForm({ ...editForm, organization: event.target.value })}
                  placeholder="Church or organization"
                />
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-600">Selected Slots</p>
                {isLoadingEditableRoles ? (
                  <div className="text-sm text-gray-500 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading available slots...
                  </div>
                ) : editableEventRoles.length === 0 ? (
                  <p className="text-sm text-gray-500">No specific slots configured for this event.</p>
                ) : (
                  <div className="rounded-md border max-h-52 overflow-y-auto divide-y">
                    {editableEventRoles.map((role) => {
                      const isChecked = editForm.selectedEventRoleIds.includes(role.id);
                      const isDisabled = role.isFull && !isChecked;
                      return (
                        <label
                          key={role.id}
                          className={`flex items-start gap-2 p-2.5 ${isDisabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                        >
                          <Checkbox
                            checked={isChecked}
                            disabled={isDisabled}
                            onCheckedChange={(checked) => handleToggleRole(role.id, Boolean(checked))}
                            className="mt-0.5"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800">{formatRoleSlot(role)}</p>
                            <p className="text-xs text-slate-500">
                              {role.remainingCount === null
                                ? `${role.filledCount} filled (unlimited)`
                                : `${role.filledCount} filled, ${role.remainingCount} remaining`}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-600">Notes</p>
                <Textarea
                  value={editForm.notes}
                  onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })}
                  placeholder="Optional notes"
                  className="min-h-[90px]"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditOpen(false)}
              disabled={updateSignupMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={updateSignupMutation.isPending || !editForm}
              className="bg-[#197991] hover:bg-[#197991]/90"
            >
              {updateSignupMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
