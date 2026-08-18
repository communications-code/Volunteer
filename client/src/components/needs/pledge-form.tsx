import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Need, NeedType, insertPledgeSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDateInNewYork, formatTimeRangeForDisplay, isPastNewYorkDate } from "@/lib/utils";
import { DialogContent } from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ChevronRight, ChevronLeft, Check, Loader2, Mail, Minus, Plus } from "lucide-react";

interface PledgeFormProps {
  need: Need;
  onClose: () => void;
  variant?: "dialog" | "page";
}

type EventRoleOption = {
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

const pledgeFormSchema = insertPledgeSchema.extend({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email"),
  phone: z.string().optional(),
  organization: z.string().optional(),
  notes: z.string().optional(),
  donationType: z.enum(["items", "money", "signup"]),
  selectedEventRoleIds: z.array(z.number().int().positive()).optional(),
  selectedEventRoleQuantities: z.record(z.string(), z.number().int().positive()).optional(),
  isOngoingCommitment: z.boolean().optional(),
  subscribeToEmails: z.boolean().optional().default(true),
  paymentCompleted: z.boolean().optional(),
});

type PledgeFormValues = z.infer<typeof pledgeFormSchema>;

const appendNotes = (existingNotes: string | undefined, extra: string) => {
  const base = existingNotes?.trim();
  return base ? `${base}\n\n${extra}` : extra;
};

const STEPS = [
  { id: "contact", label: "Contact" },
  { id: "details", label: "Details" },
  { id: "review", label: "Review" },
] as const;

type StepId = typeof STEPS[number]["id"];

const PledgeForm = ({ need, onClose, variant = "dialog" }: PledgeFormProps) => {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<StepId>("contact");
  const isEventNeed = need.needType === NeedType.EVENT;

  const allowItemDonations = need.allowItemDonations ?? true;
  const allowMoneyDonations = false;
  const hasDonationOptions = isEventNeed ? true : allowItemDonations || allowMoneyDonations;
  const defaultDonationType: "items" | "money" | "signup" = isEventNeed
    ? "signup"
    : "items";

  const {
    data: rawEventRoles = [],
    isLoading: isEventRolesLoading,
  } = useQuery<EventRoleOption[]>({
    queryKey: ["/api/needs", need.id, "event-roles"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/needs/${need.id}/event-roles`);
      return await res.json();
    },
    enabled: isEventNeed,
    staleTime: 30_000,
  });
  const eventRoles = rawEventRoles.filter((role) => !isPastNewYorkDate(role.slotDate || need.eventDate));
  const hasConfiguredEventRoles = rawEventRoles.length > 0;

  const form = useForm<PledgeFormValues>({
    resolver: zodResolver(pledgeFormSchema),
    defaultValues: {
      needId: need.id,
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      organization: "",
      notes: "",
      donationType: defaultDonationType,
      selectedEventRoleIds: [],
      selectedEventRoleQuantities: {},
      isOngoingCommitment: need.needType === "ONGOING" ? false : undefined,
      subscribeToEmails: true,
      paymentCompleted: false,
    },
  });

  useEffect(() => {
    if (isEventNeed) {
      form.setValue("donationType", "signup");
      return;
    }
    form.setValue("donationType", "items");
  }, [allowItemDonations, allowMoneyDonations, isEventNeed, form]);

  const pledgeMutation = useMutation({
    mutationFn: async (values: PledgeFormValues) => {
      const res = await apiRequest("POST", "/api/pledges", values);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/needs"] });
      toast({
        title: "Pledge submitted successfully",
        description: "Thank you for your generous support!",
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error submitting pledge",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: PledgeFormValues) => {
    if (isEventNeed) {
      const selectedRoleIds = values.selectedEventRoleIds || [];
      if (hasConfiguredEventRoles && eventRoles.length === 0) {
        toast({
          title: "No current slots available",
          description: "All configured sign-up slots for this event have passed.",
          variant: "destructive",
        });
        return;
      }

      if (eventRoles.length > 0 && selectedRoleIds.length === 0) {
        toast({
          title: "Choose at least one slot",
          description: "Please select one or more event sign-up slots to continue.",
          variant: "destructive",
        });
        return;
      }

      const selectedRoleQuantities = selectedRoleIds.reduce<Record<string, number>>((acc, roleId) => {
        const rawQuantity = Number(values.selectedEventRoleQuantities?.[String(roleId)]);
        acc[String(roleId)] = Number.isInteger(rawQuantity) && rawQuantity > 0 ? rawQuantity : 1;
        return acc;
      }, {});

      pledgeMutation.mutate({
        ...values,
        donationType: "signup",
        selectedEventRoleIds: selectedRoleIds,
        selectedEventRoleQuantities: selectedRoleQuantities,
        paymentCompleted: false,
      });
      return;
    }

    if (!hasDonationOptions) {
      toast({
        title: "This need is not accepting pledges",
        description: "Please contact VFW Post 7570 for help with this request.",
        variant: "destructive",
      });
      return;
    }

    if (values.donationType !== "money") {
      pledgeMutation.mutate(values);
      return;
    }

    toast({
      title: "Financial contributions are not available here",
      description: "Please choose item support or contact VFW Post 7570 for other ways to help.",
      variant: "destructive",
    });
  };

  const onFormError = (errors: any) => {
    console.error("Pledge form validation errors:", errors);
    toast({
      title: "Please check the form",
      description: "Fill in all required fields before submitting.",
      variant: "destructive",
    });
  };

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);

  const goNext = async () => {
    let fieldsToValidate: (keyof PledgeFormValues)[] = [];
    if (currentStep === "contact") {
      fieldsToValidate = ["firstName", "lastName", "email"];
    }
    if (fieldsToValidate.length > 0) {
      const valid = await form.trigger(fieldsToValidate);
      if (!valid) return;
    }
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) setCurrentStep(STEPS[nextIndex].id);
  };

  const goPrev = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) setCurrentStep(STEPS[prevIndex].id);
  };

  // ── Step indicator (matches create-need form style) ──
  const renderStepIndicator = () => (
    <div className="mb-3 flex flex-wrap items-center justify-center gap-1">
      {STEPS.map((step, i) => {
        const isActive = step.id === currentStep;
        const isDone = i < currentStepIndex;
        return (
          <button
            key={step.id}
            type="button"
            onClick={() => { if (i <= currentStepIndex) setCurrentStep(step.id); }}
            className={`flex min-h-11 items-center gap-1 rounded-[14px] px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-slate-900 text-white"
                : isDone
                  ? "bg-[hsl(var(--primary))/0.1] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))/0.16] cursor-pointer"
                  : "bg-slate-100 text-slate-400"
            }`}
          >
            {isDone ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>}
            <span>{step.label}</span>
          </button>
        );
      })}
    </div>
  );

  // ── Step 1: Contact Info ──
  const renderStepContact = () => (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField control={form.control} name="firstName" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs">First Name *</FormLabel>
            <FormControl><Input placeholder="First name" className="text-sm" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="lastName" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs">Last Name *</FormLabel>
            <FormControl><Input placeholder="Last name" className="text-sm" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
      </div>

      <FormField control={form.control} name="email" render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs">Email *</FormLabel>
          <FormControl><Input type="email" placeholder="you@example.com" className="text-sm" {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />

      <FormField control={form.control} name="phone" render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs">Phone (optional)</FormLabel>
          <FormControl><Input placeholder="(555) 123-4567" className="text-sm" {...field} /></FormControl>
        </FormItem>
      )} />

      <FormField control={form.control} name="organization" render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs">Church / Organization (optional)</FormLabel>
          <FormControl>
            <Input placeholder="Your church or organization" className="text-sm" {...field} />
          </FormControl>
        </FormItem>
      )} />
    </div>
  );

  // ── Step 2: Details ──
  const renderStepDetails = () => {
    const selectedRoleQuantities = form.watch("selectedEventRoleQuantities") || {};

    return (
      <div className={isEventNeed ? "space-y-3 min-w-0" : "min-w-0 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-12"}>
        <div className={isEventNeed ? "space-y-3 min-w-0" : "space-y-3 xl:col-span-7"}>
          <FormField control={form.control} name="notes" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Notes (optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Any details about your pledge..." className="min-h-[88px] text-sm" {...field} />
              </FormControl>
              <p className="text-[11px] text-gray-400 mt-1">Let us know any special details about your pledge.</p>
            </FormItem>
          )} />

          {isEventNeed ? (
            <div className="space-y-2 rounded-md border p-3 bg-slate-50 min-w-0">
              <p className="text-xs font-medium text-slate-700">Choose your sign-up slot(s)</p>
              <p className="text-[11px] text-slate-500">
                Select one or more roles for this event. After checking a slot, set how many participants you are
                signing up. Full slots are marked and disabled.
              </p>

              {isEventRolesLoading ? (
                <p className="text-xs text-slate-500">Loading available slots...</p>
              ) : (
                <FormField
                  control={form.control}
                  name="selectedEventRoleIds"
                  render={({ field }) => {
                    const selected = field.value || [];
                    const toggleRoleSelection = (roleId: number, checked: boolean) => {
                      const next = new Set(selected);
                      const nextQuantities = {
                        ...(form.getValues("selectedEventRoleQuantities") || {}),
                      };

                      if (checked) {
                        next.add(roleId);
                        if (
                          !Number.isInteger(Number(nextQuantities[String(roleId)])) ||
                          Number(nextQuantities[String(roleId)]) <= 0
                        ) {
                          nextQuantities[String(roleId)] = 1;
                        }
                      } else {
                        next.delete(roleId);
                        delete nextQuantities[String(roleId)];
                      }

                      field.onChange(Array.from(next));
                      form.setValue("selectedEventRoleQuantities", nextQuantities, {
                        shouldDirty: true,
                        shouldTouch: true,
                      });
                    };

                    const updateRoleQuantity = (
                      roleId: number,
                      nextQuantity: number,
                      maxQuantity: number | null,
                    ) => {
                      const normalized = Math.max(1, Math.floor(nextQuantity));
                      const capped = maxQuantity === null ? normalized : Math.min(normalized, maxQuantity);
                      const nextQuantities = {
                        ...(form.getValues("selectedEventRoleQuantities") || {}),
                        [String(roleId)]: capped,
                      };
                      form.setValue("selectedEventRoleQuantities", nextQuantities, {
                        shouldDirty: true,
                        shouldTouch: true,
                      });
                    };

                    return (
                      <div className="space-y-1.5 min-w-0">
                        {eventRoles.length === 0 ? (
                          <div className="rounded-md border border-dashed bg-white p-2.5 text-xs text-slate-600">
                            {hasConfiguredEventRoles
                              ? "No current sign-up slots are available for this event."
                              : "No specific slots are required for this event. You can continue to review."}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-slate-300 bg-white overflow-hidden">
                            <div className="hidden md:block">
                              <div className="grid grid-cols-[130px_130px_minmax(0,1fr)] bg-slate-700 text-white">
                                <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide">Date</p>
                                <p className="border-l border-slate-500 px-3 py-2 text-xs font-semibold uppercase tracking-wide">Time</p>
                                <p className="border-l border-slate-500 px-3 py-2 text-xs font-semibold uppercase tracking-wide">Role</p>
                              </div>

                              <div className="divide-y divide-slate-200">
                                {eventRoles.map((role) => {
                                  const isSelected = selected.includes(role.id);
                                  const isDisabled = role.isFull && !isSelected;
                                  const resolvedSlotDate = role.slotDate || need.eventDate;
                                  const selectedQuantity = Math.max(1, Number(selectedRoleQuantities[String(role.id)] || 1));
                                  const maxQuantity =
                                    typeof role.remainingCount === "number"
                                      ? Math.max(role.remainingCount, 1)
                                      : null;
                                  const slotDateShort = resolvedSlotDate
                                    ? formatDateInNewYork(resolvedSlotDate, {
                                        month: "2-digit",
                                        day: "2-digit",
                                        year: "2-digit",
                                      })
                                    : "Date TBD";
                                  const slotDateDay = resolvedSlotDate
                                    ? formatDateInNewYork(resolvedSlotDate, { weekday: "long" })
                                    : "Day TBD";
                                  const filledBadgeText = role.capacity === null
                                    ? `${role.filledCount} filled (unlimited)`
                                    : `${role.filledCount} of ${role.capacity} filled`;

                                  return (
                                    <div
                                      key={`desktop-${role.id}`}
                                      className={`block transition-colors ${
                                        isSelected ? "bg-[#164C83]/10" : "bg-white hover:bg-slate-50"
                                      } ${isDisabled ? "opacity-70" : ""}`}
                                    >
                                      <div className="grid grid-cols-[130px_130px_minmax(0,1fr)]">
                                        <div className="px-3 py-2.5">
                                          <p className="text-sm font-semibold text-slate-900 leading-tight">{slotDateShort}</p>
                                          <p className="text-xs text-slate-500">{slotDateDay}</p>
                                        </div>

                                        <div className="border-l border-slate-200 px-3 py-2.5">
                                          <p className="text-sm font-semibold text-slate-900 leading-tight">
                                            {formatTimeRangeForDisplay(role.startTime, role.endTime)}
                                          </p>
                                        </div>

                                        <div className="border-l border-slate-200 px-3 py-2.5">
                                          <div className="min-w-0">
                                            <div
                                              role="button"
                                              tabIndex={isDisabled ? -1 : 0}
                                              aria-disabled={isDisabled}
                                              aria-pressed={isSelected}
                                              className={`flex items-start gap-2 rounded-md p-1 -m-1 ${
                                                isDisabled ? "cursor-not-allowed" : "cursor-pointer hover:bg-slate-100"
                                              }`}
                                              onClick={() => {
                                                if (!isDisabled) {
                                                  toggleRoleSelection(role.id, !isSelected);
                                                }
                                              }}
                                              onKeyDown={(event) => {
                                                if (isDisabled) return;
                                                if (event.key === "Enter" || event.key === " ") {
                                                  event.preventDefault();
                                                  toggleRoleSelection(role.id, !isSelected);
                                                }
                                              }}
                                            >
                                              <span
                                                onClick={(event) => event.stopPropagation()}
                                                onKeyDown={(event) => event.stopPropagation()}
                                              >
                                                <Checkbox
                                                  checked={isSelected}
                                                  disabled={isDisabled}
                                                  onCheckedChange={(checked) =>
                                                    toggleRoleSelection(role.id, checked === true)
                                                  }
                                                  className="mt-0.5"
                                                />
                                              </span>
                                              <div className="min-w-0">
                                                <p className="text-sm font-semibold text-slate-900 leading-tight">{role.name}</p>
                                                <span className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold text-white ${
                                                  role.isFull ? "bg-slate-600" : "bg-[#991A1E]"
                                                }`}>
                                                  {filledBadgeText}
                                                </span>
                                              </div>
                                            </div>

                                            {isSelected ? (
                                              <div
                                                className="mt-2 flex items-center gap-1.5"
                                                onClick={(event) => {
                                                  event.preventDefault();
                                                  event.stopPropagation();
                                                }}
                                              >
                                                <span className="text-xs font-medium text-slate-700">Participants</span>
                                                <Button
                                                  type="button"
                                                  variant="outline"
                                                  size="icon"
                                                  className="h-7 w-7"
                                                  onClick={(event) => {
                                                    event.preventDefault();
                                                    event.stopPropagation();
                                                    updateRoleQuantity(role.id, selectedQuantity - 1, maxQuantity);
                                                  }}
                                                  disabled={selectedQuantity <= 1}
                                                >
                                                  <Minus className="h-3.5 w-3.5" />
                                                </Button>
                                                <Input
                                                  type="number"
                                                  min={1}
                                                  max={maxQuantity ?? undefined}
                                                  step={1}
                                                  inputMode="numeric"
                                                  value={selectedQuantity}
                                                  onClick={(event) => event.stopPropagation()}
                                                  onChange={(event) => {
                                                    const parsed = Number(event.target.value);
                                                    if (Number.isFinite(parsed)) {
                                                      updateRoleQuantity(role.id, parsed, maxQuantity);
                                                    }
                                                  }}
                                                  className="h-7 w-16 px-1 text-center"
                                                />
                                                <Button
                                                  type="button"
                                                  variant="outline"
                                                  size="icon"
                                                  className="h-7 w-7"
                                                  onClick={(event) => {
                                                    event.preventDefault();
                                                    event.stopPropagation();
                                                    updateRoleQuantity(role.id, selectedQuantity + 1, maxQuantity);
                                                  }}
                                                  disabled={maxQuantity !== null && selectedQuantity >= maxQuantity}
                                                >
                                                  <Plus className="h-3.5 w-3.5" />
                                                </Button>
                                              </div>
                                            ) : null}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="divide-y divide-slate-200 md:hidden">
                              {eventRoles.map((role) => {
                                const isSelected = selected.includes(role.id);
                                const isDisabled = role.isFull && !isSelected;
                                const resolvedSlotDate = role.slotDate || need.eventDate;
                                const selectedQuantity = Math.max(1, Number(selectedRoleQuantities[String(role.id)] || 1));
                                const maxQuantity =
                                  typeof role.remainingCount === "number"
                                    ? Math.max(role.remainingCount, 1)
                                    : null;
                                const slotDateShort = resolvedSlotDate
                                  ? formatDateInNewYork(resolvedSlotDate, {
                                      month: "2-digit",
                                      day: "2-digit",
                                      year: "2-digit",
                                    })
                                  : "Date TBD";
                                const slotDateDay = resolvedSlotDate
                                  ? formatDateInNewYork(resolvedSlotDate, { weekday: "long" })
                                  : "Day TBD";
                                const filledBadgeText = role.capacity === null
                                  ? `${role.filledCount} filled (unlimited)`
                                  : `${role.filledCount} of ${role.capacity} filled`;

                                return (
                                  <div
                                    key={`mobile-${role.id}`}
                                    className={`block p-3 transition-colors ${
                                      isSelected ? "bg-[#164C83]/10" : "bg-white"
                                    } ${isDisabled ? "opacity-70" : ""}`}
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div
                                        role="button"
                                        tabIndex={isDisabled ? -1 : 0}
                                        aria-disabled={isDisabled}
                                        aria-pressed={isSelected}
                                        className={`flex items-start gap-2 rounded-md p-1 -m-1 ${
                                          isDisabled ? "cursor-not-allowed" : "cursor-pointer hover:bg-slate-100"
                                        }`}
                                        onClick={() => {
                                          if (!isDisabled) {
                                            toggleRoleSelection(role.id, !isSelected);
                                          }
                                        }}
                                        onKeyDown={(event) => {
                                          if (isDisabled) return;
                                          if (event.key === "Enter" || event.key === " ") {
                                            event.preventDefault();
                                            toggleRoleSelection(role.id, !isSelected);
                                          }
                                        }}
                                      >
                                        <span
                                          className="shrink-0"
                                          onClick={(event) => event.stopPropagation()}
                                          onKeyDown={(event) => event.stopPropagation()}
                                        >
                                          <Checkbox
                                            checked={isSelected}
                                            disabled={isDisabled}
                                            onCheckedChange={(checked) => toggleRoleSelection(role.id, checked === true)}
                                            className="mt-0.5"
                                          />
                                        </span>
                                        <div className="min-w-0">
                                          <div className="flex flex-wrap items-center gap-1.5">
                                            <p className="text-sm font-semibold text-slate-900">{role.name}</p>
                                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold text-white ${
                                              role.isFull ? "bg-slate-600" : "bg-[#991A1E]"
                                            }`}>
                                              {filledBadgeText}
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="mt-2 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-2.5">
                                        <div>
                                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Date</p>
                                          <p className="text-sm font-semibold text-slate-900 leading-tight">{slotDateShort}</p>
                                          <p className="text-xs text-slate-500">{slotDateDay}</p>
                                        </div>
                                        <div>
                                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Time</p>
                                          <p className="text-sm font-semibold text-slate-900 leading-tight">
                                            {formatTimeRangeForDisplay(role.startTime, role.endTime)}
                                          </p>
                                        </div>
                                      </div>

                                      {isSelected ? (
                                        <div
                                          className="mt-2.5 flex items-center gap-1.5"
                                          onClick={(event) => {
                                            event.preventDefault();
                                            event.stopPropagation();
                                          }}
                                        >
                                          <span className="text-xs font-medium text-slate-700">Participants</span>
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={(event) => {
                                              event.preventDefault();
                                              event.stopPropagation();
                                              updateRoleQuantity(role.id, selectedQuantity - 1, maxQuantity);
                                            }}
                                            disabled={selectedQuantity <= 1}
                                          >
                                            <Minus className="h-3.5 w-3.5" />
                                          </Button>
                                          <Input
                                            type="number"
                                            min={1}
                                            max={maxQuantity ?? undefined}
                                            step={1}
                                            inputMode="numeric"
                                            value={selectedQuantity}
                                            onClick={(event) => event.stopPropagation()}
                                            onChange={(event) => {
                                              const parsed = Number(event.target.value);
                                              if (Number.isFinite(parsed)) {
                                                updateRoleQuantity(role.id, parsed, maxQuantity);
                                              }
                                            }}
                                            className="h-7 w-16 px-1 text-center"
                                          />
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={(event) => {
                                              event.preventDefault();
                                              event.stopPropagation();
                                              updateRoleQuantity(role.id, selectedQuantity + 1, maxQuantity);
                                            }}
                                            disabled={maxQuantity !== null && selectedQuantity >= maxQuantity}
                                          >
                                            <Plus className="h-3.5 w-3.5" />
                                          </Button>
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
              )}
            </div>
          ) : (
            <>
              {hasDonationOptions && (
                <FormField control={form.control} name="donationType" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">How would you like to help?</FormLabel>
                    <FormControl>
                      <div className="rounded-md border p-2.5 bg-slate-50 text-xs text-slate-600">
                        This need accepts item support only.
                      </div>
                    </FormControl>
                  </FormItem>
                )} />
              )}
            </>
          )}
        </div>

        <div className={isEventNeed ? "space-y-3 min-w-0" : "space-y-3 xl:col-span-5"}>
          {need.needType === "ONGOING" && (
            <FormField control={form.control} name="isOngoingCommitment" render={({ field }) => (
              <label className="flex items-start gap-2 p-2 rounded-md bg-[#164C83]/5 border border-[#164C83]/20 cursor-pointer">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} className="mt-0.5" />
                </FormControl>
                <div>
                  <span className="text-xs font-medium">I commit to ongoing help</span>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    You're willing to help throughout the duration of this need.
                  </p>
                </div>
              </label>
            )} />
          )}

          <FormField control={form.control} name="subscribeToEmails" render={({ field }) => (
            <label className="flex items-start gap-2 p-2 rounded-md bg-gray-50 border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={field.onChange} className="mt-0.5" />
              </FormControl>
              <div>
                <span className="text-xs font-medium flex items-center gap-1">
                  <Mail className="h-3 w-3 text-gray-500" />
                  Sign me up for VFW Post 7570 email updates
                </span>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Receive occasional updates from VFW Post 7570, including Serving Network needs. Unsubscribe any time.
                </p>
              </div>
            </label>
          )} />
        </div>
      </div>
    );
  };

  // ── Step 3: Review ──
  const renderStepReview = () => {
    const values = form.getValues();
    const selectedRoleIds = new Set(values.selectedEventRoleIds || []);
    const selectedRoles = eventRoles.filter((role) => selectedRoleIds.has(role.id));

    return (
      <div className="space-y-3">
        {values.donationType === "signup" && (
          <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected slots</p>
            {selectedRoles.length > 0 ? (
              selectedRoles.map((role) => {
                const slotDateLabel = (role.slotDate || need.eventDate)
                  ? formatDateInNewYork(role.slotDate || need.eventDate, {
                      month: "2-digit",
                      day: "2-digit",
                      year: "2-digit",
                    })
                  : "Date TBD";
                const selectedQuantity = Math.max(
                  1,
                  Number(values.selectedEventRoleQuantities?.[String(role.id)] || 1),
                );
                return (
                  <p key={role.id} className="text-sm text-slate-700">
                    {role.name}
                    {selectedQuantity > 1 ? ` x${selectedQuantity}` : ""} (
                    {slotDateLabel} - {formatTimeRangeForDisplay(role.startTime, role.endTime)})
                  </p>
                );
              })
            ) : (
              <p className="text-sm text-slate-500">
                {eventRoles.length === 0
                  ? "General event sign-up (no specific slot selected)."
                  : "No slot selected."}
              </p>
            )}
          </div>
        )}

        {values.donationType === "items" && (
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-sm text-slate-700">You&apos;re ready to submit this item support pledge.</p>
          </div>
        )}

        {values.notes && (
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Notes</p>
            <p className="mt-0.5 text-sm text-slate-700 whitespace-pre-wrap">{values.notes}</p>
          </div>
        )}
      </div>
    );
  };

  const selectedDonationType = form.watch("donationType");
  const isPageVariant = variant === "page";
  const submitButtonLabel =
    selectedDonationType === "signup"
      ? "Submit Sign-Up"
      : "Submit Pledge";

  // ── Nav footer ──
  const renderNavFooter = () => (
    <div className="mt-3 flex flex-shrink-0 items-center justify-between gap-3 border-t bg-white pt-3">
      <div>
        {currentStepIndex > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={goPrev} className="gap-0.5 h-8 text-xs">
            <ChevronLeft className="h-3.5 w-3.5" /> Back
          </Button>
        )}
      </div>
      <div className="flex flex-shrink-0 gap-1.5">
        <Button type="button" variant="outline" size="sm" className="text-sm" onClick={onClose}>
          {isPageVariant ? "Back" : "Cancel"}
        </Button>

        {currentStep === "review" ? (
          <Button
            type="button"
            size="sm"
            className="gap-1 text-sm"
            disabled={pledgeMutation.isPending}
            onClick={() => form.handleSubmit(onSubmit, onFormError)()}
          >
            {pledgeMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {submitButtonLabel}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            className="gap-1 text-sm"
            onClick={goNext}
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );

  // ── Render main form flow ──
  const renderFormFlow = () => (
    <div className="flex h-full min-h-0 flex-col">
      <div className="pb-0 pr-8">
        <h2 className="text-base font-semibold text-[#231F20]">Pledge to Help</h2>
        <div className="text-xs text-gray-500">
          {need.title}
          {need.needType === "ONGOING" && need.startDate && need.endDate && (
            <span className="block mt-1 text-[#164C83]">
              Ongoing: {formatDateInNewYork(need.startDate) || need.startDate} – {formatDateInNewYork(need.endDate) || need.endDate}
            </span>
          )}
        </div>
      </div>

      <Form {...form}>
        <form
          onSubmit={(e) => { e.preventDefault(); }}
          className="clh-mobile-form-safe mt-3 flex min-h-0 flex-1 flex-col"
        >
          {renderStepIndicator()}
          <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden pr-1 pb-1">
            {currentStep === "contact" && renderStepContact()}
            {currentStep === "details" && renderStepDetails()}
            {currentStep === "review" && renderStepReview()}
          </div>
          {renderNavFooter()}
        </form>
      </Form>
    </div>
  );

  const dialogClasses = isEventNeed
    ? "w-[96vw] max-w-6xl max-h-[calc(100dvh-2rem)] top-[1rem] translate-y-0 p-3 sm:p-5 overflow-y-auto"
    : "w-[95vw] max-w-5xl max-h-[calc(100dvh-2rem)] top-[1rem] translate-y-0 p-4 sm:p-5 overflow-hidden";
  const pageClasses = isEventNeed
    ? "w-full max-w-6xl rounded-[1.5rem] border border-white/70 bg-white p-3 sm:p-5 shadow-[0_14px_30px_rgba(15,23,42,0.05)]"
    : "w-full max-w-5xl rounded-[1.5rem] border border-white/70 bg-white p-4 sm:p-5 shadow-[0_14px_30px_rgba(15,23,42,0.05)]";

  if (isPageVariant) {
    return (
      <div className={pageClasses}>
        {renderFormFlow()}
      </div>
    );
  }

  return (
    <DialogContent className={dialogClasses}>
      {renderFormFlow()}
    </DialogContent>
  );
};

export default PledgeForm;
