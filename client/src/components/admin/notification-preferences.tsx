import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { type Category } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCategories } from "@/hooks/use-categories";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";

type NotificationPreferencesResponse = {
  receiveAllNotifications: boolean;
  enabledCategories: string[];
};

export default function NotificationPreferences() {
  const { toast } = useToast();
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const { data: preferences, isLoading: preferencesLoading } = useQuery<NotificationPreferencesResponse>({
    queryKey: ["/api/admin/notification-preferences"],
  });

  const [receiveAllNotifications, setReceiveAllNotifications] = useState(true);
  const [enabledCategories, setEnabledCategories] = useState<string[]>([]);

  useEffect(() => {
    if (!preferences) return;
    setReceiveAllNotifications(preferences.receiveAllNotifications);
    setEnabledCategories(preferences.enabledCategories);
  }, [preferences]);

  const sortedCategories = useMemo(() => {
    return [...(categories || [])].sort((a: Category, b: Category) => a.displayOrder - b.displayOrder);
  }, [categories]);

  const updateMutation = useMutation({
    mutationFn: async (payload: NotificationPreferencesResponse) => {
      const response = await apiRequest("PUT", "/api/admin/notification-preferences", payload);
      return (await response.json()) as NotificationPreferencesResponse;
    },
    onSuccess: (saved) => {
      setReceiveAllNotifications(saved.receiveAllNotifications);
      setEnabledCategories(saved.enabledCategories);
      queryClient.setQueryData(["/api/admin/notification-preferences"], saved);
      toast({
        title: "Preferences saved",
        description: "Your email notification settings were updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not save preferences",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleCategory = (slug: string, checked: boolean) => {
    setEnabledCategories((current) => {
      if (checked) {
        return Array.from(new Set([...current, slug]));
      }
      return current.filter((value) => value !== slug);
    });
  };

  const savePreferences = () => {
    updateMutation.mutate({
      receiveAllNotifications,
      enabledCategories,
    });
  };

  if (preferencesLoading || categoriesLoading) {
    return (
      <div className="rounded-xl border bg-white p-4 space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-white p-4">
      <h3 className="text-lg font-medium text-[#212421]">Email Notification Preferences</h3>
      <p className="text-sm text-gray-600 mt-1">
        Choose which need categories should send you admin notification emails.
      </p>

      <div className="mt-4 flex items-center justify-between rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium text-gray-900">Receive all notifications</p>
          <p className="text-xs text-gray-600">Turn off to pick specific categories.</p>
        </div>
        <Switch
          checked={receiveAllNotifications}
          onCheckedChange={(checked) => setReceiveAllNotifications(Boolean(checked))}
          aria-label="Receive all notifications"
        />
      </div>

      {!receiveAllNotifications ? (
        <div className="mt-4 rounded-lg border p-3">
          <p className="text-sm font-medium text-gray-900">Categories</p>
          <p className="text-xs text-gray-600 mt-1">Select none to mute all notifications.</p>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {sortedCategories.map((category) => {
              const checked = enabledCategories.includes(category.slug);
              return (
                <label
                  key={category.id}
                  className="flex items-center gap-2 rounded-md border px-2 py-2 text-sm cursor-pointer hover:bg-gray-50"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) => toggleCategory(category.slug, Boolean(value))}
                  />
                  <span>{category.name}</span>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-4">
        <Button
          onClick={savePreferences}
          disabled={updateMutation.isPending}
          className="bg-[#d14633] hover:bg-[#197991]"
        >
          {updateMutation.isPending ? "Saving..." : "Save Preferences"}
        </Button>
      </div>
    </div>
  );
}
