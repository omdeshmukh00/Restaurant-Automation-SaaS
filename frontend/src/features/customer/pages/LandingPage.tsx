import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode } from 'lucide-react';
import { useLandingStore } from '../store/landing.store';
import {
  LandingNavbar,
  HeroSection,
  LiveAvailabilityStrip,
  CuisineExplorer,
  TrendingRestaurants,
  TrendingDishes,
} from '../components/landing';
import '../components/landing/landing.css';

// Lazy loaded below-the-fold and modal components for speed and lazy loading
const OffersDeals = lazy(() => import('../components/landing/OffersDeals'));
const DigitalDiningJourney = lazy(() => import('../components/landing/DigitalDiningJourney'));
const WhyChooseSection = lazy(() => import('../components/landing/WhyChooseSection'));
const BlogSection = lazy(() => import('../components/landing/BlogSection'));
const TestimonialsSection = lazy(() => import('../components/landing/TestimonialsSection'));
const LandingFooter = lazy(() => import('../components/landing/LandingFooter'));
const QRScannerModal = lazy(() => import('../components/dashboard/QRScannerModal'));

export default function LandingPage() {
  const navigate = useNavigate();
  const [scannerOpen, setScannerOpen] = useState(false);

  const {
    landingData,
    restaurants,
    dishes,
    offers,
    stats,
    cuisines,
    selectedCuisine,
    setSelectedCuisine,
    isLoading,
    fetchLandingData,
  } = useLandingStore();

  const openLogin = (targetPath?: string) => {
    if (targetPath) {
      navigate('/auth/customer', { state: { from: { pathname: targetPath } } });
    } else {
      navigate('/auth/customer');
    }
  };

  // Draggable states and references for desktop QR button
  const [desktopPos, setDesktopPos] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingDesktop, setIsDraggingDesktop] = useState(false);
  const desktopDragStart = useRef({ x: 0, y: 0 });
  const desktopDragOffset = useRef({ x: 0, y: 0 });
  const desktopDragDistance = useRef(0);

  // Draggable states and references for mobile QR button
  const [mobilePos, setMobilePos] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingMobile, setIsDraggingMobile] = useState(false);
  const mobileDragStart = useRef({ x: 0, y: 0 });
  const mobileDragOffset = useRef({ x: 0, y: 0 });
  const mobileDragDistance = useRef(0);

  // Initialize position on client mount
  useEffect(() => {
    setDesktopPos({
      x: window.innerWidth - 110,
      y: window.innerHeight / 2 - 60,
    });
    setMobilePos({
      x: window.innerWidth / 2 - 30,
      y: window.innerHeight - 84,
    });
  }, []);

  // Bounds check on window resize
  useEffect(() => {
    const handleResize = () => {
      setDesktopPos((prev) => {
        if (!prev) return prev;
        return {
          x: Math.max(10, Math.min(window.innerWidth - 110, prev.x)),
          y: Math.max(10, Math.min(window.innerHeight - 130, prev.y)),
        };
      });
      setMobilePos((prev) => {
        if (!prev) return prev;
        return {
          x: Math.max(10, Math.min(window.innerWidth - 70, prev.x)),
          y: Math.max(10, Math.min(window.innerHeight - 70, prev.y)),
        };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Desktop drag listeners
  const handleDesktopMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDraggingDesktop(true);
    desktopDragStart.current = { x: e.clientX, y: e.clientY };
    desktopDragOffset.current = { x: desktopPos?.x || 0, y: desktopPos?.y || 0 };
    desktopDragDistance.current = 0;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingDesktop || !desktopPos) return;
      const dx = e.clientX - desktopDragStart.current.x;
      const dy = e.clientY - desktopDragStart.current.y;
      desktopDragDistance.current = Math.sqrt(dx * dx + dy * dy);
      
      const nextX = Math.max(10, Math.min(window.innerWidth - 110, desktopDragOffset.current.x + dx));
      const nextY = Math.max(10, Math.min(window.innerHeight - 130, desktopDragOffset.current.y + dy));
      setDesktopPos({ x: nextX, y: nextY });
    };

    const handleMouseUp = () => {
      setIsDraggingDesktop(false);
    };

    if (isDraggingDesktop) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingDesktop, desktopPos]);

  // Mobile drag listeners
  const handleMobileTouchStart = (e: React.TouchEvent) => {
    setIsDraggingMobile(true);
    const touch = e.touches[0];
    mobileDragStart.current = { x: touch.clientX, y: touch.clientY };
    mobileDragOffset.current = { x: mobilePos?.x || 0, y: mobilePos?.y || 0 };
    mobileDragDistance.current = 0;
  };

  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      if (!isDraggingMobile || !mobilePos) return;
      const touch = e.touches[0];
      const dx = touch.clientX - mobileDragStart.current.x;
      const dy = touch.clientY - mobileDragStart.current.y;
      mobileDragDistance.current = Math.sqrt(dx * dx + dy * dy);
      
      const nextX = Math.max(10, Math.min(window.innerWidth - 70, mobileDragOffset.current.x + dx));
      const nextY = Math.max(10, Math.min(window.innerHeight - 70, mobileDragOffset.current.y + dy));
      setMobilePos({ x: nextX, y: nextY });
    };

    const handleTouchEnd = () => {
      setIsDraggingMobile(false);
    };

    if (isDraggingMobile) {
      window.addEventListener('touchmove', handleTouchMove, { passive: true });
      window.addEventListener('touchend', handleTouchEnd);
    }
    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDraggingMobile, mobilePos]);

  // Fetch landing data from store + background revalidation on tab return
  useEffect(() => {
    fetchLandingData();

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        // Silently revalidate in background when user returns to tab (no skeleton flicker)
        fetchLandingData(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [fetchLandingData]);

  const activeRestaurants = restaurants.length > 0 ? restaurants : landingData?.restaurants;
  const activeDishes = dishes.length > 0 ? dishes : landingData?.dishes;
  const activeOffers = offers.length > 0 ? offers : landingData?.offers;
  const activeStats = stats || landingData?.stats;
  const activeCuisines = cuisines.length > 0 ? cuisines : landingData?.cuisines;

  return (
    <div className="landing-page-container min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-800 dark:text-neutral-100 transition-colors duration-300 font-sans relative overflow-hidden">
      <LandingNavbar onLoginOpen={openLogin} />
      
      <HeroSection onLoginOpen={openLogin} restaurants={activeRestaurants} />
      
      <LiveAvailabilityStrip stats={activeStats} />
      
      <div className="bg-white dark:bg-neutral-900 transition-colors duration-300">
        <CuisineExplorer
          cuisines={activeCuisines}
          activeCuisine={selectedCuisine}
          onCuisineSelect={setSelectedCuisine}
        />
      </div>

      <div className="bg-white dark:bg-neutral-900 transition-colors duration-300">
        <TrendingRestaurants
          onLoginOpen={openLogin}
          restaurants={activeRestaurants}
          selectedCuisine={selectedCuisine}
          isLoading={isLoading}
        />
      </div>

      <TrendingDishes onLoginOpen={openLogin} dishes={activeDishes} isLoading={isLoading} />
      
      <Suspense fallback={<div className="py-12 text-center text-slate-400">Loading offers...</div>}>
        <OffersDeals offers={activeOffers} />
      </Suspense>

      <Suspense fallback={null}>
        <div className="bg-white dark:bg-neutral-900 transition-colors duration-300">
          <DigitalDiningJourney />
        </div>
      </Suspense>

      <Suspense fallback={null}>
        <WhyChooseSection />
      </Suspense>

      <Suspense fallback={null}>
        <div className="bg-white dark:bg-neutral-900 transition-colors duration-300">
          <BlogSection />
        </div>
      </Suspense>

      <Suspense fallback={null}>
        <TestimonialsSection />
      </Suspense>

      <Suspense fallback={null}>
        <LandingFooter />
      </Suspense>

      {/* Floating QR Scanner Button */}
      {/* Desktop: Draggable anywhere */}
      <div
        className="hidden lg:block fixed z-40 select-none"
        style={
          desktopPos
            ? { left: `${desktopPos.x}px`, top: `${desktopPos.y}px` }
            : { right: '24px', top: '50%', transform: 'translateY(-50%)' }
        }
      >
        <button
          onMouseDown={handleDesktopMouseDown}
          onClick={(e) => {
            if (desktopDragDistance.current > 5) {
              e.preventDefault();
              return;
            }
            setScannerOpen(true);
          }}
          className="group flex flex-col items-center gap-2 p-4 transition-all duration-300 hover:scale-105 active:scale-95 cursor-grab active:cursor-grabbing"
          style={{
            borderRadius: '20px',
            background: 'linear-gradient(135deg, rgba(15,15,15,0.85) 0%, rgba(30,20,10,0.8) 100%)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            border: '1px solid rgba(255,107,26,0.2)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.25), 0 0 20px rgba(255,107,26,0.1)',
          }}
          aria-label="Scan QR Code"
        >
          <div
            className="w-[48px] h-[48px] rounded-[14px] flex items-center justify-center transition-all duration-300 group-hover:scale-110"
            style={{
              background: 'linear-gradient(135deg, #FF6B1A 0%, #E65A0A 100%)',
              boxShadow: '0 4px 15px rgba(255,107,26,0.4)',
            }}
          >
            <QrCode className="w-[24px] h-[24px] text-white" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-white opacity-70">
            Scan QR
          </span>
        </button>
      </div>

      {/* Mobile: Draggable anywhere */}
      <div
        className="lg:hidden fixed z-40 select-none"
        style={
          mobilePos
            ? { left: `${mobilePos.x}px`, top: `${mobilePos.y}px` }
            : { bottom: '24px', left: '50%', transform: 'translateX(-50%)' }
        }
      >
        <button
          onTouchStart={handleMobileTouchStart}
          onClick={(e) => {
            if (mobileDragDistance.current > 5) {
              e.preventDefault();
              return;
            }
            setScannerOpen(true);
          }}
          className="flex items-center justify-center w-[60px] h-[60px] transition-all duration-300 cursor-grab active:cursor-grabbing"
          style={{
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(20,15,10,0.9) 0%, rgba(30,20,10,0.85) 100%)',
            backdropFilter: 'blur(24px) saturate(200%)',
            WebkitBackdropFilter: 'blur(24px) saturate(200%)',
            border: '1.5px solid rgba(255,107,26,0.3)',
            boxShadow: '0 6px 24px rgba(0,0,0,0.3), 0 0 24px rgba(255,107,26,0.15), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}
          aria-label="Scan QR Code"
        >
          <QrCode className="w-[26px] h-[26px]" style={{ color: '#FF6B1A' }} />
        </button>
      </div>

      {/* QR Code Scanner Modal */}
      {scannerOpen && (
        <Suspense fallback={null}>
          <QRScannerModal
            isOpen={scannerOpen}
            onClose={() => setScannerOpen(false)}
            onScanSuccess={(cleanId) => {
              setScannerOpen(false);
              navigate(`/customer/home?qr_token=${cleanId}`);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
