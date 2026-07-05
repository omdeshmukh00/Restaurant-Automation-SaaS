// src/features/superAdmin/components/Subscriptions/Tiercards.tsx
import React, { useRef } from "react";
import { Package, Zap, Crown, Building2, ArrowUpRight, Sparkles, Edit2, ChevronLeft, ChevronRight } from "lucide-react";

interface TierCardsProps {
  plans: any[];
  tierFilter: string;
  darkMode: boolean;
  onTierChange: (tier: string) => void;
  onEditClick: (planName: string) => void;
}

interface TierCardProps {
  tier: string;
  label: string;
  price: string;
  icon: React.ReactNode;
  accentRing: string;
  accentBg: string;
  accentText: string;
  iconBg: string;
  count: number;
  formattedRevenue: string;
  activeCount: number;
  trialCount: number;
  isActive: boolean;
  isPlanActive: boolean;
  darkMode: boolean;
  onClick: () => void;
  onEditClick: () => void;
}

function TierCard({
  label, price, icon, accentRing, accentBg, accentText, iconBg,
  count, formattedRevenue, activeCount, trialCount,
  isActive, isPlanActive, darkMode, onClick, onEditClick
}: TierCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      className={`
        cursor-pointer group relative rounded-2xl p-3 sm:p-5 border transition-all duration-200 
        hover:scale-[1.015] focus:outline-none focus:ring-2 focus:ring-orange-500/50 flex flex-col justify-between
        ${isActive ? `${accentRing} ring-2 ${accentBg}` : ""}
        ${darkMode
          ? "bg-slate-900/40 border-slate-800/80 hover:border-slate-700"
          : "bg-white border-slate-200/80 hover:shadow-lg"
        }
      `}
    >
      {/* Header row */}
      <div className="flex items-start justify-between mb-3 sm:mb-4">
        <div className={`p-2 rounded-xl sm:p-2.5 ${iconBg}`}>{icon}</div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-md border ${
            isPlanActive 
              ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' 
              : 'text-red-500 bg-red-500/10 border-red-500/20'
          }`}>
            {isPlanActive ? 'Active' : 'Inactive'}
          </span>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onEditClick();
            }}
            className={`p-1.5 rounded-lg hover:bg-slate-500/10 transition-colors ${
              darkMode ? "text-slate-500 hover:text-orange-400" : "text-slate-400 hover:text-orange-500"
            }`}
            title="Edit Plan"
          >
            <Edit2 size={12} />
          </button>
          
          <span className={`text-[9px] sm:text-[10px] font-bold flex items-center gap-0.5 transition-all duration-150 ${accentText}
            ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
            {isActive ? "Filtering" : "Filter"} <ArrowUpRight size={12} />
          </span>
        </div>
      </div>

      {/* Plan name + price */}
      <p className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
        {label}
      </p>
      <div className="flex items-baseline gap-1 mt-0.5 mb-3 sm:mt-1 sm:mb-4 flex-wrap">
        <span className={`text-xl sm:text-2xl font-black ${darkMode ? "text-white" : "text-slate-900"}`}>{price}</span>
        <span className={`text-[10px] sm:text-xs ${darkMode ? "text-slate-500" : "text-slate-400"}`}>/mo</span>
      </div>

      {/* Divider */}
      <div className={`h-px mb-2.5 sm:h-px sm:mb-3.5 ${darkMode ? "bg-slate-800" : "bg-slate-100"}`} />

      {/* Stats */}
      <div className="space-y-1 text-[10px] sm:space-y-1.5 sm:text-[11px]">
        <div className="flex justify-between">
          <span className={darkMode ? "text-slate-500" : "text-slate-400"}>Subscribers</span>
          <span className={`font-bold ${darkMode ? "text-slate-300" : "text-slate-700"}`}>{count}</span>
        </div>
        <div className="flex justify-between">
          <span className={darkMode ? "text-slate-500" : "text-slate-400"}>Revenue</span>
          <span className="font-bold text-emerald-500 truncate pl-1">{formattedRevenue}</span>
        </div>
        <div className="flex justify-between">
          <span className={darkMode ? "text-slate-500" : "text-slate-400"}>Active / Trial</span>
          <span className={`font-semibold ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
            <span className="text-emerald-500">{activeCount}</span>
            <span className={darkMode ? "text-slate-700" : "text-slate-300"}> / </span>
            <span className="text-amber-500">{trialCount}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default function TierCards({ plans, tierFilter, darkMode, onTierChange, onEditClick }: TierCardsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollAmount = direction === 'left' ? -clientWidth / 2 : clientWidth / 2;
      scrollRef.current.scrollTo({ left: scrollLeft + scrollAmount, behavior: 'smooth' });
    }
  };

  const styles = [
    { ring: "ring-orange-500",  bg: "bg-orange-500/5",  text: "text-orange-400",  iconBg: darkMode ? "bg-orange-500/10 text-orange-400" : "bg-orange-50 text-orange-600", icon: <Package size={18} /> },
    { ring: "ring-blue-500",    bg: "bg-blue-500/5",    text: "text-blue-400",    iconBg: darkMode ? "bg-blue-500/10 text-blue-400" : "bg-blue-50 text-blue-600", icon: <Zap size={18} /> },
    { ring: "ring-purple-500",  bg: "bg-purple-500/5",  text: "text-purple-400",  iconBg: darkMode ? "bg-purple-500/10 text-purple-400" : "bg-purple-50 text-purple-600", icon: <Crown size={18} /> },
    { ring: "ring-emerald-500", bg: "bg-emerald-500/5", text: "text-emerald-400", iconBg: darkMode ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50 text-emerald-600", icon: <Building2 size={18} /> },
  ];

  return (
    <div className="relative group/carousel mb-8">
      {/* Scroll Navigation Buttons */}
      <button
        onClick={() => scroll('left')}
        className={`absolute left-[-15px] top-1/2 -translate-y-1/2 z-10 p-2.5 rounded-full border shadow-lg opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-200 ${
          darkMode ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white' : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800'
        }`}
      >
        <ChevronLeft size={16} />
      </button>
      
      <button
        onClick={() => scroll('right')}
        className={`absolute right-[-15px] top-1/2 -translate-y-1/2 z-10 p-2.5 rounded-full border shadow-lg opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-200 ${
          darkMode ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white' : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800'
        }`}
      >
        <ChevronRight size={16} />
      </button>

      <div 
        ref={scrollRef}
        className="flex overflow-x-auto gap-4 scroll-smooth snap-x no-scrollbar pb-3"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {plans.map((t, index) => {
          const style = styles[index % styles.length] || styles[0];
          return (
            <div key={t.name} className="min-w-[280px] sm:min-w-[320px] flex-1 snap-start">
              <TierCard
                tier={t.name}
                label={`${t.name} Plan`}
                price={`₹${t.price}`}
                icon={style.icon}
                accentRing={style.ring}
                accentBg={style.bg}
                accentText={style.text}
                iconBg={style.iconBg}
                count={t.count}
                formattedRevenue={t.formattedRevenue}
                activeCount={t.activeCount}
                trialCount={t.trialCount}
                isActive={tierFilter === t.name}
                isPlanActive={t.isActive !== false}
                darkMode={darkMode}
                onClick={() => onTierChange(tierFilter === t.name ? "All" : t.name)}
                onEditClick={() => onEditClick(t.name)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}