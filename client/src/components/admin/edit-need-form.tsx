import { useEffect, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Need, NeedStatus, NeedType, insertNeedSchema } from "@shared/schema";
import { useCategories } from "@/hooks/use-categories";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDateForInput, formatTimeRangeForDisplay } from "@/lib/utils";
import { ImageUpload } from "./image-upload-fixed";
import EventRolesEditor, { type EventRoleFormValue } from "./event-roles-editor";
import { DatePicker } from "@/components/ui/date-picker";
import ReactQuill from "react-quill";
import { Lock as LockIcon, Loader2, ChevronRight, ChevronLeft, Check } from "lucide-react";

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const eventRoleFormSchema = z.object({
  id: z.number().optional(),
  name: z.string().trim().min(1, "Role name is required"),
  slotDate: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z
      .union([z.string().trim().regex(datePattern, "Slot date must be YYYY-MM-DD"), z.undefined()])
      .optional(),
  ),
  startTime: z.string().trim().regex(timePattern, "Start time must be HH:mm"),
  endTime: z.string().trim().regex(timePattern, "End time must be HH:mm"),
  capacity: z
    .union([z.number().int().positive(), z.null(), z.undefined()])
    .optional()
    .transform((value) => (value === undefined ? 1 : value)),
  displayOrder: z.number().optional(),
  isActive: z.boolean().optional(),
}).refine((role) => role.startTime < role.endTime, {
  message: "End time must be later than start time",
  path: ["endTime"],
});

const formSchema = insertNeedSchema.extend({
  category: z.string().optional().default(""),
  categorySelections: z.array(z.string().trim().min(1)).min(1, "Select at least one category"),
  estimatedCost: z.union([z.string(), z.number(), z.undefined()]).optional(),
  neededBy: z.string().optional(),
  needType: z.enum([NeedType.ONETIME, NeedType.ONGOING, NeedType.GROUP, NeedType.EVENT]).default(NeedType.ONETIME),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  eventDate: z.string().optional(),
  eventTime: z.string().optional(),
  eventStartTime: z.string().optional(),
  eventEndTime: z.string().optional(),
  eventLocation: z.string().optional(),
  redirectUrl: z.string().optional(),
  volunteersNeeded: z.union([z.string(), z.number(), z.undefined()]).optional().transform((val) => {
    if (!val) return undefined;
    if (typeof val === "number") return val;
    const parsed = parseInt(val);
    return isNaN(parsed) ? undefined : parsed;
  }),
  recipientName: z.string().optional(),
  recipientPhone: z.string().optional(),
  recipientEmail: z.string().optional(),
  recipientAddress: z.string().optional(),
  recipientNotes: z.string().optional(),
  recipientDob: z.string().optional(),
  recipientIsWidow: z.boolean().optional(),
  recipientIsSingleParent: z.boolean().optional(),
  recipientInsurance: z.string().optional(),
  recipientMedicaid: z.boolean().optional(),
  recipientMedicare: z.boolean().optional(),
  recipientSocialSecurity: z.boolean().optional(),
  recipientSnap: z.boolean().optional(),
  recipientDisability: z.boolean().optional(),
  allowItemDonations: z.boolean().optional(),
  allowMoneyDonations: z.boolean().optional(),
  eventRoles: z.array(eventRoleFormSchema).optional(),
}).refine(
  (data) =>
    data.needType === NeedType.EVENT ||
    Boolean(data.allowItemDonations ?? true) ||
    Boolean(data.allowMoneyDonations ?? true),
  {
    message: "At least one response option must be enabled.",
    path: ["allowItemDonations"],
  }
).refine(
  (data) => {
    if (data.needType !== NeedType.EVENT) return true;
    if (!data.eventStartTime || !data.eventEndTime) return true;
    const startDate = (data.eventDate || "").trim();
    const endDate = (data.endDate || "").trim();
    if (startDate && endDate && endDate > startDate) return true;
    return data.eventStartTime < data.eventEndTime;
  },
  {
    message: "Event end time must be after start time.",
    path: ["eventEndTime"],
  }
).refine(
  (data) => {
    if (data.needType !== NeedType.EVENT) return true;
    if (!data.endDate) return true;
    return Boolean((data.eventDate || "").trim());
  },
  {
    message: "Event start date is required when end date is provided.",
    path: ["eventDate"],
  }
).refine(
  (data) => {
    if (data.needType !== NeedType.EVENT) return true;
    const startDate = (data.eventDate || "").trim();
    const endDate = (data.endDate || "").trim();
    if (!startDate || !endDate) return true;
    return endDate >= startDate;
  },
  {
    message: "Event end date must be on or after start date.",
    path: ["endDate"],
  }
);

type FormValues = z.infer<typeof formSchema>;

interface EditNeedFormProps {
  need: Need;
  onClose: () => void;
  onPublishSuccess?: () => void;
  variant?: "dialog" | "page";
}

const STEPS = [
  { id: "basics", label: "Basics" },
  { id: "details", label: "Details" },
  { id: "eventRoles", label: "Role Slots" },
  { id: "response", label: "Response" },
  { id: "recipient", label: "Recipient" },
  { id: "review", label: "Review" },
] as const;

type StepId = typeof STEPS[number]["id"];

const getNeedType = (type: string | null): NeedType => {
  if (type === NeedType.ONGOING) return NeedType.ONGOING;
  if (type === NeedType.GROUP) return NeedType.GROUP;
  if (type === NeedType.EVENT) return NeedType.EVENT;
  return NeedType.ONETIME;
};

const getDonationsStatus = (status: string | null): NeedStatus => {
  return status === NeedStatus.RECURRING ? NeedStatus.RECURRING : NeedStatus.FLOATING;
};

const parseNeedCategorySelections = (raw: string | null | undefined, fallbackCategory: string | null | undefined): string[] => {
  const fallback = (fallbackCategory || "").trim();
  if (!raw) return fallback ? [fallback] : [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fallback ? [fallback] : [];
    const normalized = parsed
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    if (normalized.length === 0 && fallback) return [fallback];
    return Array.from(new Set(normalized));
  } catch {
    return fallback ? [fallback] : [];
  }
};

const getDefaultValues = (need: Need): FormValues => ({
  categorySelections: parseNeedCategorySelections(need.categorySelections, need.category),
  title: need.title || "",
  description: need.description || "",
  category: need.category || "",
  neededBy: formatDateForInput(need.neededBy) || "",
  estimatedCost: need.estimatedCost ? need.estimatedCost / 100 : undefined,
  needType: getNeedType(need.needType),
  startDate: formatDateForInput(need.startDate) || "",
  endDate: formatDateForInput(need.endDate) || "",
  eventDate: formatDateForInput(need.eventDate) || "",
  eventTime: need.eventTime || "",
  eventStartTime: need.eventStartTime || "",
  eventEndTime: need.eventEndTime || "",
  eventLocation: need.eventLocation || "",
  imageUrl: need.imageUrl || "",
  redirectUrl: need.redirectUrl || "",
  status: getDonationsStatus(need.status),
  volunteersNeeded: need.volunteersNeeded || undefined,
  recipientName: need.recipientName || "",
  recipientPhone: need.recipientPhone || "",
  recipientEmail: need.recipientEmail || "",
  recipientAddress: need.recipientAddress || "",
  recipientNotes: need.recipientNotes || "",
  recipientDob: formatDateForInput(need.recipientDob) || "",
  recipientIsWidow: need.recipientIsWidow || false,
  recipientIsSingleParent: need.recipientIsSingleParent || false,
  recipientInsurance: need.recipientInsurance || "",
  recipientMedicaid: need.recipientMedicaid || false,
  recipientMedicare: need.recipientMedicare || false,
  recipientSocialSecurity: need.recipientSocialSecurity || false,
  recipientSnap: need.recipientSnap || false,
  recipientDisability: need.recipientDisability || false,
  allowItemDonations: need.allowItemDonations ?? true,
  allowMoneyDonations: false,
  eventRoles: [],
});

const EditNeedForm = ({ need, onClose, onPublishSuccess, variant = "dialog" }: EditNeedFormProps) => {
  const [currentStep, setCurrentStep] = useState<StepId>("basics");
  const { toast } = useToast();
  const { data: dbCategories } = useCategories();

  const categoryOptions = (dbCategories || []).map((c) => ({ value: c.slug, label: c.name }));

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: getDefaultValues(need),
  });

  const shouldLoadEventRoles = need.needType === NeedType.EVENT;

  const { data: loadedEventRoles = [] } = useQuery<EventRoleFormValue[]>({
    queryKey: ["/api/needs", need.id, "event-roles", "edit"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/needs/${need.id}/event-roles`);
      const payload = await response.json();
      if (!Array.isArray(payload)) return [];
      return payload.map((role: any, index: number) => ({
        id: role.id,
        name: role.name || "",
        slotDate: role.slotDate || formatDateForInput(need.eventDate) || "",
        startTime: role.startTime || "",
        endTime: role.endTime || "",
        capacity: role.capacity ?? 1,
        displayOrder: role.displayOrder ?? index,
        isActive: role.isActive ?? true,
      }));
    },
    enabled: shouldLoadEventRoles,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    form.reset(getDefaultValues(need));
    setCurrentStep("basics");
  }, [need, form]);

  useEffect(() => {
    if (!shouldLoadEventRoles) return;
    form.setValue("eventRoles", loadedEventRoles);
  }, [form, loadedEventRoles, shouldLoadEventRoles]);

  const updateNeedMutation = useMutation({
    mutationFn: async ({ values, statusOverride }: { values: FormValues; statusOverride?: NeedStatus }) => {
      const costStr = values.estimatedCost != null ? String(values.estimatedCost).trim() : "";
      const costNum = costStr ? parseFloat(costStr) : NaN;
      const normalizedCategorySelections = Array.from(
        new Set(
          (values.categorySelections || [])
            .map((value) => value.trim())
            .filter((value) => value.length > 0),
        ),
      );
      const primaryCategory = normalizedCategorySelections[0] || values.category?.trim() || "";
      const eventRoles: EventRoleFormValue[] = (values.eventRoles || [])
        .map((role, index) => ({
          id: role.id,
          name: role.name?.trim() || "",
          slotDate: role.slotDate?.trim() || undefined,
          startTime: role.startTime || "",
          endTime: role.endTime || "",
          capacity: role.capacity ?? 1,
          displayOrder: index,
          isActive: role.isActive ?? true,
        }))
        .filter((role) => role.name && role.startTime && role.endTime);
      const isEventPayload = values.needType === NeedType.EVENT;
      const processedValues = {
        ...values,
        category: primaryCategory,
        categorySelections: JSON.stringify(normalizedCategorySelections),
        needType: isEventPayload ? NeedType.EVENT : values.needType,
        estimatedCost: !isNaN(costNum) ? Math.round(costNum * 100) : null,
        allowItemDonations: isEventPayload ? false : values.allowItemDonations,
        allowMoneyDonations: false,
        eventRoles: isEventPayload ? eventRoles : undefined,
      };
      const payload = statusOverride ? { ...processedValues, status: statusOverride } : processedValues;
      const res = await apiRequest("PUT", `/api/needs/${need.id}`, payload);
      return await res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/needs"] });

      const isPublishingDraft =
        need.status === NeedStatus.DRAFT &&
        variables.statusOverride &&
        variables.statusOverride !== NeedStatus.DRAFT;

      if (isPublishingDraft) {
        toast({ title: "Need published successfully" });
      } else if (variables.statusOverride === NeedStatus.DRAFT) {
        toast({ title: "Need saved as draft successfully" });
      } else {
        toast({ title: "Need updated successfully" });
      }

      if (isPublishingDraft) {
        onPublishSuccess?.();
        if (!onPublishSuccess) {
          onClose();
        }
        return;
      }

      onClose();
    },
    onError: (error) => {
      const inIframe = typeof window !== "undefined" && window.self !== window.top;
      const isAuthFailure = error.message.startsWith("401") || error.message.startsWith("403");
      toast({
        title: isAuthFailure ? "Session required" : "Error updating need",
        description:
          isAuthFailure && inIframe
            ? "Your browser blocked the embedded session. Re-open this app directly or allow third-party cookies, then try again."
            : error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: FormValues) => {
    const statusOverride =
      need.status === NeedStatus.DRAFT ||
      need.status === NeedStatus.PLEDGED ||
      need.status === NeedStatus.FULFILLED ||
      need.status === NeedStatus.UNFULFILLED
        ? (need.status as NeedStatus)
        : undefined;
    updateNeedMutation.mutate({
      values,
      statusOverride,
    });
  };

  const onFormError = () => {
    toast({
      title: "Validation error",
      description: "Please check the form for errors and fill in all required fields.",
      variant: "destructive",
    });
  };

  const onSaveAsDraft = async () => {
    const isValid = await form.trigger(["title", "categorySelections", "description"]);
    if (!isValid) {
      toast({
        title: "Missing required fields",
        description: "Please fill in the Title, Categories, and Description.",
        variant: "destructive",
      });
      return;
    }

    const values = form.getValues();
    updateNeedMutation.mutate({ values, statusOverride: NeedStatus.DRAFT });
  };

  const handlePublish = async () => {
    if (need.status !== NeedStatus.DRAFT) return;

    const isValid = await form.trigger(["title", "categorySelections", "description"]);
    if (!isValid) {
      toast({
        title: "Missing required fields",
        description: "Please fill in the Title, Categories, and Description.",
        variant: "destructive",
      });
      return;
    }

    const values = form.getValues();
    const publishStatus = values.status === NeedStatus.RECURRING ? NeedStatus.RECURRING : NeedStatus.FLOATING;
    updateNeedMutation.mutate({ values, statusOverride: publishStatus });
  };

  const needType = form.watch("needType");
  const isEvent = needType === NeedType.EVENT;
  const isGroup = needType === NeedType.GROUP;
  const isOngoing = needType === NeedType.ONGOING;

  const steps = STEPS.filter((step) => {
    if (step.id === "eventRoles") return isEvent;
    if (step.id === "recipient") return !isEvent;
    return true;
  });
  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  useEffect(() => {
    if (isEvent) {
      form.setValue("allowItemDonations", false);
      form.setValue("allowMoneyDonations", false);
      form.setValue("status", NeedStatus.FLOATING);
      form.setValue("volunteersNeeded", undefined);
      if (currentStep === "recipient") {
        setCurrentStep("review");
      }
    } else {
      const allowItems = Boolean(form.getValues("allowItemDonations"));
      const allowMoney = Boolean(form.getValues("allowMoneyDonations"));
      if (!allowItems && !allowMoney) {
        form.setValue("allowItemDonations", true);
        form.setValue("allowMoneyDonations", false);
      }
      form.setValue("eventRoles", []);
      form.setValue("eventStartTime", "");
      form.setValue("eventEndTime", "");
      form.setValue("eventLocation", "");
      if (!isGroup) {
        form.setValue("eventDate", "");
        form.setValue("volunteersNeeded", undefined);
      }
      if (currentStep === "eventRoles") {
        setCurrentStep("response");
      }
    }
  }, [form, isEvent, isGroup, currentStep]);

  const goNext = async () => {
    let fieldsToValidate: (keyof FormValues)[] = [];
    if (currentStep === "basics") fieldsToValidate = ["title", "categorySelections", "description"];

    if (fieldsToValidate.length > 0) {
      const valid = await form.trigger(fieldsToValidate);
      if (!valid) return;
    }

    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) setCurrentStep(steps[nextIndex].id);
  };

  const goPrev = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) setCurrentStep(steps[prevIndex].id);
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-1 mb-3">
      {steps.map((step, i) => {
        const isActive = step.id === currentStep;
        const isDone = i < currentStepIndex;
        return (
          <button
            key={step.id}
            type="button"
            onClick={() => setCurrentStep(step.id)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
              isActive
                ? "bg-[#197991] text-white"
                : isDone
                  ? "bg-[#197991]/15 text-[#197991] hover:bg-[#197991]/25 cursor-pointer"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200 cursor-pointer"
            }`}
          >
            {isDone ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>}
            <span>{step.label}</span>
          </button>
        );
      })}
    </div>
  );

  const renderStepBasics = () => (
    <div className="space-y-3">
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs">Title *</FormLabel>
            <FormControl>
              <Input placeholder="Winter Coats for Families" className="h-8 text-sm" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name="categorySelections"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Categories *</FormLabel>
              <FormControl>
                <div className="rounded-md border border-slate-200 bg-white p-2 space-y-2">
                  {categoryOptions.length === 0 ? (
                    <p className="text-xs text-slate-500">No categories configured yet.</p>
                  ) : (
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {categoryOptions.map((category) => {
                        const selectedValues = field.value || [];
                        const checked = selectedValues.includes(category.value);
                        return (
                          <label key={category.value} className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-slate-50 cursor-pointer">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(nextChecked) => {
                                const next = new Set(selectedValues);
                                if (nextChecked) {
                                  next.add(category.value);
                                } else {
                                  next.delete(category.value);
                                }
                                field.onChange(Array.from(next));
                              }}
                            />
                            <span>{category.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {(field.value || []).length > 0 ? (
                    <p className="text-[11px] text-slate-500">
                      Selected: {(field.value || [])
                        .map((value) => categoryOptions.find((c) => c.value === value)?.label || value)
                        .join(", ")}
                    </p>
                  ) : null}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="neededBy"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Needed By</FormLabel>
              <FormControl>
                <DatePicker value={field.value} onChange={field.onChange} placeholder="Select date" />
              </FormControl>
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs">Description *</FormLabel>
            <FormControl>
              <ReactQuill
                theme="snow"
                placeholder="What is needed..."
                className="[&_.ql-container]:max-h-[100px] [&_.ql-container]:overflow-y-auto [&_.ql-editor]:min-h-[60px] [&_.ql-editor]:text-sm"
                modules={{
                  toolbar: [
                    ["bold", "italic", "underline"],
                    [{ list: "ordered" }, { list: "bullet" }],
                    ["link"],
                    ["clean"],
                  ],
                }}
                value={field.value}
                onChange={field.onChange}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );

  const renderStepDetails = () => (
    <div className="space-y-3">
      <FormField
        control={form.control}
        name="needType"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs">Type of help</FormLabel>
            <FormControl>
              <RadioGroup onValueChange={field.onChange} value={field.value} className="grid grid-cols-2 gap-1.5">
                {[
                  { value: NeedType.ONETIME, label: "One-Time" },
                  { value: NeedType.ONGOING, label: "Ongoing" },
                  { value: NeedType.GROUP, label: "Group Project" },
                  { value: NeedType.EVENT, label: "Event" },
                ].map((opt) => (
                  <FormItem key={opt.value} className="space-y-0">
                    <FormControl>
                      <label
                        className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 cursor-pointer text-sm transition-colors ${
                          field.value === opt.value
                            ? "border-[#197991] bg-[#197991]/5 font-medium"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <RadioGroupItem value={opt.value} className="h-3.5 w-3.5" />
                        {opt.label}
                      </label>
                    </FormControl>
                  </FormItem>
                ))}
              </RadioGroup>
            </FormControl>
          </FormItem>
        )}
      />

      {isEvent && (
        <div className="rounded-md border border-[#197991]/30 bg-[#197991]/5 px-3 py-2">
          <p className="text-xs font-semibold text-[#197991]">Response Type: Sign Up</p>
          <p className="text-[11px] text-slate-600">
            Event needs use role-slot sign-ups instead of item support.
          </p>
        </div>
      )}

      {isOngoing && (
        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Start Date</FormLabel>
                <FormControl>
                  <DatePicker value={field.value} onChange={field.onChange} placeholder="Start" />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">End Date</FormLabel>
                <FormControl>
                  <DatePicker value={field.value} onChange={field.onChange} placeholder="End" />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
      )}

      {isGroup && (
        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="eventDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Project Date</FormLabel>
                <FormControl>
                  <DatePicker value={field.value || ""} onChange={field.onChange} placeholder="Project date" />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="volunteersNeeded"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Volunteers</FormLabel>
                <FormControl>
                  <Input type="number" min="1" placeholder="optional" className="h-8 text-sm" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
      )}

      {isEvent && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="eventDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Event Start Date</FormLabel>
                  <FormControl>
                    <DatePicker value={field.value || ""} onChange={field.onChange} placeholder="Start date" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Event End Date</FormLabel>
                  <FormControl>
                    <DatePicker value={field.value || ""} onChange={field.onChange} placeholder="Optional (same day if blank)" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <FormField
              control={form.control}
              name="eventStartTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Event Start Time</FormLabel>
                  <FormControl>
                    <Input type="time" className="h-8 text-sm" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="eventEndTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Event End Time</FormLabel>
                  <FormControl>
                    <Input type="time" className="h-8 text-sm" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="eventLocation"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Location</FormLabel>
                <FormControl>
                  <Input placeholder="123 Main St" className="h-8 text-sm" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
      )}
    </div>
  );

  const renderStepEventRoles = () => (
    <div className="space-y-3">
      <div className="rounded-md border border-[#197991]/30 bg-[#197991]/5 px-3 py-2">
        <p className="text-xs font-semibold text-[#197991]">Event Role Slots</p>
        <p className="text-[11px] text-slate-600">
          Add volunteer roles with date and time windows (e.g. Setup 03/18 9:30-10:00).
        </p>
      </div>
      <EventRolesEditor form={form} compact defaultSlotDate={form.watch("eventDate") || ""} />
    </div>
  );

  const renderStepResponse = () => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name="estimatedCost"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Est. Cost</FormLabel>
              <FormControl>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
                    <span className="text-gray-500 text-sm">$</span>
                  </div>
                  <Input type="number" step="0.01" placeholder="0.00" className="pl-6 h-8 text-sm" {...field} />
                </div>
              </FormControl>
            </FormItem>
          )}
        />

        {isEvent ? (
          <div className="rounded-md border p-2.5 bg-slate-50">
            <p className="text-xs font-medium text-slate-700">Sign-up mode</p>
            <p className="text-[11px] text-slate-500">Event responses use role-slot registration.</p>
          </div>
        ) : (
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Responses</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NeedStatus.FLOATING}>Standard (one pledge)</SelectItem>
                    <SelectItem value={NeedStatus.RECURRING}>Multiple allowed</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        )}
      </div>

      <FormField
        control={form.control}
        name="imageUrl"
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <ImageUpload onImageUploaded={field.onChange} currentImageUrl={field.value} compact={isEvent} />
            </FormControl>
          </FormItem>
        )}
      />

      {isEvent ? (
        <div className="rounded-md border border-slate-200 p-2.5 bg-slate-50">
          <p className="text-xs font-medium text-slate-700">Response Mode</p>
          <p className="text-[11px] text-slate-500">
            Event needs are sign-up only. Public users pick slots and submit.
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-slate-200 p-3 space-y-2">
          <p className="text-xs font-semibold text-slate-700">Response Options</p>
          <p className="text-[11px] text-slate-500">Choose which options people can select when pledging.</p>
          <div className="flex flex-wrap gap-4 pt-1">
            <FormField
              control={form.control}
              name="allowItemDonations"
              render={({ field }) => (
                <FormItem className="flex items-center space-x-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={Boolean(field.value)}
                      onCheckedChange={(checked) => {
                        const next = Boolean(checked);
                        if (!next) return;
                        field.onChange(next);
                      }}
                    />
                  </FormControl>
                  <FormLabel className="text-xs font-normal">Allow item support</FormLabel>
                </FormItem>
              )}
            />
          </div>
          {form.formState.errors.allowItemDonations && (
            <p className="text-[11px] text-red-600">{form.formState.errors.allowItemDonations.message}</p>
          )}
        </div>
      )}
    </div>
  );

  const renderStepRecipient = () => (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <LockIcon className="h-3.5 w-3.5" />
        <span>Admin only - not shown publicly</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name="recipientName"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Name</FormLabel>
              <FormControl>
                <Input placeholder="Full name" className="h-8 text-sm" {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="recipientPhone"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Phone</FormLabel>
              <FormControl>
                <Input placeholder="(555) 123-4567" className="h-8 text-sm" {...field} />
              </FormControl>
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name="recipientEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="email@example.com" className="h-8 text-sm" {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="recipientAddress"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Address</FormLabel>
              <FormControl>
                <Input placeholder="Street, City, State" className="h-8 text-sm" {...field} />
              </FormControl>
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="recipientNotes"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs">Notes</FormLabel>
            <FormControl>
              <Textarea placeholder="Private notes..." className="min-h-[50px] text-sm" {...field} />
            </FormControl>
          </FormItem>
        )}
      />

      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name="recipientDob"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Date of Birth</FormLabel>
              <FormControl>
                <DatePicker value={field.value} onChange={field.onChange} placeholder="Date of birth" />
              </FormControl>
            </FormItem>
          )}
        />
        <div className="flex items-end gap-3 pb-1">
          <FormField
            control={form.control}
            name="recipientIsWidow"
            render={({ field }) => (
              <FormItem className="flex items-center space-x-1.5 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="text-xs font-normal">Widow</FormLabel>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="recipientIsSingleParent"
            render={({ field }) => (
              <FormItem className="flex items-center space-x-1.5 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="text-xs font-normal">Single Parent</FormLabel>
              </FormItem>
            )}
          />
        </div>
      </div>

      <div className="pt-2 border-t">
        <p className="text-[11px] text-slate-500 mb-2">Government Assistance</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {([
            ["recipientMedicaid", "Medicaid"],
            ["recipientMedicare", "Medicare"],
            ["recipientSocialSecurity", "Social Security"],
            ["recipientSnap", "SNAP"],
            ["recipientDisability", "Disability"],
          ] as const).map(([name, label]) => (
            <FormField
              key={name}
              control={form.control}
              name={name}
              render={({ field }) => (
                <FormItem className="flex items-center space-x-1.5 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="text-xs font-normal">{label}</FormLabel>
                </FormItem>
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );

  const renderStepReview = () => {
    const values = form.getValues();
    const selectedCategoryLabels = Array.from(
      new Set(
        (values.categorySelections || [])
          .map((value) => value.trim())
          .filter((value) => value.length > 0)
          .map((value) => categoryOptions.find((c) => c.value === value)?.label || value),
      ),
    );
    const typeLabels: Record<string, string> = {
      [NeedType.ONETIME]: "One-Time",
      [NeedType.ONGOING]: "Ongoing",
      [NeedType.GROUP]: "Group Project",
      [NeedType.EVENT]: "Event",
    };

    return (
      <div className="space-y-3">
        <div className="rounded-md border p-3 space-y-1.5">
          <h3 className="font-semibold text-sm">{values.title || "Untitled"}</h3>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            {selectedCategoryLabels.map((label) => (
              <span key={label} className="px-2 py-0.5 bg-[#197991]/10 text-[#197991] rounded-full font-medium">
                {label}
              </span>
            ))}
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{typeLabels[values.needType] || values.needType}</span>
            {values.estimatedCost && (
              <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded-full">${values.estimatedCost}</span>
            )}
            {values.neededBy && <span className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full">By {values.neededBy}</span>}
          </div>
          {values.description && (
            <div className="text-xs text-gray-600 line-clamp-2 mt-1" dangerouslySetInnerHTML={{ __html: values.description }} />
          )}
        </div>

        {(values.eventDate || values.endDate || values.eventStartTime || values.eventEndTime || values.eventLocation || (isGroup && values.volunteersNeeded)) && (
          <div className="rounded-md border p-3 text-xs space-y-0.5">
            <p className="font-medium text-slate-700 mb-1">{isEvent ? "Event" : "Schedule"}</p>
            {values.eventDate && (
              <p>
                <span className="text-slate-400">{isEvent ? "Start Date" : "Date"}:</span> {values.eventDate}
              </p>
            )}
            {isEvent && values.endDate && (
              <p>
                <span className="text-slate-400">End Date:</span> {values.endDate}
              </p>
            )}
            {values.eventStartTime && values.eventEndTime && (
              <p>
                <span className="text-slate-400">Time:</span> {formatTimeRangeForDisplay(values.eventStartTime, values.eventEndTime)}
              </p>
            )}
            {values.eventLocation && (
              <p>
                <span className="text-slate-400">Location:</span> {values.eventLocation}
              </p>
            )}
            {isGroup && values.volunteersNeeded && (
              <p>
                <span className="text-slate-400">Volunteers:</span> {values.volunteersNeeded}
              </p>
            )}
            {isEvent && (values.eventRoles?.length || 0) > 0 && (
              <p>
                <span className="text-slate-400">Role Slots:</span> {values.eventRoles?.length}
              </p>
            )}
          </div>
        )}

        {!isEvent && values.recipientName && (
          <div className="rounded-md border p-3 text-xs space-y-0.5">
            <p className="font-medium text-slate-700 mb-1 flex items-center gap-1">
              <LockIcon className="h-3 w-3" /> Recipient
            </p>
            <p>{values.recipientName}</p>
            {values.recipientPhone && <p className="text-slate-500">{values.recipientPhone}</p>}
            {values.recipientEmail && <p className="text-slate-500">{values.recipientEmail}</p>}
          </div>
        )}

        <div className="rounded-md border p-3 text-xs space-y-1">
          <p className="font-medium text-slate-700">Response Mode</p>
          {isEvent ? (
            <p>Sign Up (slot selection)</p>
          ) : (
            <>
              <p>{values.allowItemDonations ? "Item support enabled" : "Item support disabled"}</p>
              <p>Financial contributions disabled</p>
            </>
          )}
        </div>

        {values.imageUrl && <img src={values.imageUrl} alt="Preview" className="rounded-md w-full max-h-24 object-cover" />}
      </div>
    );
  };

  const renderNavFooter = () => {
    const isPending = updateNeedMutation.isPending;
    const isDraftNeed = need.status === NeedStatus.DRAFT;
    const saveChanges = form.handleSubmit(onSubmit, onFormError);
    const publishButton = isDraftNeed ? (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full text-xs h-8 bg-blue-50 text-blue-600 hover:bg-blue-100"
        onClick={handlePublish}
        disabled={isPending}
      >
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
        Publish Now
      </Button>
    ) : null;

    return (
      <div className="flex items-center justify-between pt-3 mt-3 border-t flex-shrink-0">
        <div>
          {currentStepIndex > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={goPrev} className="gap-0.5 h-8 text-xs">
              <ChevronLeft className="h-3.5 w-3.5" /> Back
            </Button>
          )}
        </div>

        <div className="flex gap-1.5">
          <Button type="button" variant="outline" size="sm" className="rounded-full text-xs h-8" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          {publishButton}

          {currentStep === "review" ? (
            isDraftNeed ? (
              <Button
                type="submit"
                size="sm"
                className="bg-[#d14633] hover:bg-[#197991] text-white font-bold rounded-full text-xs h-8 gap-0.5"
                disabled={isPending}
              >
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Save Changes
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full text-xs h-8 border-slate-400 text-slate-600"
                  onClick={onSaveAsDraft}
                  disabled={isPending}
                >
                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                  Save as Draft
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-[#d14633] hover:bg-[#197991] text-white font-bold rounded-full text-xs h-8 gap-0.5"
                  disabled={isPending}
                >
                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Save Changes
                </Button>
              </>
            )
          ) : (
            <>
              <Button
                type="button"
                size="sm"
                className="bg-[#197991] hover:bg-[#197991]/90 text-white rounded-full text-xs h-8 gap-0.5"
                onClick={goNext}
                disabled={isPending}
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-[#d14633] hover:bg-[#197991] text-white font-bold rounded-full text-xs h-8 gap-0.5"
                onClick={saveChanges}
                disabled={isPending}
              >
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Save Changes
              </Button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit, onFormError)}
        className="flex flex-col"
        style={variant === "dialog" ? { maxHeight: "calc(85vh - 80px)" } : undefined}
      >
        {renderStepIndicator()}
        <div className="flex-1 overflow-y-auto min-h-0 pr-1 pb-1">
          {currentStep === "basics" && renderStepBasics()}
          {currentStep === "details" && renderStepDetails()}
          {isEvent && currentStep === "eventRoles" && renderStepEventRoles()}
          {currentStep === "response" && renderStepResponse()}
          {!isEvent && currentStep === "recipient" && renderStepRecipient()}
          {currentStep === "review" && renderStepReview()}
        </div>
        {renderNavFooter()}
      </form>
    </Form>
  );
};

export default EditNeedForm;
