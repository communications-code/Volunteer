import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { type Category } from "@shared/schema";
import { useCategories } from "@/hooks/use-categories";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ShoppingCart, Shirt, Users, BookOpen, Home, Calendar, Heart,
  Utensils, Briefcase, GraduationCap, Building, HelpCircle, Gift, Star,
  Plus, Pencil, Trash2, type LucideIcon,
} from "lucide-react";

// Available icons for categories
const availableIcons: Array<{ name: string; Icon: LucideIcon }> = [
  { name: "ShoppingCart", Icon: ShoppingCart },
  { name: "Shirt", Icon: Shirt },
  { name: "Users", Icon: Users },
  { name: "BookOpen", Icon: BookOpen },
  { name: "Home", Icon: Home },
  { name: "Calendar", Icon: Calendar },
  { name: "Heart", Icon: Heart },
  { name: "Utensils", Icon: Utensils },
  { name: "Briefcase", Icon: Briefcase },
  { name: "GraduationCap", Icon: GraduationCap },
  { name: "Building", Icon: Building },
  { name: "HelpCircle", Icon: HelpCircle },
  { name: "Gift", Icon: Gift },
  { name: "Star", Icon: Star },
];

const iconMap: Record<string, LucideIcon> = Object.fromEntries(
  availableIcons.map((i) => [i.name, i.Icon])
);

interface CategoryManagerProps {
  onClose?: () => void;
}

export default function CategoryManager({ onClose }: CategoryManagerProps) {
  const { toast } = useToast();
  const { data: categories } = useCategories();
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  // Form state for add / edit
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formIcon, setFormIcon] = useState("Heart");
  const [formIsEvent, setFormIsEvent] = useState(false);

  const resetForm = () => {
    setFormName("");
    setFormSlug("");
    setFormIcon("Heart");
    setFormIsEvent(false);
    setEditingId(null);
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setFormName(cat.name);
    setFormSlug(cat.slug);
    setFormIcon(cat.icon);
    setFormIsEvent(cat.isEvent);
    setFormDialogOpen(true);
  };

  const startCreate = () => {
    resetForm();
    setFormDialogOpen(true);
  };

  const closeFormDialog = (open: boolean) => {
    setFormDialogOpen(open);
    if (!open) resetForm();
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const maxOrder = Math.max(0, ...(categories || []).map((c) => c.displayOrder));
      const res = await apiRequest("POST", "/api/categories", {
        name: formName,
        slug: formSlug.toUpperCase().replace(/\s+/g, "_"),
        icon: formIcon,
        isEvent: formIsEvent,
        displayOrder: maxOrder + 1,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: "Category created" });
      setFormDialogOpen(false);
      resetForm();
      onClose?.();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", `/api/categories/${editingId}`, {
        name: formName,
        slug: formSlug.toUpperCase().replace(/\s+/g, "_"),
        icon: formIcon,
        isEvent: formIsEvent,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: "Category updated" });
      setFormDialogOpen(false);
      resetForm();
      onClose?.();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: "Category deleted" });
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    if (editingId) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    setFormName(name);
    if (!editingId) {
      setFormSlug(name.toUpperCase().replace(/\s+/g, "_"));
    }
  };

  const SelectedIcon = iconMap[formIcon] || Heart;

  return (
    <div className="space-y-6">
      {/* Existing categories list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Current Categories</h3>
          <Button
            size="sm"
            className="bg-[#d14633] hover:bg-[#197991] text-white"
            onClick={startCreate}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Category
          </Button>
        </div>
        {(categories || []).map((cat) => {
          const CatIcon = iconMap[cat.icon] || Heart;
          return (
            <div
              key={cat.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-white hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                  <CatIcon className="w-4 h-4 text-gray-600" />
                </div>
                <div>
                  <span className="font-medium text-sm">{cat.name}</span>
                  <span className="text-xs text-gray-400 ml-2">({cat.slug})</span>
                  {cat.isEvent && (
                    <span className="ml-2 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                      Event
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => startEdit(cat)}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                  onClick={() => setDeleteTarget(cat)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit form dialog */}
      <Dialog open={formDialogOpen} onOpenChange={closeFormDialog}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Category" : "Add New Category"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cat-name" className="text-xs">Name</Label>
                <Input
                  id="cat-name"
                  placeholder="e.g. Transportation"
                  value={formName}
                  onChange={(e) => handleNameChange(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cat-slug" className="text-xs">Slug (stored value)</Label>
                <Input
                  id="cat-slug"
                  placeholder="e.g. TRANSPORTATION"
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Icon</Label>
                <Select value={formIcon} onValueChange={setFormIcon}>
                  <SelectTrigger>
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        <SelectedIcon className="w-4 h-4" />
                        <span>{formIcon}</span>
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {availableIcons.map(({ name, Icon }) => (
                      <SelectItem key={name} value={name}>
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          <span>{name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end pb-2">
                <div className="flex items-center gap-2">
                  <Switch
                    id="is-event"
                    checked={formIsEvent}
                    onCheckedChange={setFormIsEvent}
                  />
                  <Label htmlFor="is-event" className="text-xs">
                    Event category (shows event fields)
                  </Label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => closeFormDialog(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-[#d14633] hover:bg-[#197991] text-white"
                disabled={!formName.trim() || createMutation.isPending || updateMutation.isPending}
              >
                {editingId
                  ? updateMutation.isPending
                    ? "Saving..."
                    : "Save Changes"
                  : createMutation.isPending
                    ? "Adding..."
                    : "Add Category"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "<strong>{deleteTarget?.name}</strong>"?
              Needs already assigned this category will keep their current category value.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
