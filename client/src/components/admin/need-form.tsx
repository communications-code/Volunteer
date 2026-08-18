import { useEffect, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { insertNeedSchema, NeedType, NeedStatus } from "@shared/schema";
import { useCategories } from "@/hooks/use-categories";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatTimeRangeForDisplay } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { ImageUpload } from "./image-upload-fixed";
import EventRolesEditor, { type EventRoleFormValue } from "./event-roles-editor";
import { DatePicker } from "@/components/ui/date-picker";
import ReactQuill from 'react-quill';
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

interface NeedFormProps {
  onClose?: () => void;
}

const STEPS = [
  { id: "basics", label: "Basics" },
  { id: "details", label: "Type of help" },
  { id: "category", label: "Category & image" },
  { id: "eventRoles", label: "Roles & times" },
  { id: "recipient", label: "Recipient" },
  { id: "review", label: "Review" },
] as const;

type StepId = typeof STEPS[number]["id"];
type HelpKind = "volunteer" | "item";
type VolunteerScope = "individual" | "group";
type VolunteerCadence = "onetime" | "recurring";

const NeedForm = ({ onClose }: NeedFormProps = {}) => {
  const [currentStep, setCurrentStep] = useState<StepId>("basics");
  const [helpKind, setHelpKind] = useState<HelpKind>("volunteer");
  const [volunteerScope, setVolunteerScope] = useState<VolunteerScope>("individual");
  const [volunteerCadence, setVolunteerCadence] = useState<VolunteerCadence>("onetime");
  const { toast } = useToast();
  const { data: dbCategories } = useCategories();

  const categoryOptions = (dbCategories || []).map((c) => ({ value: c.slug, label: c.name }));

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "",
      categorySelections: [],
      neededBy: "",
      estimatedCost: undefined,
      needType: NeedType.ONETIME,
      startDate: "",
      endDate: "",
      eventDate: "",
      eventTime: "",
      eventStartTime: "",
      eventEndTime: "",
      eventLocation: "",
      imageUrl: "",
      redirectUrl: "",
      status: NeedStatus.FLOATING,
      recipientName: "",
      recipientPhone: "",
      recipientEmail: "",
      recipientAddress: "",
      recipientNotes: "",
      recipientDob: "",
      recipientIsWidow: false,
      recipientIsSingleParent: false,
      recipientInsurance: "",
      recipientMedicaid: false,
      recipientMedicare: false,
      recipientSocialSecurity: false,
      recipientSnap: false,
      recipientDisability: false,
      allowItemDonations: true,
      allowMoneyDonations: false,
      eventRoles: [],
    },
  });

  const createNeedMutation = useMutation({
    mutationFn: async ({ values, status }: { values: FormValues; status?: NeedStatus }) => {
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
        estimatedCost: isEventPayload ? null : !isNaN(costNum) ? Math.round(costNum * 100) : null,
        allowItemDonations: isEventPayload ? false : values.allowItemDonations,
        allowMoneyDonations: false,
        eventRoles: isEventPayload ? eventRoles : undefined,
      };
      const payload = status ? { ...processedValues, status } : processedValues;
      const res = await apiRequest("POST", "/api/needs", payload);
      return await res.json();
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/needs"] });
      toast({
        title: status === NeedStatus.DRAFT ? "Draft saved successfully" : "Need created successfully",
      });
      form.reset();
      setHelpKind("volunteer");
      setVolunteerScope("individual");
      setVolunteerCadence("onetime");
      setCurrentStep("basics");
      onClose?.();
    },
    onError: (error) => {
      toast({
        title: "Error creating need",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: FormValues) => {
    console.log("NeedForm onSubmit called with:", values);
    createNeedMutation.mutate({ values });
  };

  const onFormError = (errors: any) => {
    console.error("NeedForm validation errors:", errors);
    toast({
      title: "Validation error",
      description: "Please check the form for errors and fill in all required fields.",
      variant: "destructive",
    });
  };

  const onSaveAsDraft = async () => {
    try {
      const isValid = await form.trigger(["title", "categorySelections", "description"]);
      if (isValid) {
        const values = form.getValues();
        createNeedMutation.mutate({ values, status: NeedStatus.DRAFT });
      } else {
        toast({
          title: "Missing required fields",
          description: "Please fill in the title, description, and category.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error validating form:", error);
      toast({ title: "Error saving draft", description: "Please check the form for errors", variant: "destructive" });
    }
  };

  const needType = form.watch("needType");
  const isEvent = needType === NeedType.EVENT;
  const isVolunteerNeed = helpKind === "volunteer";
  const isGroupVolunteer = isVolunteerNeed && volunteerScope === "group";
  const isItemNeed = helpKind === "item";

  const steps = STEPS.filter((step) => {
    if (step.id === "eventRoles") return isGroupVolunteer;
    return true;
  });
  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  useEffect(() => {
    if (helpKind === "volunteer") {
      form.setValue("needType", NeedType.EVENT);
      form.setValue("allowItemDonations", false);
      form.setValue("allowMoneyDonations", false);
      form.setValue("status", NeedStatus.FLOATING);
      form.setValue("volunteersNeeded", undefined);
      form.setValue("estimatedCost", undefined);
      if (volunteerScope === "individual") {
        form.setValue("eventRoles", []);
        if (currentStep === "eventRoles") {
          setCurrentStep("recipient");
        }
      }
    } else {
      const allowItems = Boolean(form.getValues("allowItemDonations"));
      const allowMoney = Boolean(form.getValues("allowMoneyDonations"));
      if (!allowItems && !allowMoney) {
        form.setValue("allowItemDonations", true);
        form.setValue("allowMoneyDonations", false);
      }
      form.setValue("needType", NeedType.ONETIME);
      form.setValue("eventRoles", []);
      form.setValue("eventStartTime", "");
      form.setValue("eventEndTime", "");
      form.setValue("eventLocation", "");
      form.setValue("eventDate", "");
      form.setValue("volunteersNeeded", undefined);
      if (currentStep === "eventRoles") {
        setCurrentStep("recipient");
      }
    }
  }, [form, helpKind, volunteerScope, currentStep]);

  const goNext = async () => {
    let fieldsToValidate: (keyof FormValues)[] = [];
    if (currentStep === "basics") {
      fieldsToValidate = ["title", "description"];
    }
    if (currentStep === "details") {
      if (isGroupVolunteer) {
        fieldsToValidate.push("eventDate");
      }
    }
    if (currentStep === "category") {
      fieldsToValidate = ["categorySelections"];
    }
    if (fieldsToValidate.length > 0) {
      const valid = await form.trigger(fieldsToValidate);
      if (!valid) return;
    }
    if (currentStep === "details" && isGroupVolunteer && !form.getValues("eventDate")) {
      form.setError("eventDate", { type: "manual", message: "Project date is required." });
      return;
    }
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) setCurrentStep(steps[nextIndex].id);
  };

  const goPrev = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) setCurrentStep(steps[prevIndex].id);
  };

  const resetAndClose = () => {
    form.reset();
    setHelpKind("volunteer");
    setVolunteerScope("individual");
    setVolunteerCadence("onetime");
    setCurrentStep("basics");
    onClose?.();
  };

  // ── Compact step indicator ──
  // NOTE: All step render functions below are called as plain functions {renderXxx()}
  // rather than as components <Xxx />, to avoid React unmounting/remounting on every
  // re-render (which causes inputs to lose focus).
  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-1 mb-3">
      {steps.map((step, i) => {
        const isActive = step.id === currentStep;
        const isDone = i < currentStepIndex;
        return (
          <button
            key={step.id}
            type="button"
            onClick={() => {
              if (i <= currentStepIndex) setCurrentStep(step.id);
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
              isActive
                ? "bg-[#197991] text-white"
                : isDone
                  ? "bg-[#197991]/15 text-[#197991] hover:bg-[#197991]/25 cursor-pointer"
                  : "bg-gray-100 text-gray-400"
            }`}
          >
            {isDone ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>}
            <span>{step.label}</span>
          </button>
        );
      })}
    </div>
  );

  // ── STEP 1: Basics ──
  const renderStepBasics = () => (
    <div className="space-y-3">
      <FormField control={form.control} name="title" render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs">Title *</FormLabel>
          <FormControl><Input placeholder="Help Ms. Johnson with groceries" className="h-8 text-sm" {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />

      <FormField control={form.control} name="description" render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs">Short description *</FormLabel>
          <FormControl>
            <ReactQuill
              theme="snow"
              placeholder="Write the plain-language summary people should see..."
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
      )} />
    </div>
  );

  // ── STEP 2: Details ──
  const renderStepDetails = () => (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-xs font-medium text-slate-700">Type of help</p>
        <RadioGroup value={helpKind} onValueChange={(value) => setHelpKind(value as HelpKind)} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[
            { value: "volunteer", label: "I need a volunteer or volunteers", helper: "For a person, group, visit, delivery, project, or recurring help." },
            { value: "item", label: "I need an item", helper: "For goods, supplies, food, clothing, or money toward a specific item." },
          ].map((opt) => (
            <label key={opt.value} className={`flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm transition-colors ${
              helpKind === opt.value ? "border-[#197991] bg-[#197991]/5" : "border-gray-200 hover:border-gray-300"
            }`}>
              <RadioGroupItem value={opt.value} className="mt-0.5 h-3.5 w-3.5" />
              <span>
                <span className="block font-medium">{opt.label}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">{opt.helper}</span>
              </span>
            </label>
          ))}
        </RadioGroup>
      </div>

      {isVolunteerNeed ? (
        <div className="space-y-3 rounded-md border border-slate-200 p-3">
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-700">Do you need a group or an individual?</p>
            <RadioGroup value={volunteerScope} onValueChange={(value) => setVolunteerScope(value as VolunteerScope)} className="grid grid-cols-2 gap-2">
              {[
                { value: "individual", label: "Individual" },
                { value: "group", label: "Group" },
              ].map((opt) => (
                <label key={opt.value} className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-sm transition-colors ${
                  volunteerScope === opt.value ? "border-[#197991] bg-[#197991]/5 font-medium" : "border-gray-200 hover:border-gray-300"
                }`}>
                  <RadioGroupItem value={opt.value} className="h-3.5 w-3.5" />
                  {opt.label}
                </label>
              ))}
            </RadioGroup>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-700">Is this one time or recurring?</p>
            <RadioGroup value={volunteerCadence} onValueChange={(value) => setVolunteerCadence(value as VolunteerCadence)} className="grid grid-cols-2 gap-2">
              {[
                { value: "onetime", label: "One time" },
                { value: "recurring", label: "Recurring" },
              ].map((opt) => (
                <label key={opt.value} className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-sm transition-colors ${
                  volunteerCadence === opt.value ? "border-[#197991] bg-[#197991]/5 font-medium" : "border-gray-200 hover:border-gray-300"
                }`}>
                  <RadioGroupItem value={opt.value} className="h-3.5 w-3.5" />
                  {opt.label}
                </label>
              ))}
            </RadioGroup>
          </div>

          {volunteerScope === "individual" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField control={form.control} name="eventDate" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">{volunteerCadence === "recurring" ? "First date" : "Date"}</FormLabel>
                  <FormControl><DatePicker value={field.value || ""} onChange={field.onChange} placeholder="Optional" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="neededBy" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Needed by</FormLabel>
                  <FormControl><DatePicker value={field.value} onChange={field.onChange} placeholder="Optional" /></FormControl>
                </FormItem>
              )} />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField control={form.control} name="eventDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">{volunteerCadence === "recurring" ? "First project date *" : "Project date *"}</FormLabel>
                    <FormControl><DatePicker value={field.value || ""} onChange={field.onChange} placeholder="Select date" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="eventLocation" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Location</FormLabel><FormControl><Input placeholder="Optional" className="h-8 text-sm" {...field} /></FormControl></FormItem>
                )} />
              </div>
              <p className="text-[11px] text-slate-500">Next you will add roles, times, and volunteer counts.</p>
            </div>
          )}

          <div className="rounded-md border border-[#197991]/30 bg-[#197991]/5 px-3 py-2 text-[11px] text-slate-600">
            Volunteer requests use sign-ups. They do not ask for items, money, or estimated cost.
          </div>
        </div>
      ) : (
        <div className="space-y-3 rounded-md border border-slate-200 p-3">
          <FormField control={form.control} name="neededBy" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Needed by</FormLabel>
              <FormControl><DatePicker value={field.value} onChange={field.onChange} placeholder="Optional" /></FormControl>
            </FormItem>
          )} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField control={form.control} name="estimatedCost" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Estimated cost</FormLabel>
                <FormControl>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5"><span className="text-sm text-gray-500">$</span></div>
                    <Input type="number" step="0.01" placeholder="0.00" className="h-8 pl-6 text-sm" {...field} />
                  </div>
                </FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="status" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">How many responses?</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value={NeedStatus.FLOATING}>One response completes it</SelectItem>
                    <SelectItem value={NeedStatus.RECURRING}>Keep accepting responses</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
          </div>

          <div className="rounded-md border border-slate-200 p-3 space-y-2">
            <p className="text-xs font-semibold text-slate-700">How can people respond?</p>
            <div className="flex flex-wrap gap-4 pt-1">
              <FormField control={form.control} name="allowItemDonations" render={({ field }) => (
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
                  <FormLabel className="text-xs font-normal">Item support</FormLabel>
                </FormItem>
              )} />
            </div>
            {form.formState.errors.allowItemDonations && (
              <p className="text-[11px] text-red-600">{form.formState.errors.allowItemDonations.message}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderStepCategory = () => (
    <div className="space-y-3">
      <FormField control={form.control} name="categorySelections" render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs">Category *</FormLabel>
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
      )} />

      <FormField control={form.control} name="imageUrl" render={({ field }) => (
        <FormItem>
          <FormControl>
            <ImageUpload onImageUploaded={field.onChange} currentImageUrl={field.value} compact />
          </FormControl>
        </FormItem>
      )} />

      <p className="text-[11px] text-slate-500">
        Category controls where the need appears. The image is optional.
      </p>
    </div>
  );

  // ── STEP 3 (Event-only): Role Slots ──
  const renderStepEventRoles = () => (
    <div className="space-y-3">
      <div className="rounded-md border border-[#197991]/30 bg-[#197991]/5 px-3 py-2">
        <p className="text-xs font-semibold text-[#197991]">Roles and times</p>
        <p className="text-[11px] text-slate-600">
          Add each role, time window, and how many people are needed.
        </p>
      </div>
      <EventRolesEditor form={form} compact defaultSlotDate={form.watch("eventDate") || ""} />
    </div>
  );

  // ── STEP 4: Response / Media ──
  const renderStepResponse = () => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="estimatedCost" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs">Est. Cost</FormLabel>
            <FormControl>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5"><span className="text-gray-500 text-sm">$</span></div>
                <Input type="number" step="0.01" placeholder="0.00" className="pl-6 h-8 text-sm" {...field} />
              </div>
            </FormControl>
          </FormItem>
        )} />
        {isEvent ? (
          <div className="rounded-md border p-2.5 bg-slate-50">
            <p className="text-xs font-medium text-slate-700">Sign-up mode</p>
            <p className="text-[11px] text-slate-500">Event responses use role-slot registration.</p>
          </div>
        ) : (
          <FormField control={form.control} name="status" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Responses</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value={NeedStatus.FLOATING}>Standard (one pledge)</SelectItem>
                  <SelectItem value={NeedStatus.RECURRING}>Multiple allowed</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )} />
        )}
      </div>

      <FormField control={form.control} name="imageUrl" render={({ field }) => (
        <FormItem>
          <FormControl>
            <ImageUpload onImageUploaded={field.onChange} currentImageUrl={field.value} compact={isEvent} />
          </FormControl>
        </FormItem>
      )} />

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
          <p className="text-[11px] text-slate-500">
            Choose which options people can select when pledging.
          </p>
          <div className="flex flex-wrap gap-4 pt-1">
            <FormField control={form.control} name="allowItemDonations" render={({ field }) => (
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
            )} />
          </div>
          {form.formState.errors.allowItemDonations && (
            <p className="text-[11px] text-red-600">{form.formState.errors.allowItemDonations.message}</p>
          )}
        </div>
      )}
    </div>
  );

  // ── STEP 3: Recipient Info (Admin Only) ──
  const renderStepRecipient = () => (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <LockIcon className="h-3.5 w-3.5" />
        <span>Admin only — not shown publicly</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="recipientName" render={({ field }) => (
          <FormItem><FormLabel className="text-xs">Name</FormLabel><FormControl><Input placeholder="Full name" className="h-8 text-sm" {...field} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name="recipientPhone" render={({ field }) => (
          <FormItem><FormLabel className="text-xs">Phone</FormLabel><FormControl><Input placeholder="(555) 123-4567" className="h-8 text-sm" {...field} /></FormControl></FormItem>
        )} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="recipientEmail" render={({ field }) => (
          <FormItem><FormLabel className="text-xs">Email</FormLabel><FormControl><Input type="email" placeholder="email@example.com" className="h-8 text-sm" {...field} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name="recipientAddress" render={({ field }) => (
          <FormItem><FormLabel className="text-xs">Address</FormLabel><FormControl><Input placeholder="Street, City, State" className="h-8 text-sm" {...field} /></FormControl></FormItem>
        )} />
      </div>

      <FormField control={form.control} name="recipientNotes" render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs">Notes</FormLabel>
          <FormControl><Textarea placeholder="Private notes..." className="min-h-[50px] text-sm" {...field} /></FormControl>
        </FormItem>
      )} />

      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="recipientDob" render={({ field }) => (
          <FormItem><FormLabel className="text-xs">Date of Birth</FormLabel><FormControl><DatePicker value={field.value} onChange={field.onChange} placeholder="Date of birth" /></FormControl></FormItem>
        )} />
        <div className="flex items-end gap-3 pb-1">
          <FormField control={form.control} name="recipientIsWidow" render={({ field }) => (
            <FormItem className="flex items-center space-x-1.5 space-y-0">
              <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
              <FormLabel className="text-xs font-normal">Widow</FormLabel>
            </FormItem>
          )} />
          <FormField control={form.control} name="recipientIsSingleParent" render={({ field }) => (
            <FormItem className="flex items-center space-x-1.5 space-y-0">
              <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
              <FormLabel className="text-xs font-normal">Single Parent</FormLabel>
            </FormItem>
          )} />
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
            <FormField key={name} control={form.control} name={name} render={({ field }) => (
              <FormItem className="flex items-center space-x-1.5 space-y-0">
                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                <FormLabel className="text-xs font-normal">{label}</FormLabel>
              </FormItem>
            )} />
          ))}
        </div>
      </div>
    </div>
  );

  // ── STEP 4: Review ──
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
    const responseLabel = isVolunteerNeed
      ? `Volunteer sign-up: ${volunteerScope === "group" ? "group" : "individual"}, ${volunteerCadence === "recurring" ? "recurring" : "one time"}`
      : "Item need";

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
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{responseLabel}</span>
            {isItemNeed && values.estimatedCost && <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded-full">${values.estimatedCost}</span>}
            {values.neededBy && <span className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full">By {values.neededBy}</span>}
          </div>
          {values.description && (
            <div className="text-xs text-gray-600 line-clamp-2 mt-1" dangerouslySetInnerHTML={{ __html: values.description }} />
          )}
        </div>

        {(values.eventDate || values.endDate || values.eventStartTime || values.eventEndTime || values.eventLocation || (isGroupVolunteer && values.volunteersNeeded)) && (
          <div className="rounded-md border p-3 text-xs space-y-0.5">
            <p className="font-medium text-slate-700 mb-1">Volunteer details</p>
            {values.eventDate && (
              <p>
                <span className="text-slate-400">{volunteerCadence === "recurring" ? "First date" : "Date"}:</span> {values.eventDate}
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
            {values.eventLocation && <p><span className="text-slate-400">Location:</span> {values.eventLocation}</p>}
            {isGroupVolunteer && values.volunteersNeeded && <p><span className="text-slate-400">Volunteers:</span> {values.volunteersNeeded}</p>}
            {isGroupVolunteer && (values.eventRoles?.length || 0) > 0 && (
              <p>
                <span className="text-slate-400">Roles:</span> {values.eventRoles?.length}
              </p>
            )}
          </div>
        )}

        {values.recipientName && (
          <div className="rounded-md border p-3 text-xs space-y-0.5">
            <p className="font-medium text-slate-700 mb-1 flex items-center gap-1"><LockIcon className="h-3 w-3" /> Recipient</p>
            <p>{values.recipientName}</p>
            {values.recipientPhone && <p className="text-slate-500">{values.recipientPhone}</p>}
            {values.recipientEmail && <p className="text-slate-500">{values.recipientEmail}</p>}
          </div>
        )}

        <div className="rounded-md border p-3 text-xs space-y-1">
          <p className="font-medium text-slate-700">Response Mode</p>
          {isVolunteerNeed ? (
            <p>{isGroupVolunteer ? "Volunteer sign-up with role selection" : "General volunteer sign-up"}</p>
          ) : (
            <>
              <p>{values.allowItemDonations ? "Item support enabled" : "Item support disabled"}</p>
              <p>Financial contributions disabled</p>
            </>
          )}
        </div>

        {values.imageUrl && (
          <img src={values.imageUrl} alt="Preview" className="rounded-md w-full max-h-24 object-cover" />
        )}
      </div>
    );
  };

  // ── Navigation footer ──
  const renderNavFooter = () => (
    <div className="flex items-center justify-between pt-3 mt-3 border-t flex-shrink-0">
      <div>
        {currentStepIndex > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={goPrev} className="gap-0.5 h-8 text-xs">
            <ChevronLeft className="h-3.5 w-3.5" /> Back
          </Button>
        )}
      </div>
      <div className="flex gap-1.5">
        <Button type="button" variant="outline" size="sm" className="rounded-full text-xs h-8"
          onClick={resetAndClose}>
          Cancel
        </Button>

        {currentStep === "review" ? (
          <>
            <Button type="button" variant="outline" size="sm"
              className="rounded-full text-xs h-8 border-slate-400 text-slate-600"
              onClick={onSaveAsDraft} disabled={createNeedMutation.isPending}>
              {createNeedMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              Draft
            </Button>
            <Button type="submit" size="sm"
              className="bg-[#d14633] hover:bg-[#197991] text-white font-bold rounded-full text-xs h-8 gap-0.5"
              disabled={createNeedMutation.isPending}>
              {createNeedMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Create
            </Button>
          </>
        ) : (
          <Button type="button" size="sm"
            className="bg-[#197991] hover:bg-[#197991]/90 text-white rounded-full text-xs h-8 gap-0.5"
            onClick={goNext}>
            Next <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );

  const formContent = (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onFormError)} className="flex flex-col" style={{ maxHeight: "calc(85vh - 60px)" }}>
        {renderStepIndicator()}
        <div className="flex-1 overflow-y-auto min-h-0 pr-1 pb-1">
          {currentStep === "basics" && renderStepBasics()}
          {currentStep === "details" && renderStepDetails()}
          {currentStep === "category" && renderStepCategory()}
          {isGroupVolunteer && currentStep === "eventRoles" && renderStepEventRoles()}
          {currentStep === "recipient" && renderStepRecipient()}
          {currentStep === "review" && renderStepReview()}
        </div>
        {renderNavFooter()}
      </form>
    </Form>
  );

  if (onClose) return formContent;

  return (
    <Card>
      <CardHeader><CardTitle>Create New Need</CardTitle></CardHeader>
      <CardContent>{formContent}</CardContent>
    </Card>
  );
};

export default NeedForm;
