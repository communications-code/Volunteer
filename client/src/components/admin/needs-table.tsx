import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Need, NeedStatus, NeedType, Pledge } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Edit, Trash, CheckCircle, AlertCircle, Info, Copy, Send, FileEdit, RefreshCw, UserCheck, HandHelping, MessageCircle, Star, User, Lock, ExternalLink, Mail } from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { buildNeedShareUrl } from "@/lib/public-url";
import { buildEmailDraftUrl, copyTextToClipboard, openEmailDraft } from "@/lib/email-draft";
import { formatDateInNewYork, formatTimeRangeForDisplay } from "@/lib/utils";

interface NeedsTableProps {
  filterStatus?: NeedStatus[];
  filterCategory?: string;
  needsOverride?: Need[];
  pledgesByNeedIdOverride?: Record<string, PledgeWithEventRoles[]>;
  sortByRecent?: boolean;
}

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

function needMatchesCategory(need: Need, targetCategory?: string): boolean {
  const targetToken = normalizeCategoryToken(targetCategory);
  if (!targetToken) return true;

  const categoryValues = [
    ...parseNeedCategorySelections(need.categorySelections),
    need.category,
  ].filter(Boolean);

  return categoryValues.some((category) => normalizeCategoryToken(category) === targetToken);
}

const NeedsTable = ({
  filterStatus,
  filterCategory,
  needsOverride,
  pledgesByNeedIdOverride,
  sortByRecent = false,
}: NeedsTableProps = {}) => {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [selectedNeed, setSelectedNeed] = useState<Need | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pledgeDetailsOpen, setpledgeDetailsOpen] = useState(false);
  const [recipientInfoOpen, setRecipientInfoOpen] = useState(false);
  const [emailingNeedId, setEmailingNeedId] = useState<number | null>(null);
  // Track which needs have pledges
  const [needsWithPledges, setNeedsWithPledges] = useState<Record<number, PledgeWithEventRoles[]>>({});
  
  const { data: allNeeds, isLoading } = useQuery<Need[]>({
    queryKey: ['/api/needs'],
    enabled: !needsOverride,
  });

  const sourceNeeds = needsOverride ?? allNeeds;
  
  const needs = useMemo(() => {
    const filteredNeeds = sourceNeeds?.filter(need =>
      (!filterStatus || filterStatus.length === 0 || filterStatus.includes(need.status as NeedStatus)) &&
      needMatchesCategory(need, filterCategory)
    );

    if (!sortByRecent || !filteredNeeds) return filteredNeeds;

    return [...filteredNeeds].sort((a, b) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateB.getTime() - dateA.getTime();
    });
  }, [filterCategory, filterStatus, sortByRecent, sourceNeeds]);

  const needsRefetchKey = useMemo(
    () => needs?.map((need) => need.id).join(",") ?? "",
    [needs],
  );

  // Get pledges for the selected need when the dialog is open
  const { 
    data: pledges, 
    isLoading: isPledgesLoading,
    refetch: refetchPledges 
  } = useQuery<PledgeWithEventRoles[]>({
    queryKey: ['/api/needs', selectedNeed?.id, 'pledges'],
    queryFn: async () => {
      if (!selectedNeed) return [];
      const res = await apiRequest("GET", `/api/needs/${selectedNeed.id}/pledges`);
      if (!res.ok) {
        throw new Error("Failed to fetch pledges");
      }
      return await res.json();
    },
    enabled: pledgeDetailsOpen && !!selectedNeed,
  });

  const { data: eventRolesWithStats = [] } = useQuery<EventRoleWithStats[]>({
    queryKey: ["/api/needs", selectedNeed?.id, "event-roles", "admin-table"],
    queryFn: async () => {
      if (!selectedNeed) return [];
      const res = await apiRequest("GET", `/api/needs/${selectedNeed.id}/event-roles`);
      if (!res.ok) {
        throw new Error("Failed to fetch event role summary");
      }
      return await res.json();
    },
    enabled: pledgeDetailsOpen && selectedNeed?.needType === NeedType.EVENT,
    staleTime: 30_000,
  });
  
  // Ensure we refetch pledges when the dialog opens to get fresh data
  useEffect(() => {
    if (pledgeDetailsOpen && selectedNeed) {
      refetchPledges();
    }
  }, [pledgeDetailsOpen, selectedNeed, refetchPledges]);
  
  // Use TanStack Query to fetch all pledges at once
  const { 
    data: allPledges, 
    isLoading: isAllPledgesLoading,
    refetch: refetchAllPledges 
  } = useQuery<Record<string, PledgeWithEventRoles[]>>({
    queryKey: ['/api/all-pledges'],
    queryFn: async () => {
      // Directly fetch from the server instead of doing it client-side
      const res = await apiRequest("GET", '/api/all-pledges');
      if (!res.ok) {
        throw new Error("Failed to fetch pledges");
      }
      return await res.json();
    },
    enabled: !pledgesByNeedIdOverride && !!needs && needs.length > 0,
    staleTime: 30000, // Cache for 30 seconds to allow for more frequent updates
    refetchInterval: 60000, // Auto-refresh every minute to catch new pledges
  });
  
  // When needs are loaded or a dialog is closed, refresh the pledges data
  useEffect(() => {
    if (!pledgesByNeedIdOverride && needs && needs.length > 0) {
      refetchAllPledges();
    }
  }, [needsRefetchKey, pledgeDetailsOpen, pledgesByNeedIdOverride, refetchAllPledges]);
  
  // Update the needs with pledges when all pledges data is fetched
  useEffect(() => {
    const pledgeSource = pledgesByNeedIdOverride ?? allPledges;

    if (pledgeSource) {
      // Convert string keys to numbers and create a properly typed record
      const typedPledges: Record<number, PledgeWithEventRoles[]> = {};
      Object.entries(pledgeSource).forEach(([key, pledges]) => {
        typedPledges[parseInt(key)] = pledges;
      });
      setNeedsWithPledges(typedPledges);
    }
  }, [allPledges, pledgesByNeedIdOverride]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number, status: NeedStatus }) => {
      const res = await apiRequest("PATCH", `/api/needs/${id}/status`, { status });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/needs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/all-pledges'] });
      toast({
        title: "Status updated",
        description: "The need status has been updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const duplicateToDraftMutation = useMutation({
    mutationFn: async (need: Need) => {
      const res = await apiRequest("POST", `/api/needs/${need.id}/duplicate`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/needs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/all-pledges'] });
      toast({
        title: "Need duplicated",
        description: "A draft copy has been created and can be edited.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error duplicating need",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteNeedMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/needs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/needs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/all-pledges'] });
      toast({
        title: "Need deleted",
        description: "The need has been deleted successfully.",
      });
      setDeleteDialogOpen(false);
      setSelectedNeed(null);
    },
    onError: (error) => {
      toast({
        title: "Error deleting need",
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/needs'] });
      toast({
        title: data.isHighlighted ? "Need highlighted" : "Highlight removed",
        description: data.isHighlighted 
          ? "This need will now appear in the Highlighted section" 
          : "This need has been removed from the Highlighted section",
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating highlight status",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const handleDelete = () => {
    if (selectedNeed) {
      deleteNeedMutation.mutate(selectedNeed.id);
    }
  };

  const handleMarkFulfilled = (need: Need) => {
    updateStatusMutation.mutate({ id: need.id, status: NeedStatus.FULFILLED });
  };

  const handleViewLiveNeed = (need: Need) => {
    window.open(buildNeedShareUrl(need.id), "_blank", "noopener,noreferrer");
  };

  const formatPledgeContactSummary = (pledge: PledgeWithEventRoles) => {
    const name = [pledge.firstName, pledge.lastName].filter(Boolean).join(" ").trim() || "Unnamed sign-up";
    const details = [
      pledge.phone ? `phone: ${pledge.phone}` : null,
      pledge.organization ? `organization: ${pledge.organization}` : null,
      pledge.notes ? `notes: ${pledge.notes}` : null,
    ].filter(Boolean);
    return details.length > 0 ? `${name} (${details.join(", ")})` : `${name} (no other contact info provided)`;
  };

  const openPledgeEmailDraft = async (need: Need, knownPledges?: PledgeWithEventRoles[]) => {
    setEmailingNeedId(need.id);
    try {
      let pledgeRows = knownPledges;

      if (!pledgeRows) {
        const res = await apiRequest("GET", `/api/needs/${need.id}/pledges`);
        if (!res.ok) {
          throw new Error("Failed to fetch pledge contacts");
        }
        pledgeRows = await res.json();
      }

      const uniqueEmails = Array.from(
        new Set(
          (pledgeRows || [])
            .map((pledge) => (pledge.email || "").trim())
            .filter((email) => email.length > 0)
            .map((email) => email.toLowerCase()),
        ),
      );

      const missingEmailContacts = (pledgeRows || []).filter((pledge) => !(pledge.email || "").trim());

      if (missingEmailContacts.length > 0) {
        window.alert(
          [
            `${missingEmailContacts.length} sign-up${missingEmailContacts.length === 1 ? "" : "s"} for "${need.title}" do not have an email address.`,
            "Available contact information:",
            ...missingEmailContacts.map(formatPledgeContactSummary),
          ].join("\n"),
        );
      }

      if (uniqueEmails.length === 0) {
        window.alert(`No email addresses are available for "${need.title}".`);
        return;
      }

      const copied = await copyTextToClipboard(uniqueEmails.join(", "));
      openEmailDraft(buildEmailDraftUrl({ bcc: uniqueEmails, subject: need.title }));
      toast({
        title: "Email draft opened",
        description: copied
          ? "Participant emails were also copied to your clipboard."
          : "If your email app did not open, copy the participant emails from the pledge list.",
        variant: copied ? "default" : "destructive",
      });
    } catch (error) {
      toast({
        title: "Could not open email",
        description: error instanceof Error ? error.message : "Unable to load pledge contacts.",
        variant: "destructive",
      });
    } finally {
      setEmailingNeedId(null);
    }
  };

  const getCloseActionLabel = (need: Need) =>
    need.needType === NeedType.EVENT ? "End Event" : "Mark as Fulfilled";

  const formatDate = (dateString?: string | Date | null) => {
    if (!dateString) return "Not specified";
    const formatted = formatDateInNewYork(dateString, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    return formatted || "Not specified";
  };

  const formatRoleSlot = (role: EventRoleSummary) =>
    `${role.name}${typeof role.quantity === "number" && role.quantity > 1 ? ` x${role.quantity}` : ""} (${role.slotDate ? `${formatDateInNewYork(role.slotDate, {
      month: "2-digit",
      day: "2-digit",
      year: "2-digit",
    })} ` : ""}${formatTimeRangeForDisplay(role.startTime, role.endTime)})`;

  if (!needsOverride && isLoading) {
    return (
      <div className="flex justify-center items-center h-48">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#C75439]"></div>
      </div>
    );
  }

  const statusStyles = {
    [NeedStatus.DRAFT]: "bg-slate-500",
    [NeedStatus.FLOATING]: "bg-gray-500",
    [NeedStatus.PLEDGED]: "bg-blue-500",
    [NeedStatus.FULFILLED]: "bg-green-500",
    [NeedStatus.UNFULFILLED]: "bg-red-600",
    [NeedStatus.RECURRING]: "bg-[#197991]",
  };

  // We're keeping the original labels in the admin view for clarity,
  // but also adding a function that gets user-friendly labels for the frontend
  const statusLabels = {
    [NeedStatus.DRAFT]: "Draft",
    [NeedStatus.FLOATING]: "Open",
    [NeedStatus.PLEDGED]: "Pledged",
    [NeedStatus.FULFILLED]: "Fulfilled",
    [NeedStatus.UNFULFILLED]: "Unfulfilled",
    [NeedStatus.RECURRING]: "Recurring",
  };
  
  // Helper function to render Group Project specific information
  const renderGroupProjectInfo = (need: Need) => {
    if (need.needType !== 'GROUP') return null;
    
    const pledgesForNeed = needsWithPledges[need.id] || [];
    const volunteerCount = need.volunteersCount || 0;
    const volunteerNeeded = need.volunteersNeeded;
    
    return (
      <div className="mt-2 py-2 px-3 bg-blue-50 rounded-md border border-blue-100">
        <div className="flex items-center mb-1 text-xs font-medium text-blue-800">
          <UserCheck className="h-3.5 w-3.5 mr-1" />
          Group Service Project
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <div>
            {volunteerNeeded ? (
              <span className="font-medium">{volunteerCount}/{volunteerNeeded} volunteers</span>
            ) : (
              <span className="font-medium">{volunteerCount} volunteers (unlimited)</span>
            )}
          </div>
          
          {pledgesForNeed.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 ml-2 text-xs bg-white border border-blue-200 text-blue-700 hover:bg-blue-50"
              onClick={() => {
                setSelectedNeed(need);
                setpledgeDetailsOpen(true);
              }}
            >
              <UserCheck className="h-3 w-3 mr-1" /> View Volunteers
            </Button>
          )}
        </div>
      </div>
    );
  };

  const eventRoleSummary = (() => {
    if (selectedNeed?.needType !== NeedType.EVENT || eventRolesWithStats.length === 0) {
      return [] as Array<{ label: string; filledCount: number; remainingCount: number | null }>;
    }
    return eventRolesWithStats.map((role) => ({
      label: formatRoleSlot(role),
      filledCount: role.filledCount,
      remainingCount: role.remainingCount,
    }));
  })();

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Need</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Needed By</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!needs || needs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                  No needs found. Create one above to get started.
                </TableCell>
              </TableRow>
            ) : (
              needs.map((need) => (
                <TableRow key={need.id} className="relative">
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        {need.title}
                        {/* Show badge for any need that has pledges, even if status isn't PLEDGED yet */}
                        {needsWithPledges[need.id] && (
                          <>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div 
                                    className="cursor-pointer"
                                    onClick={() => {
                                      setSelectedNeed(need);
                                      setpledgeDetailsOpen(true);
                                    }}
                                  >
                                    <Badge className="bg-[#197991] hover:bg-blue-600 transition-colors text-white ml-2 px-3 py-1 text-sm">
                                      <UserCheck className="h-4 w-4 mr-1" />
                                      View {needsWithPledges[need.id].length} Pledges
                                    </Badge>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Click to view contact information for pledges</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            
                            {/* Quick action button for pledge contact info */}
                            <div className="absolute right-16 top-1/2 -translate-y-1/2">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="rounded-full w-9 h-9 p-0 border-[#197991] bg-blue-50 hover:bg-blue-100"
                                      onClick={() => {
                                        setSelectedNeed(need);
                                        setpledgeDetailsOpen(true);
                                      }}
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#197991]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                      </svg>
                                      <span className="sr-only">View contact info for {needsWithPledges[need.id].length} pledges</span>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="left">
                                    <div className="text-sm font-medium">
                                      View contact info for {needsWithPledges[need.id].length} pledges
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </>
                        )}
                      </div>
                      
                      {/* Render group project info if this is a GROUP type need */}
                      {renderGroupProjectInfo(need)}
                    </div>
                  </TableCell>
                  <TableCell>{need.category}</TableCell>
                  <TableCell>{formatDate(need.neededBy)}</TableCell>
                  <TableCell>
                    {need.status !== NeedStatus.DRAFT ? (
                      <Badge 
                        className={`${statusStyles[need.status as NeedStatus]} cursor-pointer hover:opacity-80 transition-opacity`}
                        onClick={() => {
                          let nextStatus: NeedStatus;
                          switch (need.status) {
                            case NeedStatus.FLOATING:
                              nextStatus = NeedStatus.PLEDGED;
                              break;
                            case NeedStatus.PLEDGED:
                              nextStatus = NeedStatus.FULFILLED;
                              break;
                            case NeedStatus.FULFILLED:
                              nextStatus = NeedStatus.FLOATING;
                              break;
                            case NeedStatus.UNFULFILLED:
                              nextStatus = NeedStatus.FLOATING;
                              break;
                            case NeedStatus.RECURRING:
                              nextStatus = NeedStatus.FULFILLED;
                              break;
                            default:
                              nextStatus = NeedStatus.FLOATING;
                          }
                          updateStatusMutation.mutate({ id: need.id, status: nextStatus });
                        }}
                        title={`Click to change status (current: ${statusLabels[need.status as NeedStatus]})`}
                      >
                        {statusLabels[need.status as NeedStatus]}
                      </Badge>
                    ) : (
                      <Badge className={statusStyles[need.status as NeedStatus]}>
                        {statusLabels[need.status as NeedStatus]}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/admin/needs/${need.id}/edit`)}
                        title={need.status === NeedStatus.DRAFT ? "Continue editing" : "Edit need"}
                        aria-label={`${need.status === NeedStatus.DRAFT ? "Continue editing" : "Edit need"}: ${need.title}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {need.status === NeedStatus.DRAFT ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => updateStatusMutation.mutate({ id: need.id, status: NeedStatus.FLOATING })}
                          title="Publish need"
                          aria-label={`Publish need: ${need.title}`}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      ) : need.status !== NeedStatus.FULFILLED ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMarkFulfilled(need)}
                          title={getCloseActionLabel(need)}
                          aria-label={`${getCloseActionLabel(need)}: ${need.title}`}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => duplicateToDraftMutation.mutate(need)}
                        disabled={duplicateToDraftMutation.isPending}
                        title="Duplicate to draft"
                        aria-label={`Duplicate to draft: ${need.title}`}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      {need.status === NeedStatus.DRAFT ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedNeed(need);
                            setDeleteDialogOpen(true);
                          }}
                          title="Delete draft"
                          aria-label={`Delete draft: ${need.title}`}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      ) : null}
                      {need.status !== NeedStatus.DRAFT ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewLiveNeed(need)}
                          title="View live need"
                          aria-label={`View live need: ${need.title}`}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      ) : null}
                      {need.status !== NeedStatus.DRAFT ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => openPledgeEmailDraft(need)}
                          disabled={emailingNeedId === need.id}
                          title="Email everyone signed up"
                          aria-label={`Email everyone signed up for: ${need.title}`}
                        >
                          {emailingNeedId === need.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Mail className="h-4 w-4" />
                          )}
                        </Button>
                      ) : null}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="dropdown-menu-content">
                        {need.status !== NeedStatus.DRAFT ? (
                          <>
                            <DropdownMenuItem onClick={() => handleViewLiveNeed(need)}>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              <span>View Live Need</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        ) : null}
                        {/* Highlight option */}
                        <DropdownMenuItem 
                          onClick={() => toggleHighlightMutation.mutate(need.id)}
                          className="onboarding-admin-highlight">
                          <Star className={`mr-2 h-4 w-4 ${need.isHighlighted ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                          <span>{need.isHighlighted ? 'Remove Highlight' : 'Highlight Need'}</span>
                        </DropdownMenuItem>
                        
                        <DropdownMenuSeparator />
                        
                        {/* Edit option for all needs */}
                        <DropdownMenuItem 
                          onClick={() => {
                            navigate(`/admin/needs/${need.id}/edit`);
                          }}>
                          <Edit className="mr-2 h-4 w-4" />
                          <span>Edit Details</span>
                        </DropdownMenuItem>
                        
                        {/* Recipient info option */}
                        <DropdownMenuItem 
                          onClick={() => {
                            setSelectedNeed(need);
                            setRecipientInfoOpen(true);
                          }}>
                          <User className="mr-2 h-4 w-4" />
                          <span>Recipient Info</span>
                        </DropdownMenuItem>
                        
                        {/* Status management options */}
                        {need.status === NeedStatus.DRAFT && (
                          <DropdownMenuItem 
                            onClick={() => updateStatusMutation.mutate({ id: need.id, status: NeedStatus.FLOATING })}>
                            <Send className="mr-2 h-4 w-4" />
                            <span>Publish as Open</span>
                          </DropdownMenuItem>
                        )}
                        
                        {/* View pledge details if exists for any status - with special styling */}
                        {needsWithPledges[need.id] && (
                          <>
                            <DropdownMenuSeparator />
                            <div className="px-2 py-1.5 text-xs font-semibold text-[#197991]">
                              {needsWithPledges[need.id].length} Active Pledges
                            </div>
                            <DropdownMenuItem 
                              onClick={() => {
                                setSelectedNeed(need);
                                setpledgeDetailsOpen(true);
                              }}
                              className="bg-blue-50 hover:bg-blue-100 text-[#197991] font-medium"
                            >
                              <UserCheck className="mr-2 h-4 w-4" />
                              <span>View Contact Information</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openPledgeEmailDraft(need)}>
                              <Mail className="mr-2 h-4 w-4" />
                              <span>Email Everyone Signed Up</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        
                        {/* Status change options based on current status */}
                        {need.status === NeedStatus.FLOATING && (
                          <>
                            <DropdownMenuItem onClick={() => handleMarkFulfilled(need)}>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              <span>{getCloseActionLabel(need)}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => updateStatusMutation.mutate({ id: need.id, status: NeedStatus.UNFULFILLED })}>
                              <AlertCircle className="mr-2 h-4 w-4" />
                              <span>Mark Unfulfilled</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => updateStatusMutation.mutate({ id: need.id, status: NeedStatus.DRAFT })}>
                              <FileEdit className="mr-2 h-4 w-4" />
                              <span>Change to Draft</span>
                            </DropdownMenuItem>
                          </>
                        )}
                        
                        {need.status === NeedStatus.PLEDGED && (
                          <>
                            <DropdownMenuItem onClick={() => handleMarkFulfilled(need)}>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              <span>{getCloseActionLabel(need)}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => updateStatusMutation.mutate({ id: need.id, status: NeedStatus.UNFULFILLED })}>
                              <AlertCircle className="mr-2 h-4 w-4" />
                              <span>Mark Unfulfilled</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => updateStatusMutation.mutate({ id: need.id, status: NeedStatus.FLOATING })}>
                              <RefreshCw className="mr-2 h-4 w-4" />
                              <span>Change to Open</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => updateStatusMutation.mutate({ id: need.id, status: NeedStatus.DRAFT })}>
                              <FileEdit className="mr-2 h-4 w-4" />
                              <span>Change to Draft</span>
                            </DropdownMenuItem>
                          </>
                        )}
                        
                        {need.status === NeedStatus.FULFILLED && (
                          <>
                            <DropdownMenuItem 
                              onClick={() => updateStatusMutation.mutate({ id: need.id, status: NeedStatus.PLEDGED })}>
                              <UserCheck className="mr-2 h-4 w-4" />
                              <span>Change to Pledged</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => updateStatusMutation.mutate({ id: need.id, status: NeedStatus.FLOATING })}>
                              <RefreshCw className="mr-2 h-4 w-4" />
                              <span>Change to Open</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => updateStatusMutation.mutate({ id: need.id, status: NeedStatus.DRAFT })}>
                              <FileEdit className="mr-2 h-4 w-4" />
                              <span>Change to Draft</span>
                            </DropdownMenuItem>
                          </>
                        )}

                        {need.status === NeedStatus.UNFULFILLED && (
                          <>
                            <DropdownMenuItem onClick={() => handleMarkFulfilled(need)}>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              <span>{getCloseActionLabel(need)}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => updateStatusMutation.mutate({ id: need.id, status: NeedStatus.PLEDGED })}>
                              <UserCheck className="mr-2 h-4 w-4" />
                              <span>Change to Pledged</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => updateStatusMutation.mutate({ id: need.id, status: NeedStatus.FLOATING })}>
                              <RefreshCw className="mr-2 h-4 w-4" />
                              <span>Reopen Need</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => updateStatusMutation.mutate({ id: need.id, status: NeedStatus.DRAFT })}>
                              <FileEdit className="mr-2 h-4 w-4" />
                              <span>Change to Draft</span>
                            </DropdownMenuItem>
                          </>
                        )}
                        
                        {need.status === NeedStatus.RECURRING && (
                          <>
                            <DropdownMenuItem 
                              onClick={() => handleMarkFulfilled(need)}>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              <span>{getCloseActionLabel(need)}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => updateStatusMutation.mutate({ id: need.id, status: NeedStatus.FLOATING })}>
                              <RefreshCw className="mr-2 h-4 w-4" />
                              <span>Change to Regular Need</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => updateStatusMutation.mutate({ id: need.id, status: NeedStatus.DRAFT })}>
                              <FileEdit className="mr-2 h-4 w-4" />
                              <span>Change to Draft</span>
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuItem 
                          onClick={() => duplicateToDraftMutation.mutate(need)}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          <span>Duplicate to Draft</span>
                        </DropdownMenuItem>
                        
                        <DropdownMenuItem 
                          onClick={() => {
                            setSelectedNeed(need);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash className="mr-2 h-4 w-4" />
                          <span>Delete</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedNeed?.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-end">
            <Button 
              variant="outline" 
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={deleteNeedMutation.isPending}
            >
              {deleteNeedMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pledge Details Dialog */}
      <Dialog open={pledgeDetailsOpen} onOpenChange={setpledgeDetailsOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-xl text-[#197991] flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {selectedNeed?.needType === 'GROUP'
                ? 'Volunteer Information'
                : selectedNeed?.needType === 'EVENT'
                  ? 'Event Sign-Ups'
                  : 'Pledge Details'}
              <Button
                variant="ghost"
                size="sm"
                className="ml-2"
                onClick={() => {
                  refetchPledges();
                  queryClient.invalidateQueries({ queryKey: ['/api/all-pledges'] });
                  toast({
                    title: "Refreshed",
                    description: "Pledge information updated.",
                  });
                }}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                <span>Refresh</span>
              </Button>
            </DialogTitle>
            <DialogDescription>
              {selectedNeed?.needType === 'GROUP' ? (
                <div>
                  <span>Volunteer information for </span>
                  <span className="font-medium">"{selectedNeed?.title}"</span>
                  <div className="mt-1 text-sm font-medium text-blue-600">
                    {selectedNeed?.volunteersNeeded ? (
                      <span>{selectedNeed?.volunteersCount || 0}/{selectedNeed?.volunteersNeeded} volunteer slots filled</span>
                    ) : (
                      <span>{selectedNeed?.volunteersCount || 0} volunteers signed up (unlimited slots)</span>
                    )}
                  </div>
                </div>
              ) : selectedNeed?.needType === 'EVENT' ? (
                <div>
                  <span>Event sign-ups for </span>
                  <span className="font-medium">"{selectedNeed?.title}"</span>
                  <div className="mt-1 text-sm font-medium text-blue-600">
                    {selectedNeed?.volunteersNeeded ? (
                      <span>{selectedNeed?.volunteersCount || 0}/{selectedNeed?.volunteersNeeded} participants signed up</span>
                    ) : (
                      <span>{selectedNeed?.volunteersCount || 0} participants signed up</span>
                    )}
                  </div>
                </div>
              ) : (
                <span>Showing pledge information for <span className="font-medium">"{selectedNeed?.title}"</span></span>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedNeed?.needType === NeedType.EVENT && eventRoleSummary.length > 0 && (
            <div className="rounded-md border bg-slate-50 p-3 space-y-1.5">
              <p className="text-sm font-semibold text-slate-700">Slot Totals</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                {eventRoleSummary.map((slot) => (
                  <div key={slot.label} className="text-xs text-slate-600">
                    <span className="font-medium">{slot.filledCount}</span> signed up - {slot.label}
                    {slot.remainingCount === null ? (
                      <span className="text-slate-500"> (unlimited)</span>
                    ) : (
                      <span className="text-slate-500"> ({slot.remainingCount} remaining)</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {isPledgesLoading ? (
            <div className="flex justify-center items-center py-6">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#C75439]"></div>
            </div>
          ) : !pledges || pledges.length === 0 ? (
            <div className="py-4">
              <p className="text-center text-gray-500">No pledge information found.</p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {pledges.map((pledge) => (
                <div key={pledge.id} className="p-4 border rounded-md bg-gray-50">
                  <div className="grid gap-4">
                    {/* Donor/Volunteer information section */}
                    <div className="border-b pb-3">
                      <h3 className="text-lg font-medium mb-2 text-[#C75439]">
                        {selectedNeed?.needType === 'GROUP'
                          ? 'Volunteer Information'
                          : selectedNeed?.needType === 'EVENT'
                            ? 'Participant Information'
                            : 'Donor Information'}
                      </h3>
                      <div className="grid md:grid-cols-2 gap-3">
                        <div className="bg-white p-3 rounded-md shadow-sm">
                          <p className="text-sm font-semibold text-gray-700 mb-1">Name</p>
                          <p className="text-base font-medium">
                            {pledge.firstName ? (pledge.firstName + ' ' + (pledge.lastName || '')) : 'Name not provided'}
                          </p>
                        </div>
                        <div className="bg-white p-3 rounded-md shadow-sm">
                          {selectedNeed?.needType === 'GROUP' || selectedNeed?.needType === 'EVENT' ? (
                            <>
                              <p className="text-sm font-semibold text-gray-700 mb-1">
                                {selectedNeed?.needType === 'EVENT' ? 'Sign-Up Status' : 'Volunteer Status'}
                              </p>
                              <p className="text-base font-medium text-green-600 flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Confirmed
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-sm font-semibold text-gray-700 mb-1">Support Type</p>
                              <p className="text-base capitalize font-medium">
                                {pledge.donationType || 'Not specified'}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Contact information section - highlighted and made more prominent */}
                    <div className="border-b pb-3 bg-blue-50 p-3 rounded-md border border-blue-300 shadow-sm">
                      <h3 className="text-lg font-bold mb-3 text-[#197991] flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        Contact Information
                      </h3>
                      <div className="bg-white p-4 rounded-md border border-blue-200 mb-2">
                        <div className="mb-3">
                          <p className="text-sm font-semibold text-gray-700 mb-1">Email</p>
                          {pledge.email ? (
                            <a 
                              href={`mailto:${pledge.email}`} 
                              className="text-base font-bold text-[#197991] hover:underline flex items-center"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              {pledge.email}
                            </a>
                          ) : (
                            <p className="text-sm text-gray-500 italic">No email provided</p>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-700 mb-1">Phone</p>
                          {pledge.phone ? (
                            <a 
                              href={`tel:${pledge.phone}`} 
                              className="text-base font-bold text-[#197991] hover:underline flex items-center"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                              {pledge.phone}
                            </a>
                          ) : (
                            <p className="text-sm text-gray-500 italic">No phone number provided</p>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Click on the email or phone number to contact the{" "}
                        {selectedNeed?.needType === 'GROUP'
                          ? 'volunteer'
                          : selectedNeed?.needType === 'EVENT'
                            ? 'participant'
                            : 'donor'}{" "}
                        directly.
                      </p>
                    </div>

                    {selectedNeed?.needType === 'EVENT' && (
                      <div className="border-b pb-3">
                        <h3 className="text-lg font-medium mb-2 text-gray-700">Selected Slots</h3>
                        {pledge.selectedEventRoles && pledge.selectedEventRoles.length > 0 ? (
                          <div className="bg-white p-3 rounded-md border space-y-1.5">
                            {pledge.selectedEventRoles.map((role) => (
                              <p key={`${pledge.id}-${role.id}`} className="text-sm text-gray-700">
                                {formatRoleSlot(role)}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <div className="bg-white p-3 rounded-md border">
                            <p className="text-sm text-gray-500 italic">General sign-up (no slot selected)</p>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Notes section if available */}
                    {pledge.notes && (
                      <div className="border-b pb-3">
                        <h3 className="text-lg font-medium mb-2 text-gray-700">Notes</h3>
                        <div className="bg-white p-3 rounded-md border">
                          <p>{pledge.notes}</p>
                        </div>
                      </div>
                    )}
                    
                    {/* Date information */}
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-1">
                        {selectedNeed?.needType === 'GROUP' || selectedNeed?.needType === 'EVENT'
                          ? 'Signup Date'
                          : 'Pledged On'}
                      </p>
                      <p>{formatDate(pledge.createdAt)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <DialogFooter className="sm:justify-between">
            <div>
              {pledges && pledges.length > 0 && (
                <div className="text-sm text-gray-500 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {selectedNeed?.needType === 'GROUP'
                    ? `Click email or phone to contact volunteers directly`
                    : selectedNeed?.needType === 'EVENT'
                      ? `Click email or phone to contact participants directly`
                      : `Click email or phone number to contact donors directly`}
                </div>
              )}
            </div>
            <div className="flex gap-3">
              {selectedNeed && pledges && pledges.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => openPledgeEmailDraft(selectedNeed, pledges)}
                  disabled={emailingNeedId === selectedNeed.id}
                >
                  {emailingNeedId === selectedNeed.id ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="mr-2 h-4 w-4" />
                  )}
                  Email Everyone
                </Button>
              )}
              <Button 
                variant="outline"
                onClick={() => setpledgeDetailsOpen(false)}
              >
                Close
              </Button>
              {selectedNeed && (
                selectedNeed.needType === NeedType.EVENT
                  ? selectedNeed.status !== NeedStatus.FULFILLED
                  : selectedNeed.status === NeedStatus.PLEDGED
              ) && (
                <Button 
                  onClick={() => {
                    updateStatusMutation.mutate({ id: selectedNeed.id, status: NeedStatus.FULFILLED });
                    setpledgeDetailsOpen(false);
                  }}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {getCloseActionLabel(selectedNeed)}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recipient Info Dialog */}
      <Dialog open={recipientInfoOpen} onOpenChange={setRecipientInfoOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-xl text-[#197991] flex items-center">
              <Lock className="h-6 w-6 mr-2 text-[#197991]" />
              Recipient Information
            </DialogTitle>
            <DialogDescription>
              Private information about who this need is for. This is only visible to administrators.
            </DialogDescription>
          </DialogHeader>
          
          {selectedNeed ? (
            <div className="py-4">
              <div className="space-y-6">
                {/* Recipient basic info */}
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h3 className="text-lg font-medium mb-4 text-[#C75439]">
                    Recipient Details
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-md shadow-sm">
                      <p className="text-sm font-semibold text-gray-700 mb-1">Name</p>
                      {selectedNeed.recipientName ? (
                        <p className="text-base font-medium">{selectedNeed.recipientName}</p>
                      ) : (
                        <p className="text-sm text-gray-500 italic">No name provided</p>
                      )}
                    </div>
                    
                    <div className="bg-white p-4 rounded-md shadow-sm">
                      <p className="text-sm font-semibold text-gray-700 mb-1">Phone</p>
                      {selectedNeed.recipientPhone ? (
                        <a 
                          href={`tel:${selectedNeed.recipientPhone}`} 
                          className="text-base font-bold text-[#197991] hover:underline flex items-center"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          {selectedNeed.recipientPhone}
                        </a>
                      ) : (
                        <p className="text-sm text-gray-500 italic">No phone number provided</p>
                      )}
                    </div>
                    
                    <div className="bg-white p-4 rounded-md shadow-sm">
                      <p className="text-sm font-semibold text-gray-700 mb-1">Email</p>
                      {selectedNeed.recipientEmail ? (
                        <a 
                          href={`mailto:${selectedNeed.recipientEmail}`} 
                          className="text-base font-bold text-[#197991] hover:underline flex items-center"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          {selectedNeed.recipientEmail}
                        </a>
                      ) : (
                        <p className="text-sm text-gray-500 italic">No email provided</p>
                      )}
                    </div>
                    
                    <div className="bg-white p-4 rounded-md shadow-sm">
                      <p className="text-sm font-semibold text-gray-700 mb-1">Address</p>
                      {selectedNeed.recipientAddress ? (
                        <p className="text-base">
                          {selectedNeed.recipientAddress}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-500 italic">No address provided</p>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Notes section */}
                {selectedNeed.recipientNotes && (
                  <div className="border rounded-lg p-4">
                    <h3 className="text-lg font-medium mb-3 text-[#C75439]">Additional Notes</h3>
                    <div className="bg-white p-4 rounded-md border">
                      <p className="whitespace-pre-line">{selectedNeed.recipientNotes}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-4">
              <p className="text-center text-gray-500">No recipient information available.</p>
            </div>
          )}
          
          <DialogFooter className="sm:justify-start">
            <Button 
              onClick={() => {
                setRecipientInfoOpen(false);
                setSelectedNeed(null);
              }}
              className="bg-[#d14633] hover:bg-[#197991] text-white font-bold rounded-full"
            >
              Close
            </Button>
            {selectedNeed && (
              <Button 
                variant="outline" 
                onClick={() => {
                  const needId = selectedNeed.id;
                  setRecipientInfoOpen(false);
                  setSelectedNeed(null);
                  navigate(`/admin/needs/${needId}/edit`);
                }}
                className="ml-2"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Recipient Info
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default NeedsTable;
