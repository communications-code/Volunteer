
// NEED CREATION FORM COMPONENT
// This is the complete React component for creating needs

import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { insertNeedSchema, NeedCategory, NeedType, NeedStatus } from "../shared/schema";
import ReactQuill from 'react-quill';

const categories = [
  { value: NeedCategory.FOOD, label: "Food" },
  { value: NeedCategory.CLOTHING, label: "Clothing" },
  { value: NeedCategory.SERVICE, label: "Service Project" },
  { value: NeedCategory.EDUCATION, label: "Education" },
  { value: NeedCategory.HOUSING, label: "Housing" },
  { value: NeedCategory.EVENT, label: "Event" },
  { value: NeedCategory.OTHER, label: "Other" },
];

const formSchema = insertNeedSchema.extend({
  estimatedCost: z.union([z.string(), z.number(), z.undefined()]).optional().transform((val) => {
    if (!val) return undefined;
    if (typeof val === "number") return val;
    return parseFloat(val);
  }),
  neededBy: z.string().optional(),
  needType: z.enum([NeedType.ONETIME, NeedType.ONGOING, NeedType.GROUP]).default(NeedType.ONETIME),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  eventDate: z.string().optional(),
  eventTime: z.string().optional(),
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
});

type FormValues = z.infer<typeof formSchema>;

const NeedForm = () => {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "",
      neededBy: "",
      estimatedCost: undefined,
      needType: NeedType.ONETIME,
      startDate: "",
      endDate: "",
      eventDate: "",
      eventTime: "",
      eventLocation: "",
      imageUrl: "",
      redirectUrl: "",
      status: NeedStatus.FLOATING,
      recipientName: "",
      recipientPhone: "",
      recipientEmail: "",
      recipientAddress: "",
      recipientNotes: "",
    },
  });

  const createNeedMutation = useMutation({
    mutationFn: async ({ values, status }: { values: FormValues, status?: NeedStatus }) => {
      const processedValues = {
        ...values,
        estimatedCost: values.estimatedCost ? Math.round(parseFloat(values.estimatedCost.toString()) * 100) : null
      };
      
      const payload = status ? { ...processedValues, status } : processedValues;
      
      const res = await fetch("/api/needs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error("Failed to create need");
      return await res.json();
    },
    onSuccess: () => {
      form.reset();
      // Handle success (toast notification, etc.)
    },
    onError: (error) => {
      // Handle error (toast notification, etc.)
      console.error("Error creating need:", error);
    },
  });

  const onSubmit = (values: FormValues) => {
    createNeedMutation.mutate({ values: values });
  };
  
  const onSaveAsDraft = async () => {
    try {
      const isValid = await form.trigger();
      if (isValid === true) {
        const values = form.getValues();
        createNeedMutation.mutate({ values: values, status: NeedStatus.DRAFT });
      }
    } catch (error) {
      console.error("Error validating form:", error);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Title Field */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium">
          Title
        </label>
        <input
          id="title"
          type="text"
          placeholder="Winter Coats for Families"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          {...form.register("title")}
        />
        {form.formState.errors.title && (
          <p className="mt-1 text-sm text-red-600">{form.formState.errors.title.message}</p>
        )}
      </div>

      {/* Category and Needed By Fields */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="category" className="block text-sm font-medium">
            Category
          </label>
          <select
            id="category"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            {...form.register("category")}
          >
            <option value="">Select a category</option>
            {categories.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
          {form.formState.errors.category && (
            <p className="mt-1 text-sm text-red-600">{form.formState.errors.category.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="neededBy" className="block text-sm font-medium">
            Needed By (optional)
          </label>
          <input
            id="neededBy"
            type="date"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            {...form.register("neededBy")}
          />
        </div>
      </div>

      {/* Description Field with Rich Text Editor */}
      <div>
        <label className="block text-sm font-medium">Description</label>
        <ReactQuill 
          theme="snow"
          placeholder="Provide details about what is needed..."
          className="mt-1"
          modules={{
            toolbar: [
              [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
              ['bold', 'italic', 'underline', 'strike'],
              [{ 'color': [] }, { 'background': [] }],
              [{ 'list': 'ordered'}, { 'list': 'bullet' }],
              ['link', 'image'],
              ['clean']
            ]
          }}
          value={form.watch("description")}
          onChange={(value) => form.setValue("description", value)}
        />
        {form.formState.errors.description && (
          <p className="mt-1 text-sm text-red-600">{form.formState.errors.description.message}</p>
        )}
      </div>

      {/* Need Type Selection */}
      <div>
        <label className="block text-sm font-medium">Need Type</label>
        <div className="mt-2 space-y-2">
          {[
            { value: NeedType.ONETIME, label: "One-time Need" },
            { value: NeedType.ONGOING, label: "Ongoing/Monthly Need" },
            { value: NeedType.GROUP, label: "Group Service Project" }
          ].map((type) => (
            <div key={type.value} className="flex items-center">
              <input
                id={type.value}
                type="radio"
                value={type.value}
                className="h-4 w-4 border-gray-300"
                {...form.register("needType")}
              />
              <label htmlFor={type.value} className="ml-3 block text-sm">
                {type.label}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Conditional Fields based on Need Type */}
      {form.watch('needType') === NeedType.ONGOING && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium">
              Start Date
            </label>
            <input
              id="startDate"
              type="date"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              {...form.register("startDate")}
            />
          </div>
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium">
              End Date
            </label>
            <input
              id="endDate"
              type="date"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              {...form.register("endDate")}
            />
          </div>
        </div>
      )}

      {/* Event Date for Group Projects and Events */}
      {(form.watch('needType') === NeedType.GROUP || form.watch('category') === NeedCategory.EVENT) && (
        <div>
          <label htmlFor="eventDate" className="block text-sm font-medium">
            Event Date
          </label>
          <input
            id="eventDate"
            type="date"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            {...form.register("eventDate")}
          />
        </div>
      )}

      {/* Volunteers Needed for Group Projects */}
      {form.watch('needType') === NeedType.GROUP && (
        <div>
          <label htmlFor="volunteersNeeded" className="block text-sm font-medium">
            Number of Volunteers Needed (optional)
          </label>
          <input
            id="volunteersNeeded"
            type="number"
            min="1"
            placeholder="Number of volunteers needed"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            {...form.register("volunteersNeeded")}
          />
        </div>
      )}

      {/* Estimated Cost */}
      <div>
        <label htmlFor="estimatedCost" className="block text-sm font-medium">
          Estimated Cost (optional)
        </label>
        <div className="mt-1 relative rounded-md shadow-sm">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <span className="text-gray-500 sm:text-sm">$</span>
          </div>
          <input
            id="estimatedCost"
            type="number"
            step="0.01"
            placeholder="0.00"
            className="block w-full rounded-md border border-gray-300 pl-7 pr-3 py-2"
            {...form.register("estimatedCost")}
          />
        </div>
      </div>

      {/* Event-specific Fields */}
      {form.watch('category') === NeedCategory.EVENT && (
        <>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="eventTime" className="block text-sm font-medium">
                Event Time
              </label>
              <input
                id="eventTime"
                type="text"
                placeholder="7:00 PM"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                {...form.register("eventTime")}
              />
            </div>
            <div>
              <label htmlFor="eventLocation" className="block text-sm font-medium">
                Event Location
              </label>
              <input
                id="eventLocation"
                type="text"
                placeholder="123 Main St, Cincinnati, OH"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                {...form.register("eventLocation")}
              />
            </div>
          </div>

          <div>
            <label htmlFor="redirectUrl" className="block text-sm font-medium">
              Event Signup URL
            </label>
            <input
              id="redirectUrl"
              type="url"
              placeholder="https://registration-site.com/event-signup"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              {...form.register("redirectUrl")}
            />
          </div>
        </>
      )}

      {/* Status Selection */}
      <div>
        <label className="block text-sm font-medium">Status</label>
        <div className="mt-2 space-y-2">
          <div className="flex items-center">
            <input
              id="floating"
              type="radio"
              value={NeedStatus.FLOATING}
              className="h-4 w-4 border-gray-300"
              {...form.register("status")}
            />
            <label htmlFor="floating" className="ml-3 block text-sm">
              Regular Need
            </label>
          </div>
          <div className="flex items-center">
            <input
              id="recurring"
              type="radio"
              value={NeedStatus.RECURRING}
              className="h-4 w-4 border-gray-300"
              {...form.register("status")}
            />
            <label htmlFor="recurring" className="ml-3 block text-sm">
              Recurring Need
            </label>
          </div>
        </div>
      </div>

      {/* Admin-only Recipient Contact Information */}
      <div className="border rounded-lg p-4 bg-gray-50">
        <h3 className="text-lg font-semibold mb-4">
          Recipient Information (Admin Only)
        </h3>
        
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="recipientName" className="block text-sm font-medium">
              Recipient Name
            </label>
            <input
              id="recipientName"
              type="text"
              placeholder="Full name of recipient"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              {...form.register("recipientName")}
            />
          </div>
          <div>
            <label htmlFor="recipientPhone" className="block text-sm font-medium">
              Phone Number
            </label>
            <input
              id="recipientPhone"
              type="text"
              placeholder="(555) 123-4567"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              {...form.register("recipientPhone")}
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 mt-4">
          <div>
            <label htmlFor="recipientEmail" className="block text-sm font-medium">
              Email Address
            </label>
            <input
              id="recipientEmail"
              type="email"
              placeholder="email@example.com"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              {...form.register("recipientEmail")}
            />
          </div>
          <div>
            <label htmlFor="recipientAddress" className="block text-sm font-medium">
              Address
            </label>
            <input
              id="recipientAddress"
              type="text"
              placeholder="Street address, city, state, zip"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              {...form.register("recipientAddress")}
            />
          </div>
        </div>
        
        <div className="mt-4">
          <label htmlFor="recipientNotes" className="block text-sm font-medium">
            Additional Notes
          </label>
          <textarea
            id="recipientNotes"
            placeholder="Add any private notes about the recipient..."
            rows={3}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            {...form.register("recipientNotes")}
          />
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-3">
        <button 
          type="button" 
          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium"
          onClick={() => form.reset()}
        >
          Cancel
        </button>
        <button 
          type="button" 
          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium"
          onClick={onSaveAsDraft}
          disabled={createNeedMutation.isPending}
        >
          {createNeedMutation.isPending ? "Saving..." : "Save as Draft"}
        </button>
        <button 
          type="submit" 
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
          disabled={createNeedMutation.isPending}
        >
          {createNeedMutation.isPending ? "Creating..." : "Create Need"}
        </button>
      </div>
    </form>
  );
};

// PLEDGE FORM COMPONENT
// This is the complete React component for creating pledges

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { insertPledgeSchema } from "../shared/schema";

const pledgeFormSchema = insertPledgeSchema.extend({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email"),
  phone: z.string().optional(),
  notes: z.string().optional(),
  donationType: z.enum(["items", "money"]),
  isOngoingCommitment: z.boolean().optional(),
  subscribeToEmails: z.boolean().optional().default(true),
  paymentCompleted: z.boolean().optional(),
});

type PledgeFormValues = z.infer<typeof pledgeFormSchema>;

const PledgeForm = ({ need, onClose }) => {
  const [showCheckout, setShowCheckout] = useState(false);
  
  const form = useForm<PledgeFormValues>({
    resolver: zodResolver(pledgeFormSchema),
    defaultValues: {
      needId: need.id,
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      notes: "",
      donationType: "items",
      isOngoingCommitment: need.needType === "ONGOING" ? false : undefined,
      subscribeToEmails: true,
      paymentCompleted: false,
    },
  });

  const pledgeMutation = useMutation({
    mutationFn: async (values: PledgeFormValues) => {
      const res = await fetch("/api/pledges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      });
      
      if (!res.ok) throw new Error("Failed to create pledge");
      return await res.json();
    },
    onSuccess: () => {
      onClose();
      // Handle success (toast notification, etc.)
    },
    onError: (error) => {
      // Handle error (toast notification, etc.)
      console.error("Error creating pledge:", error);
    },
  });

  const onSubmit = (values: PledgeFormValues) => {
    if (values.donationType === "money" && need.estimatedCost) {
      setShowCheckout(true);
    } else {
      pledgeMutation.mutate(values);
    }
  };

  const handleCheckoutSuccess = (details: any) => {
    form.setValue("paymentCompleted", true);
    const formValues = form.getValues();
    pledgeMutation.mutate(formValues);
  };

  if (showCheckout && need.estimatedCost) {
    return (
      <div className="max-w-md mx-auto">
        <h3 className="text-lg font-medium mb-4">Complete Your Donation</h3>
        <p className="mb-4">
          You're donating ${(need.estimatedCost / 100).toFixed(2)} for: {need.title}
        </p>
        
        {/* Checkout component would go here */}
        <div className="bg-gray-100 p-4 rounded mb-4 text-center">
          Checkout component
        </div>
        
        <button
          type="button"
          className="w-full px-4 py-2 border border-gray-300 rounded-md"
          onClick={() => setShowCheckout(false)}
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Pledge to Help</h3>
        <p className="text-gray-600">
          You are pledging to help with: <strong>{need.title}</strong>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium">
            First name
          </label>
          <input
            id="firstName"
            type="text"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            {...form.register("firstName")}
          />
          {form.formState.errors.firstName && (
            <p className="mt-1 text-sm text-red-600">{form.formState.errors.firstName.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="lastName" className="block text-sm font-medium">
            Last name
          </label>
          <input
            id="lastName"
            type="text"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            {...form.register("lastName")}
          />
          {form.formState.errors.lastName && (
            <p className="mt-1 text-sm text-red-600">{form.formState.errors.lastName.message}</p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          {...form.register("email")}
        />
        {form.formState.errors.email && (
          <p className="mt-1 text-sm text-red-600">{form.formState.errors.email.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium">
          Phone (optional)
        </label>
        <input
          id="phone"
          type="tel"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          {...form.register("phone")}
        />
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium">
          Additional Notes (optional)
        </label>
        <textarea
          id="notes"
          rows={3}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          {...form.register("notes")}
        />
      </div>

      {need.estimatedCost && (
        <div>
          <label className="block text-sm font-medium">How would you like to help?</label>
          <div className="mt-2 space-y-2">
            <div className="flex items-center">
              <input
                id="donate-items"
                type="radio"
                value="items"
                className="h-4 w-4 border-gray-300"
                {...form.register("donationType")}
              />
              <label htmlFor="donate-items" className="ml-3 block text-sm">
                I will donate the needed items
              </label>
            </div>
            <div className="flex items-center">
              <input
                id="donate-money"
                type="radio"
                value="money"
                className="h-4 w-4 border-gray-300"
                {...form.register("donationType")}
              />
              <label htmlFor="donate-money" className="ml-3 block text-sm">
                I will donate money for the items (${(need.estimatedCost / 100).toFixed(2)})
              </label>
            </div>
          </div>
        </div>
      )}

      {need.needType === "ONGOING" && (
        <div className="flex items-center">
          <input
            id="ongoing-commitment"
            type="checkbox"
            className="h-4 w-4 border-gray-300"
            {...form.register("isOngoingCommitment")}
          />
          <label htmlFor="ongoing-commitment" className="ml-3 block text-sm">
            I commit to providing this help on an ongoing basis for the duration of the need
          </label>
        </div>
      )}

      <div className="flex items-center">
        <input
          id="subscribe-emails"
          type="checkbox"
          className="h-4 w-4 border-gray-300"
          {...form.register("subscribeToEmails")}
        />
        <label htmlFor="subscribe-emails" className="ml-3 block text-sm">
          Keep me updated about future community needs
        </label>
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium"
          onClick={onClose}
        >
          Cancel
        </button>
        <button 
          type="submit" 
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
          disabled={pledgeMutation.isPending}
        >
          {pledgeMutation.isPending ? "Submitting..." : "Submit Pledge"}
        </button>
      </div>
    </form>
  );
};

export { NeedForm, PledgeForm };
