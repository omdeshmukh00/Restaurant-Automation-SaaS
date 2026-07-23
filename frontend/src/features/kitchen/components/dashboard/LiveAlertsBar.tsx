import React, { useEffect, useState } from 'react';
import { getAlerts } from '../../api/kitchen.api';

interface Props {
  sidebarCollapsed: boolean;
}

export default function LiveAlertsBar({ sidebarCollapsed }: Props) {
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const data = await getAlerts();
        setAlerts(data);
      } catch (e) {
        console.error('Failed to fetch live alerts', e);
      }
    };
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000); // Polling every 30s
    return () => clearInterval(interval);
  }, []);

  if (alerts.length === 0) return null;

  return (
    <footer
      className={`hidden lg:flex fixed bottom-0 right-0 bg-white border-t border-slate-200 h-14 items-center px-8 z-50 overflow-hidden transition-all duration-300 ${
        sidebarCollapsed ? 'left-[72px]' : 'left-64'
      }`}
    >
      <div className="flex items-center gap-2 text-red-500 font-bold text-xs uppercase tracking-widest mr-12 whitespace-nowrap font-sans">
        <span className="animate-pulse">📢</span>
        LIVE ALERTS
      </div>
      <div className="flex-1 flex gap-12 overflow-x-auto scrollbar-none items-center">
        {alerts.map((alert) => (
          <div key={alert._id || alert.id} className="flex items-center gap-3 whitespace-nowrap">
            <span className="text-lg">⚠️</span>
            <span className="text-[11px] font-medium text-slate-700 font-sans">{alert.message}</span>
            <span className="text-[10px] text-slate-400 font-bold font-sans">
              {alert.createdAt ? new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
            </span>
          </div>
        ))}
      </div>
      <button className="ml-8 text-red-500 font-bold text-[11px] whitespace-nowrap hover:underline font-sans">
        View All Alerts
      </button>
    </footer>
  );
}

