import React, { useState, useEffect, useRef } from 'react';
import { Gift, Star, Armchair, Utensils, Timer, ClipboardCheck, QrCode } from 'lucide-react';

interface StatItem {
  value: number;
  suffix: string;
  prefix?: string;
  label: string;
  isLive?: boolean;
  icon: React.ElementType;
  accent: string;
}

function useCountUp(target: number, duration: number, trigger: boolean) {
  const [count, setCount] = useState(0);
  const isDecimal = target % 1 !== 0;

  useEffect(() => {
    if (!trigger) return;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = eased * target;
      setCount(isDecimal ? parseFloat(current.toFixed(1)) : Math.floor(current));
      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [target, duration, trigger, isDecimal]);

  return count;
}

interface LiveAvailabilityStripProps {
  stats?: {
    tablesAvailable: number;
    restaurantsOpen: number;
    reservationsToday: number;
    offersRunning: number;
    averageWaitTime: number;
    averageRating: number;
  };
}

export default function LiveAvailabilityStrip({ stats }: LiveAvailabilityStripProps) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const displayStats: StatItem[] = [
    { value: stats?.offersRunning ?? 2, suffix: '+', label: 'Offers Running', isLive: true, icon: Gift, accent: '#EC4899' },
    { value: stats?.averageRating ?? 4.8, suffix: '★', label: 'Average Rating', isLive: false, icon: Star, accent: '#EAB308' },
    { value: stats?.tablesAvailable ?? 4, suffix: '+', label: 'Tables Available Now', isLive: true, icon: Armchair, accent: '#22C55E' },
    { value: stats?.restaurantsOpen ?? 13, suffix: '', label: 'Restaurants Open', isLive: true, icon: Utensils, accent: '#F97316' },
    { value: stats?.averageWaitTime ?? 15, suffix: ' min', prefix: '~', label: 'Average Wait Time', isLive: false, icon: Timer, accent: '#3B82F6' },
    { value: stats?.reservationsToday ?? 340, suffix: '+', label: 'Reservations Today', isLive: false, icon: ClipboardCheck, accent: '#A855F7' },
  ];

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Duplicate stats for seamless continuous marquee loop
  const allStats = [...displayStats, ...displayStats];

  return (
    <section
      ref={ref}
      className="py-4 sm:py-5 landing-marquee relative overflow-hidden select-none"
      style={{
        background: 'linear-gradient(135deg, #0A0A0A 0%, #17110C 50%, #0A0A0A 100%)',
        borderTop: '1px solid rgba(255,107,26,0.15)',
        borderBottom: '1px solid rgba(255,107,26,0.15)',
      }}
    >
      <div className="landing-marquee-content flex items-center gap-4">
        {allStats.map((stat, idx) => (
          <React.Fragment key={`${stat.label}-${idx}`}>
            <StampCard stat={stat} isVisible={isVisible} delay={idx % displayStats.length} />
            {idx === displayStats.length - 1 && (
              <div className="mx-2 shrink-0">
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-xs shadow-lg shadow-orange-500/20">
                  <QrCode className="w-4 h-4" />
                  <span className="tracking-wider uppercase text-[10px]">SCAN QR</span>
                </div>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}

function StampCard({ stat, isVisible, delay }: { stat: StatItem; isVisible: boolean; delay: number }) {
  const count = useCountUp(stat.value, 1500, isVisible);
  const Icon = stat.icon;

  return (
    <div
      className="landing-stamp-float mx-2 shrink-0 flex items-center gap-3 px-4 py-3 border border-white/10 rounded-2xl bg-neutral-900/80 backdrop-blur-md shadow-sm transition-all hover:border-white/20"
      style={{
        animationDelay: `${delay * 0.3}s`,
        minWidth: '190px',
      }}
    >
      {/* Icon Container */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{
          backgroundColor: `${stat.accent}18`,
          border: `1px solid ${stat.accent}35`,
          color: stat.accent,
        }}
      >
        <Icon className="w-5 h-5" />
      </div>

      <div>
        <div className="flex items-center gap-1.5">
          {stat.isLive && (
            <span
              className="w-2 h-2 rounded-full shrink-0 animate-pulse"
              style={{ backgroundColor: stat.accent }}
            />
          )}
          <span
            className="text-base sm:text-lg font-black tracking-tight tabular-nums"
            style={{ color: stat.accent }}
          >
            {stat.prefix || ''}{count}{stat.suffix}
          </span>
        </div>
        <span className="text-[11px] font-medium text-neutral-400 block -mt-0.5 whitespace-nowrap">
          {stat.label}
        </span>
      </div>
    </div>
  );
}
