// src/features/superAdmin/components/Analytics/ReservationQueueKPI.tsx
import React from "react";
import {
  CalendarCheck2,
  CalendarX2,
  UserX,
  Users,
  Clock,
  TrendingUp,
} from "lucide-react";

interface ReservationQueueKPIProps {
  darkMode: boolean;
  summary: {
    totalReservations: number;
    confirmedReservations: number;
    cancelledReservations: number;
    noShows: number;
    completedReservations: number;
    totalQueueEntries: number;
    seatedFromQueue: number;
    cancelledQueue: number;
    expiredQueue: number;
    avgWaitMinutes: number;
    reservationSuccessRate: number;
    queueConversionRate: number;
  };
}

export default function ReservationQueueKPI({ darkMode, summary }: ReservationQueueKPIProps) {
  const cards = [
    {
      label: "Total Reservations",
      value: summary.totalReservations.toLocaleString(),
      sub: `${summary.confirmedReservations} confirmed · ${summary.cancelledReservations} cancelled`,
      icon: CalendarCheck2,
      color: darkMode ? "bg-blue-500/10 text-blue-400" : "bg-blue-50 text-blue-600",
    },
    {
      label: "No-Show Rate",
      value: summary.totalReservations > 0
        ? `${((summary.noShows / summary.totalReservations) * 100).toFixed(1)}%`
        : "0%",
      sub: `${summary.noShows} no-shows out of ${summary.totalReservations}`,
      icon: CalendarX2,
      color: darkMode ? "bg-red-500/10 text-red-400" : "bg-red-50 text-red-600",
    },
    {
      label: "Queue Entries",
      value: summary.totalQueueEntries.toLocaleString(),
      sub: `${summary.seatedFromQueue} seated · ${summary.expiredQueue} expired`,
      icon: Users,
      color: darkMode ? "bg-purple-500/10 text-purple-400" : "bg-purple-50 text-purple-600",
    },
    {
      label: "Avg Wait Time",
      value: `${summary.avgWaitMinutes} min`,
      sub: "Average queue waiting time",
      icon: Clock,
      color: darkMode ? "bg-amber-500/10 text-amber-400" : "bg-amber-50 text-amber-600",
    },
    {
      label: "Reservation Success",
      value: `${summary.reservationSuccessRate}%`,
      sub: `${summary.completedReservations} completed reservations`,
      icon: TrendingUp,
      color: darkMode ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Queue Conversion",
      value: `${summary.queueConversionRate}%`,
      sub: `${summary.seatedFromQueue} seated from queue`,
      icon: UserX,
      color: darkMode ? "bg-orange-500/10 text-orange-400" : "bg-orange-50 text-orange-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className={`rounded-xl p-4 border transition-colors duration-200 ${
              darkMode
                ? "bg-slate-900/60 border-slate-800"
                : "bg-white border-slate-200 shadow-sm"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p
                  className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${
                    darkMode ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  {card.label}
                </p>
                <p className="text-xl font-bold tracking-tight">{card.value}</p>
                <p
                  className={`text-[11px] mt-1 ${
                    darkMode ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  {card.sub}
                </p>
              </div>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${card.color}`}>
                <Icon size={16} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
