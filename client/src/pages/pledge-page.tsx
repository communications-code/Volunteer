import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";

import { Need, NeedType } from "@shared/schema";
import PledgeForm from "@/components/needs/pledge-form";
import { PublicShell } from "@/components/layout/public-shell";
import { InsetGroup } from "@/components/layout/inset-group";
import { Skeleton } from "@/components/ui/skeleton";

export default function PledgePage() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const needId = Number(id);

  const { data: needs, isLoading } = useQuery<Need[]>({
    queryKey: ["/api/needs"],
  });

  const need = needs?.find((item) => item.id === needId);

  if (isLoading) {
    return (
      <PublicShell title="Respond" subtitle="Loading need details" backHref="/" backLabel="Needs" activeTab="needs">
        <Skeleton className="h-[480px] rounded-[1.5rem]" />
      </PublicShell>
    );
  }

  if (!need) {
    return (
      <PublicShell title="Respond" subtitle="This sign-up page is no longer available." backHref="/" backLabel="Needs" activeTab="needs">
        <InsetGroup className="p-8 text-center">
          <h2 className="text-2xl font-semibold text-slate-900">Need Not Found</h2>
          <p className="mt-2 text-sm text-slate-500">This sign-up page is no longer available.</p>
        </InsetGroup>
      </PublicShell>
    );
  }

  const isSignupFlow = need.needType === NeedType.EVENT || need.needType === NeedType.GROUP;

  return (
    <PublicShell
      title={isSignupFlow ? "Sign Up" : "Pledge to Help"}
      subtitle={need.title}
      backHref={`/need/${need.id}`}
      backLabel="Need"
      activeTab="needs"
      hideNavTitle
    >
      <PledgeForm need={need} onClose={() => navigate(`/need/${need.id}`)} variant="page" />
    </PublicShell>
  );
}
