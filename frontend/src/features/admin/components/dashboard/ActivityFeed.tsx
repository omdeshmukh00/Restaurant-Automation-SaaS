import React from 'react';
import { useDashboardStore } from '../../store/dashboard.store';

export function ActivityFeed(): JSX.Element {
  const activities = useDashboardStore((s) => s.activities);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 sm:p-5 transition-colors duration-200">
      <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">Live Activity</h3>
      <div className="space-y-3">
        {activities.map((item, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className={`w-7 h-7 rounded-lg ${item.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
              <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-snug">{item.text}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{item.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}