import React, { useEffect, useState } from 'react';
import { MenuHeader } from '../components/menu/MenuHeader';
import { MenuCategoryPanel } from '../components/menu/MenuCategoryPanel';
import { MenuFilterBar } from '../components/menu/MenuFilterBar';
import { MenuGrid } from '../components/menu/MenuGrid';
import { useMenuStore } from '../store/menu.store';
import { getSocket } from '../../../lib/socket';

export function MenuManagementPage(): JSX.Element {
  const [showCategories, setShowCategories] = useState(false);
  const refresh = useMenuStore((s) => s.refresh);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    
    const handleUpdate = () => {
      void refresh();
    };

    socket.on('menu.updated', handleUpdate);
    return () => {
      socket.off('menu.updated', handleUpdate);
    };
  }, [refresh]);

  return (
    <div className="space-y-4 sm:space-y-5 animate-fadeIn">
      <MenuHeader onToggleCategories={() => setShowCategories((v) => !v)} />

      <div className="flex flex-col lg:flex-row gap-4 sm:gap-5 items-start">
        {/* Category panel — desktop sidebar / mobile drawer */}
        <MenuCategoryPanel
          mobileOpen={showCategories}
          onMobileClose={() => setShowCategories(false)}
        />

        {/* Main content — wrapped in padded, rounded card box */}
        <div className="flex-1 min-w-0 w-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 sm:p-5 lg:p-6 shadow-sm">
          <MenuFilterBar />
          <MenuGrid />
        </div>
      </div>
    </div>
  );
}