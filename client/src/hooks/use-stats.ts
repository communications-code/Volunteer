import { useQuery } from "@tanstack/react-query";

export interface DashboardStats {
  totalProjects: number;
  openNeeds: number;
  pledgedNeeds: number;
  fulfilledNeeds: number;
  unfulfilledNeeds: number;
  recurringNeeds: number;
  draftNeeds: number;
  totalPledges: number;
  uniqueDonors: number;
  demographics: {
    widows: number;
    singleParents: number;
    govAssistance: {
      medicaid: number;
      medicare: number;
      socialSecurity: number;
      snap: number;
      disability: number;
    };
    ageRanges: {
      under18: number;
      '18-34': number;
      '35-54': number;
      '55-64': number;
      '65plus': number;
      unknown: number;
    };
  };
  needsByCategory: { category: string; count: number }[];
  recentPledges: {
    id: number;
    name: string;
    needTitle: string;
    needId: number;
    donationType: string;
    date: string;
  }[];
}

export function useStats() {
  return useQuery<DashboardStats>({
    queryKey: ["/api/stats"],
    refetchInterval: 60000, // Refresh every 60 seconds
  });
}
