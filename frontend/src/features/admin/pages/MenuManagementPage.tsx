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
    <div className="flex flex-col bg-gray-50 dark:bg-gray-950">
      <MenuHeader onToggleCategories={() => setShowCategories((v) => !v)} />

      <div className="flex gap-5">
        {/* Category panel — desktop sidebar / mobile drawer */}
        <MenuCategoryPanel
          mobileOpen={showCategories}
          onMobileClose={() => setShowCategories(false)}
        />

        {/* Divider — desktop only */}
        <div className="hidden lg:block w-px bg-gray-100 dark:bg-gray-800 flex-shrink-0" />

        {/* Main content — grows naturally, no overflow clipping */}
        <div className="flex-1 flex flex-col min-w-0 pb-6">
          <MenuFilterBar />
          <MenuGrid />
        </div>
      </div>
    </div>
  );
}