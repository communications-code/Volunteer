import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";

import NeedDetailDialog from "@/components/needs/need-detail-dialog";
import { PublicShell } from "@/components/layout/public-shell";
import { InsetGroup } from "@/components/layout/inset-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Need } from "@shared/schema";

export default function NeedPage() {
  const { id } = useParams();

  const { data: needs, isLoading } = useQuery<Need[]>({
    queryKey: ["/api/needs"],
  });

  const need = needs?.find((n) => n.id === Number(id));

  if (isLoading) {
    return (
      <PublicShell backHref="/" backLabel="Needs" activeTab="needs" hideNavTitle>
        <Skeleton className="h-[640px] rounded-[1.5rem]" />
      </PublicShell>
    );
  }

  if (!need) {
    return (
      <PublicShell backHref="/" backLabel="Needs" activeTab="needs" hideNavTitle>
        <InsetGroup className="p-8 text-center">
          <h2 className="text-2xl font-semibold text-slate-900">Need Not Found</h2>
          <p className="mt-2 text-sm text-slate-500">The need you&apos;re looking for doesn&apos;t exist or has been removed.</p>
        </InsetGroup>
      </PublicShell>
    );
  }

  return (
    <PublicShell
      backHref="/"
      backLabel="Needs"
      activeTab="needs"
      hideNavTitle
    >
      <NeedDetailDialog need={need} variant="page" />
    </PublicShell>
  );
}
