import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode } from 'lucide-react';
import { apiClient } from '../../../shared/services/apiClient';
import { landingCache } from '../../../shared/utils/landingCache';
import QRScannerModal from '../components/dashboard/QRScannerModal';
import {
  LandingNavbar,
  HeroSection,
  LiveAvailabilityStrip,
  CuisineExplorer,
  TrendingRestaurants,
  TrendingDishes,
  OffersDeals,
  DigitalDiningJourney,
  WhyChooseSection,
  BlogSection,
  TestimonialsSection,
  LandingFooter
} from '../components/landing';
import '../components/landing/landing.css';

export default function LandingPage() {
  const navigate = useNavigate();
  const [scannerOpen, setScannerOpen] = useState(false);
  const cachedData = landingCache.getLandingData();
  const [landingData, setLandingData] = useState<{
    restaurants?: any[];
    dishes?: any[];
    offers?: any[];
    stats?: any;
    cuisines?: string[];
  }>(cachedData || {});
  const [selectedCuisine, setSelectedCuisine] = useState<string>('All');
  const [isLoading, setIsLoading] = useState(!cachedData);

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

  useEffect(() => {
    let active = true;
    const cached = landingCache.getLandingData();
    if (cached) {
      setLandingData(cached);
      setIsLoading(false);
    }
    const fetchData = async () => {
      try {
        if (!cached) {
          setIsLoading(true);
        }
        const response = await apiClient.get('/public/landing/data');
        if (active && (response.data?.success || response.data?.status === 'success') && response.data?.data) {
          setLandingData(response.data.data);
          landingCache.setLandingData(response.data.data);
        }
      } catch (err) {
        console.error('Failed to fetch landing page data', err);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    fetchData();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="landing-page-container min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-800 dark:text-neutral-100 transition-colors duration-300 font-sans relative overflow-hidden">
      <LandingNavbar onLoginOpen={openLogin} />
      
      <HeroSection onLoginOpen={openLogin} restaurants={landingData.restaurants} />
      
      <LiveAvailabilityStrip stats={landingData.stats} />
      
      <div className="bg-white dark:bg-neutral-900 transition-colors duration-300">
        <CuisineExplorer
          cuisines={landingData.cuisines}
          activeCuisine={selectedCuisine}
          onCuisineSelect={setSelectedCuisine}
        />
      </div>

      <div className="bg-white dark:bg-neutral-900 transition-colors duration-300">
        <TrendingRestaurants
          onLoginOpen={openLogin}
          restaurants={landingData.restaurants}
          selectedCuisine={selectedCuisine}
          isLoading={isLoading}
        />
      </div>

      <TrendingDishes onLoginOpen={openLogin} dishes={landingData.dishes} isLoading={isLoading} />
      
      <OffersDeals offers={landingData.offers} />
      
      <div className="bg-white dark:bg-neutral-900 transition-colors duration-300">
        <DigitalDiningJourney />
      </div>
      
      <WhyChooseSection />
      
      <div className="bg-white dark:bg-neutral-900 transition-colors duration-300">
        <BlogSection />
      </div>
      
      <TestimonialsSection />
      
      <LandingFooter />

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
      <QRScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={(cleanId) => {
          setScannerOpen(false);
          navigate(`/customer/home?qr_token=${cleanId}`);
        }}
      />
    </div>
  );
}
