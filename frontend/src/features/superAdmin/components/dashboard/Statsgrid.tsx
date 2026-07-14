import { TrendingUp, TrendingDown, Utensils, IndianRupee, ShoppingBag, Percent } from "lucide-react";
import { useSuperAdminDashboardStore } from "../../store/Superadmindashboard";

interface StatsGridProps {
  darkMode: boolean;
}

export default function StatsGrid({ darkMode }: StatsGridProps) {
  const { data, loading } = useSuperAdminDashboardStore();

  if (loading || !data) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`rounded-xl p-4 sm:p-5 border animate-pulse ${
              darkMode ? "bg-slate-900/40 border-slate-800/80" : "bg-white border-slate-200/60"
            }`}
          >
            <div className="h-4 bg-slate-300 dark:bg-slate-705 w-24 rounded mb-2" />
            <div className="h-6 bg-slate-300 dark:bg-slate-705 w-16 rounded" />
          </div>
        ))}
      </div>
    );
  }

  const statItems = [
    {
      title: "Total Restaurants",
      value: data.stats.totalRestaurants,
      growth: data.stats.restaurantGrowth,
      icon: Utensils,
      lightColor: "text-emerald-600 bg-emerald-500/10",
      darkColor: "text-emerald-400 bg-emerald-500/10",
    },
    {
      title: "Monthly Revenue",
      value: `₹${data.stats.monthlyRevenue.toLocaleString()}`,
      growth: data.stats.revenueGrowth,
      icon: IndianRupee,
      lightColor: "text-amber-600 bg-amber-500/10",
      darkColor: "text-amber-400 bg-amber-500/10",
    },
    {
      title: "Total Orders",
      value: data.stats.totalOrders.toLocaleString(),
      growth: data.stats.ordersGrowth,
      icon: ShoppingBag,
      lightColor: "text-blue-600 bg-blue-500/10",
      darkColor: "text-blue-400 bg-blue-500/10",
    },
    {
      title: "Commission Earned",
      value: `₹${data.stats.commissionEarned.toLocaleString()}`,
      growth: data.stats.commissionGrowth,
      icon: Percent,
      lightColor: "text-indigo-600 bg-indigo-500/10",
      darkColor: "text-indigo-400 bg-indigo-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mb-6">
      {statItems.map((stat) => {
        const Icon = stat.icon;
        const isPositive = !stat.growth.startsWith("-");

        return (
          <div
            key={stat.title}
            className={`rounded-xl p-4 sm:p-5 border transition-all duration-200 hover:shadow-lg group ${
              darkMode
                ? "bg-slate-900/40 border-slate-800/80 hover:border-slate-700/80 hover:bg-slate-900/60"
                : "bg-white border-slate-200/60 shadow-sm hover:shadow-slate-200/60 hover:border-slate-300/60"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1 min-w-0">
                <p
                  className={`text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase truncate ${
                    darkMode ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  {stat.title}
                </p>
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight leading-none">
                  {stat.value}
                </h3>
                <div
                  className={`flex items-center gap-1 text-xs font-semibold pt-1 ${
                    isPositive ? "text-emerald-500" : "text-red-400"
                  }`}
                >
                  {isPositive ? (
                    <TrendingUp size={11} />
                  ) : (
                    <TrendingDown size={11} />
                  )}
                  <span>{stat.growth} vs last month</span>
                </div>
              </div>

              <div
                className={`h-9 w-9 sm:h-10 sm:w-10 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                  darkMode ? stat.darkColor : stat.lightColor
                }`}
              >
                <Icon size={17} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
