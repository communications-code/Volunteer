import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { CalendarDays, ChevronLeft, FileEdit, LayoutDashboard } from "lucide-react";

import { Need } from "@shared/schema";
import EditNeedForm from "@/components/admin/edit-need-form";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AdminShell } from "@/components/layout/admin-shell";
import { InsetGroup } from "@/components/layout/inset-group";

export default function EditNeedPage() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const needId = Number(id);

  const { data: needs, isLoading } = useQuery<Need[]>({
    queryKey: ["/api/needs"],
  });

  const need = needs?.find((item) => item.id === needId);

  const sidebar = (
    <div className="space-y-2">
      <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/admin")}>
        <LayoutDashboard className="h-4 w-4" />
        Dashboard
      </Button>
      <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/admin/calendar")}>
        <CalendarDays className="h-4 w-4" />
        Calendar
      </Button>
    </div>
  );

  if (isLoading) {
    return (
      <AdminShell title="Edit Need" subtitle="Loading need details" sidebar={sidebar}>
        <Skeleton className="h-[640px] rounded-[1.5rem]" />
      </AdminShell>
    );
  }

  if (!need) {
    return (
      <AdminShell title="Edit Need" subtitle="This need no longer exists." sidebar={sidebar}>
        <InsetGroup className="p-8 text-center">
          <h2 className="text-2xl font-semibold text-slate-900">Need Not Found</h2>
          <p className="mt-2 text-sm text-slate-500">This need no longer exists.</p>
        </InsetGroup>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="Edit Need"
      subtitle={need.title}
      sidebar={sidebar}
      topActions={
        <Button variant="outline" onClick={() => navigate("/admin")}>
          <ChevronLeft className="h-4 w-4" />
          Dashboard
        </Button>
      }
    >
      <InsetGroup className="p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <FileEdit className="h-5 w-5 text-slate-700" />
          <h2 className="text-lg font-semibold text-slate-900">Need Details</h2>
        </div>
        <EditNeedForm
          need={need}
          variant="page"
          onClose={() => navigate("/admin")}
          onPublishSuccess={() => navigate("/")}
        />
      </InsetGroup>
    </AdminShell>
  );
}
