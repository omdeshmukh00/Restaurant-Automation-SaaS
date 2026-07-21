// src/features/superAdmin/components/Analytics/RestaurantLeaderboard.tsx
import React, { useMemo, useState } from "react";
import { Trophy, Search, ArrowUpDown } from "lucide-react";

interface LeaderboardEntry {
  restaurantId: string;
  restaurantName: string;
  totalReservations: number;
  successRate: number;
  avgWaitMinutes: number;
  totalQueueEntries: number;
  queueConversionRate: number;
}

interface RestaurantLeaderboardProps {
  darkMode: boolean;
  data: LeaderboardEntry[];
}

type SortKey = "totalReservations" | "successRate" | "avgWaitMinutes" | "totalQueueEntries" | "queueConversionRate";

export default function RestaurantLeaderboard({ darkMode, data }: RestaurantLeaderboardProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("totalReservations");
  const [sortAsc, setSortAsc] = useState(false);

  const filtered = useMemo(() => {
    let list = data.filter((r) =>
      r.restaurantName.toLowerCase().includes(search.toLowerCase())
    );
    list = [...list].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return list;
  }, [data, search, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const thClass = `text-[10px] font-semibold uppercase tracking-wider cursor-pointer select-none transition-colors ${
    darkMode ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"
  }`;

  const rankBadge = (i: number) => {
    if (i === 0) return "🥇";
    if (i === 1) return "🥈";
    if (i === 2) return "🥉";
    return `${i + 1}`;
  };

  return (
    <div
      className={`rounded-xl border p-5 transition-colors duration-200 ${
        darkMode
          ? "bg-slate-900/60 border-slate-800"
          : "bg-white border-slate-200 shadow-sm"
      }`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              darkMode ? "bg-amber-500/10 text-amber-400" : "bg-amber-50 text-amber-600"
            }`}
          >
            <Trophy size={15} />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Restaurant Leaderboard</h3>
            <p className={`text-[10px] ${darkMode ? "text-slate-500" : "text-slate-400"}`}>
              Ranked by reservation & queue performance
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            size={13}
            className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${
              darkMode ? "text-slate-500" : "text-slate-400"
            }`}
          />
          <input
            type="text"
            placeholder="Search restaurants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`pl-8 pr-3 py-1.5 rounded-lg text-xs border focus:outline-none focus:ring-2 focus:ring-orange-500 w-full sm:w-52 transition-colors ${
              darkMode
                ? "bg-slate-800 border-slate-700 text-slate-200 placeholder-slate-500"
                : "bg-white border-slate-200 text-slate-700 placeholder-slate-400"
            }`}
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className={`border-b ${darkMode ? "border-slate-800" : "border-slate-100"}`}>
              <th className={`${thClass} py-2 pr-2 w-10`}>#</th>
              <th className={`${thClass} py-2 pr-4`}>Restaurant</th>
              <th className={`${thClass} py-2 pr-4 text-right`} onClick={() => toggleSort("totalReservations")}>
                <span className="inline-flex items-center gap-1">
                  Reservations <ArrowUpDown size={10} />
                </span>
              </th>
              <th className={`${thClass} py-2 pr-4 text-right`} onClick={() => toggleSort("successRate")}>
                <span className="inline-flex items-center gap-1">
                  Success % <ArrowUpDown size={10} />
                </span>
              </th>
              <th className={`${thClass} py-2 pr-4 text-right`} onClick={() => toggleSort("totalQueueEntries")}>
                <span className="inline-flex items-center gap-1">
                  Queue <ArrowUpDown size={10} />
                </span>
              </th>
              <th className={`${thClass} py-2 pr-4 text-right`} onClick={() => toggleSort("queueConversionRate")}>
                <span className="inline-flex items-center gap-1">
                  Conv. % <ArrowUpDown size={10} />
                </span>
              </th>
              <th className={`${thClass} py-2 text-right`} onClick={() => toggleSort("avgWaitMinutes")}>
                <span className="inline-flex items-center gap-1">
                  Avg Wait <ArrowUpDown size={10} />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className={`text-center py-8 text-sm ${darkMode ? "text-slate-600" : "text-slate-400"}`}>
                  No restaurants found.
                </td>
              </tr>
            )}
            {filtered.map((entry, i) => (
              <tr
                key={entry.restaurantId}
                className={`border-b transition-colors ${
                  darkMode
                    ? "border-slate-800/50 hover:bg-slate-800/40"
                    : "border-slate-50 hover:bg-slate-50"
                }`}
              >
                <td className="py-2.5 pr-2 text-sm">{rankBadge(i)}</td>
                <td className="py-2.5 pr-4">
                  <span className="text-xs font-semibold">{entry.restaurantName}</span>
                </td>
                <td className="py-2.5 pr-4 text-right text-xs font-medium">
                  {entry.totalReservations.toLocaleString()}
                </td>
                <td className="py-2.5 pr-4 text-right">
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      entry.successRate >= 80
                        ? darkMode
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-emerald-50 text-emerald-600"
                        : entry.successRate >= 50
                        ? darkMode
                          ? "bg-amber-500/10 text-amber-400"
                          : "bg-amber-50 text-amber-600"
                        : darkMode
                        ? "bg-red-500/10 text-red-400"
                        : "bg-red-50 text-red-600"
                    }`}
                  >
                    {entry.successRate}%
                  </span>
                </td>
                <td className="py-2.5 pr-4 text-right text-xs font-medium">
                  {entry.totalQueueEntries.toLocaleString()}
                </td>
                <td className="py-2.5 pr-4 text-right">
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      entry.queueConversionRate >= 80
                        ? darkMode
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-emerald-50 text-emerald-600"
                        : entry.queueConversionRate >= 50
                        ? darkMode
                          ? "bg-amber-500/10 text-amber-400"
                          : "bg-amber-50 text-amber-600"
                        : darkMode
                        ? "bg-red-500/10 text-red-400"
                        : "bg-red-50 text-red-600"
                    }`}
                  >
                    {entry.queueConversionRate}%
                  </span>
                </td>
                <td className="py-2.5 text-right text-xs font-medium">
                  {entry.avgWaitMinutes} min
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
