import { useStats } from "@/hooks/use-stats";
import { useCategories } from "@/hooks/use-categories";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart, AlertCircle, CheckCircle, Users, Loader2, HandHeart, Clock, UserCheck, Shield } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { formatDateInNewYork } from "@/lib/utils";

const COLORS = ["#197991", "#d14633", "#2d8659", "#8b5cf6", "#e67e22", "#3b82f6", "#ec4899"];

const GOV_ASSISTANCE_LABELS: Record<string, string> = {
  medicaid: "Medicaid",
  medicare: "Medicare",
  socialSecurity: "Social Security",
  snap: "SNAP",
  disability: "Disability",
  unknown: "Unknown",
};

export function DashboardStats() {
  const { data: stats, isLoading, error } = useStats();
  const { data: dbCategories } = useCategories();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#197991]" />
        <span className="ml-2 text-sm text-gray-500">Loading dashboard stats...</span>
      </div>
    );
  }

  if (error || !stats) {
    return null; // Silently fail — dashboard tabs still work
  }

  // Map category slugs to display names
  const catNameMap: Record<string, string> = {};
  if (dbCategories) {
    for (const c of dbCategories) {
      catNameMap[c.slug] = c.name;
    }
  }

  const chartData = stats.needsByCategory.map((item) => ({
    name: catNameMap[item.category] || item.category,
    count: item.count,
  }));

  const fulfillmentPct = stats.totalProjects > 0
    ? Math.round((stats.fulfilledNeeds / stats.totalProjects) * 100)
    : 0;

  return (
    <div className="space-y-6 mb-8">
      {/* Top row: Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Projects"
          value={stats.totalProjects}
          icon={<Heart className="h-5 w-5 text-[#197991]" />}
          accent="bg-teal-50 border-teal-200"
        />
        <StatCard
          title="Open Needs"
          value={stats.openNeeds}
          icon={<AlertCircle className="h-5 w-5 text-red-500" />}
          accent="bg-red-50 border-red-200"
        />
        <StatCard
          title="Projects Fulfilled"
          value={stats.fulfilledNeeds}
          icon={<CheckCircle className="h-5 w-5 text-green-600" />}
          accent="bg-green-50 border-green-200"
        />
        <StatCard
          title="People Helped"
          value={stats.totalPledges}
          subtitle={`${stats.uniqueDonors} unique donor${stats.uniqueDonors !== 1 ? 's' : ''}`}
          icon={<Users className="h-5 w-5 text-purple-600" />}
          accent="bg-purple-50 border-purple-200"
        />
      </div>

      {/* Middle row: Chart + Demographics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Needs by Category */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Needs by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: number) => [value, "Needs"]}
                      contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={24}>
                      {chartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">No published needs yet</p>
            )}
          </CardContent>
        </Card>

        {/* Right: Demographics */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Recipient Demographics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <MiniStat label="Widows Served" value={stats.demographics.widows} icon={<HandHeart className="h-4 w-4 text-rose-500" />} />
              <MiniStat label="Single Parents" value={stats.demographics.singleParents} icon={<UserCheck className="h-4 w-4 text-amber-600" />} />
            </div>

            {/* Government Assistance */}
            {Object.values(stats.demographics.govAssistance).some(v => v > 0) && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2 flex items-center">
                  <Shield className="h-3.5 w-3.5 mr-1" /> Government Assistance
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(stats.demographics.govAssistance)
                    .filter(([, count]) => count > 0)
                    .map(([key, count]) => (
                    <span
                      key={key}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700"
                    >
                      {GOV_ASSISTANCE_LABELS[key] || key}: {count}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Age distribution */}
            {Object.values(stats.demographics.ageRanges).some(v => v > 0 && v !== stats.demographics.ageRanges.unknown) && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">Age Distribution</p>
                <div className="flex flex-wrap gap-2">
                  {stats.demographics.ageRanges.under18 > 0 && (
                    <AgePill label="Under 18" count={stats.demographics.ageRanges.under18} />
                  )}
                  {stats.demographics.ageRanges['18-34'] > 0 && (
                    <AgePill label="18–34" count={stats.demographics.ageRanges['18-34']} />
                  )}
                  {stats.demographics.ageRanges['35-54'] > 0 && (
                    <AgePill label="35–54" count={stats.demographics.ageRanges['35-54']} />
                  )}
                  {stats.demographics.ageRanges['55-64'] > 0 && (
                    <AgePill label="55–64" count={stats.demographics.ageRanges['55-64']} />
                  )}
                  {stats.demographics.ageRanges['65plus'] > 0 && (
                    <AgePill label="65+" count={stats.demographics.ageRanges['65plus']} />
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom row: Fulfillment progress + Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Fulfillment progress */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Fulfillment Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold text-[#197991]">{fulfillmentPct}%</span>
              <span className="text-xs text-slate-500">
                {stats.fulfilledNeeds} of {stats.totalProjects} projects fulfilled
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-[#197991] to-[#2d8659] h-3 rounded-full transition-all duration-700"
                style={{ width: `${fulfillmentPct}%` }}
              />
            </div>
            <div className="flex justify-between mt-3 text-xs text-slate-500">
              <span className="flex items-center">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400 mr-1.5" />
                Open: {stats.openNeeds}
              </span>
              <span className="flex items-center">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 mr-1.5" />
                Pledged: {stats.pledgedNeeds}
              </span>
              <span className="flex items-center">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 mr-1.5" />
                Fulfilled: {stats.fulfilledNeeds}
              </span>
              <span className="flex items-center">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-700 mr-1.5" />
                Unfulfilled: {stats.unfulfilledNeeds}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentPledges.length > 0 ? (
              <ul className="space-y-3">
                {stats.recentPledges.map((pledge) => (
                  <li key={pledge.id} className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="h-7 w-7 rounded-full bg-purple-100 flex items-center justify-center">
                        <Users className="h-3.5 w-3.5 text-purple-600" />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-700 truncate">
                        <span className="font-medium">{pledge.name}</span>{" "}
                        pledged for <span className="font-medium">{pledge.needTitle}</span>
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatDateInNewYork(pledge.date, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                        {" · "}
                        {pledge.donationType}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400 text-center py-6">No pledges yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────

function StatCard({
  title,
  value,
  subtitle,
  icon,
  accent,
}: {
  title: string;
  value: number;
  subtitle?: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <Card className={`${accent} border`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{title}</span>
          {icon}
        </div>
        <p className="text-3xl font-bold text-slate-800">{value}</p>
        {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border p-3 bg-white">
      {icon}
      <div>
        <p className="text-lg font-bold text-slate-800">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function AgePill({ label, count }: { label: string; count: number }) {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
      {label}: {count}
    </span>
  );
}
