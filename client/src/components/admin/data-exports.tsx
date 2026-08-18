import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Need, Pledge } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { formatDateInNewYork, formatDateTimeInNewYork, formatTimeRangeForDisplay } from "@/lib/utils";
import { Download, FileSpreadsheet, CalendarCheck2, Users2 } from "lucide-react";

type ExportRow = Record<string, string | number | boolean | null | undefined>;
type PledgeWithEventRoles = Pledge & {
  selectedEventRoles?: Array<{
    id: number;
    name: string;
    slotDate?: string | null;
    startTime: string;
    endTime: string;
    quantity?: number;
  }>;
};

function getSelectedParticipantCount(pledge: PledgeWithEventRoles): number {
  const selectedRoles = pledge.selectedEventRoles || [];
  if (selectedRoles.length === 0) return 1;

  const participantCount = selectedRoles.reduce((maxCount, slot) => {
    const quantity = Number(slot.quantity);
    const normalizedQuantity = Number.isInteger(quantity) && quantity > 0 ? quantity : 1;
    return Math.max(maxCount, normalizedQuantity);
  }, 0);

  return participantCount > 0 ? participantCount : 1;
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  const escaped = stringValue.replace(/"/g, '""');
  return `"${escaped}"`;
}

function buildCsv(rows: ExportRow[]): string {
  if (rows.length === 0) return "";

  const headers = Object.keys(rows[0]);
  const headerLine = headers.map(csvEscape).join(",");
  const lines = rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","));
  return [headerLine, ...lines].join("\n");
}

function downloadCsv(filename: string, rows: ExportRow[]): boolean {
  const csv = buildCsv(rows);
  if (!csv) return false;

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  return true;
}

function buildFileName(prefix: string): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = `${now.getMonth() + 1}`.padStart(2, "0");
  const d = `${now.getDate()}`.padStart(2, "0");
  return `${prefix}-${y}${m}${d}.csv`;
}

export default function DataExports() {
  const { toast } = useToast();

  const { data: needs, isLoading: isLoadingNeeds } = useQuery<Need[]>({
    queryKey: ["/api/needs"],
  });

  const { data: pledgesByNeedId, isLoading: isLoadingPledges } = useQuery<Record<string, PledgeWithEventRoles[]>>({
    queryKey: ["/api/all-pledges"],
    enabled: !!needs,
  });

  const { allRows, volunteerRows, eventRows } = useMemo(() => {
    const needMap = new Map<number, Need>((needs || []).map((need) => [need.id, need]));
    const allPledges = Object.values(pledgesByNeedId || {}).flat();

      const rows = allPledges.map((pledge) => {
        const need = needMap.get(pledge.needId);
        const selectedSlots = (pledge.selectedEventRoles || [])
          .map((slot) => {
            const dateLabel = slot.slotDate
              ? `${formatDateInNewYork(slot.slotDate, {
                  month: "2-digit",
                  day: "2-digit",
                  year: "2-digit",
                })} `
              : "";
            const quantityLabel =
              typeof slot.quantity === "number" && slot.quantity > 1 ? ` x${slot.quantity}` : "";
            return `${slot.name}${quantityLabel} (${dateLabel}${formatTimeRangeForDisplay(slot.startTime, slot.endTime)})`;
          })
          .join(" | ");
        const selectedParticipantCount = getSelectedParticipantCount(pledge);
        const recordType =
          need?.needType === "GROUP"
            ? "Volunteer Sign-up"
          : need?.needType === "EVENT"
            ? "Event Sign-up"
            : "Pledge";

      return {
        "Record Type": recordType,
        "Pledge ID": pledge.id,
        "Need ID": pledge.needId,
        "Need Title": need?.title || "Unknown Need",
        "Need Category": need?.category || "",
        "Need Type": need?.needType || "",
        "Need Status": need?.status || "",
        "First Name": pledge.firstName,
        "Last Name": pledge.lastName,
        "Full Name": `${pledge.firstName} ${pledge.lastName}`.trim(),
        Email: pledge.email,
        Phone: pledge.phone || "",
        "Church / Organization": pledge.organization || "",
        "Support Type": pledge.donationType,
        "Selected Slots": selectedSlots,
        "Selected Slot Count": pledge.selectedEventRoles?.length || 0,
        "Selected Participant Count": selectedParticipantCount,
        Notes: pledge.notes || "",
        "Payment Completed": pledge.paymentCompleted ?? false,
        "Submitted (New York Time)": formatDateTimeInNewYork(pledge.createdAt, {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }),
      };
    });

    return {
      allRows: rows,
      volunteerRows: rows.filter((row) => row["Record Type"] === "Volunteer Sign-up"),
      eventRows: rows.filter((row) => row["Record Type"] === "Event Sign-up"),
    };
  }, [needs, pledgesByNeedId]);

  const isLoading = isLoadingNeeds || isLoadingPledges;

  const exportRows = (label: string, filenamePrefix: string, rows: ExportRow[]) => {
    const success = downloadCsv(buildFileName(filenamePrefix), rows);
    if (!success) {
      toast({
        title: "No data to export",
        description: `There are no ${label.toLowerCase()} available right now.`,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Export complete",
      description: `${label} CSV downloaded successfully.`,
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-[#197991]" />
            Export Records (CSV)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600">
            Download records for reporting, accounting, and follow-up. All exports use New York time for timestamps.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Button
              type="button"
              variant="outline"
              className="justify-start h-auto py-3"
              disabled={isLoading}
              onClick={() => exportRows("All Pledges", "all-pledges", allRows)}
            >
              <Download className="h-4 w-4 mr-2" />
              <div className="text-left">
                <p className="font-medium">All Pledges</p>
                <p className="text-xs text-gray-500">{allRows.length} records</p>
              </div>
            </Button>

            <Button
              type="button"
              variant="outline"
              className="justify-start h-auto py-3"
              disabled={isLoading}
              onClick={() => exportRows("Volunteer Sign-ups", "volunteer-signups", volunteerRows)}
            >
              <Users2 className="h-4 w-4 mr-2" />
              <div className="text-left">
                <p className="font-medium">Volunteer Sign-ups</p>
                <p className="text-xs text-gray-500">{volunteerRows.length} records</p>
              </div>
            </Button>

            <Button
              type="button"
              variant="outline"
              className="justify-start h-auto py-3"
              disabled={isLoading}
              onClick={() => exportRows("Event Sign-ups", "event-signups", eventRows)}
            >
              <CalendarCheck2 className="h-4 w-4 mr-2" />
              <div className="text-left">
                <p className="font-medium">Event Sign-ups</p>
                <p className="text-xs text-gray-500">{eventRows.length} records</p>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
