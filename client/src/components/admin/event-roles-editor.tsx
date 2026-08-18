import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide-react";
import { useFieldArray, useWatch, type UseFormReturn } from "react-hook-form";

export type EventRoleFormValue = {
  id?: number;
  name: string;
  slotDate?: string;
  startTime: string;
  endTime: string;
  capacity: number | null;
  displayOrder?: number;
  isActive?: boolean;
};

interface EventRolesEditorProps {
  form: UseFormReturn<any>;
  compact?: boolean;
  defaultSlotDate?: string;
}

const emptyRole = (defaultSlotDate?: string): EventRoleFormValue => ({
  name: "",
  slotDate: defaultSlotDate || "",
  startTime: "",
  endTime: "",
  capacity: 1,
  isActive: true,
});

export default function EventRolesEditor({ form, compact = false, defaultSlotDate }: EventRolesEditorProps) {
  const { fields, prepend, insert, remove, move } = useFieldArray({
    control: form.control,
    name: "eventRoles",
    keyName: "fieldKey",
  });
  const watchedRoles = useWatch({ control: form.control, name: "eventRoles" }) as EventRoleFormValue[] | undefined;

  const roleErrors = ((form.formState.errors.eventRoles ?? []) as unknown as any[]) || [];

  useEffect(() => {
    const roles = watchedRoles || [];
    if (roles.length < 2) return;

    const sorted = roles
      .map((role, index) => ({ role, index }))
      .sort((a, b) => {
        const dateCompare = (a.role.slotDate || "").localeCompare(b.role.slotDate || "");
        if (dateCompare !== 0) return dateCompare;

        const startCompare = (a.role.startTime || "").localeCompare(b.role.startTime || "");
        if (startCompare !== 0) return startCompare;

        const endCompare = (a.role.endTime || "").localeCompare(b.role.endTime || "");
        if (endCompare !== 0) return endCompare;

        return a.index - b.index;
      });

    const outOfOrderIndex = sorted.findIndex((item, targetIndex) => item.index !== targetIndex);
    if (outOfOrderIndex === -1) return;

    move(sorted[outOfOrderIndex].index, outOfOrderIndex);
  }, [move, watchedRoles]);

  const duplicateRole = (index: number) => {
    const source = form.getValues(`eventRoles.${index}`) as EventRoleFormValue | undefined;
    insert(index + 1, {
      name: source?.name || "",
      slotDate: source?.slotDate || "",
      startTime: source?.startTime || "",
      endTime: source?.endTime || "",
      capacity: source?.capacity ?? 1,
      isActive: source?.isActive ?? true,
    });
  };

  return (
    <div className="rounded-md border border-slate-200 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-slate-700">Event Role Slots</p>
          <p className="text-[11px] text-slate-500">
            Add role names, date, times, and capacity. Leave blank only if this event has open sign-up.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          onClick={() => prepend(emptyRole(defaultSlotDate))}
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Slot
        </Button>
      </div>

      <div className="space-y-2">
        {fields.length === 0 ? (
          <div className="rounded-md border border-dashed p-2.5 text-[11px] text-slate-500 bg-slate-50">
            No slots added. People can still submit a general event sign-up.
          </div>
        ) : (
          fields.map((field, index) => {
            const error = roleErrors[index] || {};
            return (
              <div key={field.fieldKey} className="rounded-md border bg-white p-2.5 space-y-2">
                <input
                  type="hidden"
                  {...form.register(`eventRoles.${index}.id`, {
                    setValueAs: (value) => {
                      if (value === "" || value === undefined || value === null) return undefined;
                      const parsed = Number(value);
                      return Number.isFinite(parsed) ? parsed : undefined;
                    },
                  })}
                />

                <div className={`grid gap-2 ${compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-5"}`}>
                  <div className={compact ? "" : "md:col-span-2"}>
                    <Label className="text-[11px]">Role Name</Label>
                    <Input
                      placeholder="Set Up Team"
                      className="h-8 text-sm"
                      {...form.register(`eventRoles.${index}.name`)}
                    />
                    {error.name?.message ? (
                      <p className="text-[11px] text-red-600 mt-1">{String(error.name.message)}</p>
                    ) : null}
                  </div>

                  <div>
                    <Label className="text-[11px]">Date</Label>
                    <Input
                      type="date"
                      className="h-8 text-sm"
                      {...form.register(`eventRoles.${index}.slotDate`)}
                    />
                    {error.slotDate?.message ? (
                      <p className="text-[11px] text-red-600 mt-1">{String(error.slotDate.message)}</p>
                    ) : null}
                  </div>

                  <div>
                    <Label className="text-[11px]">Start</Label>
                    <Input
                      type="time"
                      className="h-8 text-sm"
                      {...form.register(`eventRoles.${index}.startTime`)}
                    />
                    {error.startTime?.message ? (
                      <p className="text-[11px] text-red-600 mt-1">{String(error.startTime.message)}</p>
                    ) : null}
                  </div>

                  <div>
                    <Label className="text-[11px]">End</Label>
                    <Input
                      type="time"
                      className="h-8 text-sm"
                      {...form.register(`eventRoles.${index}.endTime`)}
                    />
                    {error.endTime?.message ? (
                      <p className="text-[11px] text-red-600 mt-1">{String(error.endTime.message)}</p>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-[11px]">Spots</Label>
                    <Input
                      type="number"
                      min="1"
                      placeholder="1"
                      className="h-8 w-24 text-sm"
                      {...form.register(`eventRoles.${index}.capacity`, {
                        setValueAs: (value) => {
                          if (value === "" || value === undefined || value === null) return 1;
                          const parsed = Number(value);
                          return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
                        },
                      })}
                    />
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => move(index, index - 1)}
                      disabled={index === 0}
                      title="Move up"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => move(index, index + 1)}
                      disabled={index === fields.length - 1}
                      title="Move down"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => duplicateRole(index)}
                      title="Duplicate slot"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-600 hover:text-red-700"
                      onClick={() => remove(index)}
                      title="Remove slot"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
