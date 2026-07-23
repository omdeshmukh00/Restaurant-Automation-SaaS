import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Check, Tag, Sparkles, Clock, Percent } from 'lucide-react';
import '../components/landing/landing.css';
import { LandingNavbar, LandingFooter } from '../components/landing';

import { landingCache } from '../../../shared/utils/landingCache';

// Module-level constant — called once at module load, not during render.
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const NEW_CUTOFF = Date.now() - SEVEN_DAYS_MS;

interface ApiOffer {
  _id: string;
  title: string;
  description?: string;
  promoCode: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  minOrderAmount?: number | null;
  maxDiscount?: number | null;
  startDate: string;
  expiryDate: string;
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
  displayPriority: number;
  image?: string;
}

const CATEGORIES = ['All', 'Food', 'Beverages', 'New', 'Limited Time'];

export default function OffersPage() {
  const [offers, setOffers] = useState<ApiOffer[]>(() => {
    const cached = landingCache.getOffers();
    return cached || [];
  });
  const [loading, setLoading] = useState(() => {
    const cached = landingCache.getOffers();
    return !cached || cached.length === 0;
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const navigate = useNavigate();

  useEffect(() => {
    const cached = landingCache.getOffers();
    let active = true;

    const fetchOffers = async () => {
      try {
        if (!cached || cached.length === 0) {
          setLoading(true);
        }
        const { apiClient } = await import('../../../shared/services/apiClient');
        const res = await apiClient.get('/public/landing/data');
        if (active && res.data?.data?.offers) {
          const freshOffers = res.data.data.offers;
          setOffers(freshOffers);
          landingCache.setOffers(freshOffers);
        }
      } catch {
        if (active && (!cached || cached.length === 0)) {
          setOffers([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    fetchOffers();

    return () => {
      active = false;
    };
  }, []);

  const filteredOffers = activeCategory === 'All' ? offers : offers.filter(o => {
    if (activeCategory === 'Limited Time') return o.status === 'ACTIVE';
    if (activeCategory === 'Food') return o.discountType === 'PERCENTAGE';
    if (activeCategory === 'Beverages') return o.title?.toLowerCase().includes('drink') || o.title?.toLowerCase().includes('beverage');
    if (activeCategory === 'New') return new Date(o.startDate) > new Date(NEW_CUTOFF);
    return true;
  });

  const handleCopy = async (id: string, code: string) => {
    try { await navigator.clipboard.writeText(code); } catch { /* */ }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatValidity = (start: string, expiry: string): string => {
    const end = new Date(expiry);
    return `Valid till ${end.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  };

  const openLogin = () => navigate('/auth/customer');

  return (
    <div className="min-h-screen landing-font-inter flex flex-col justify-between bg-[#FFF8F3] dark:bg-neutral-950 text-slate-800 dark:text-neutral-100 transition-colors duration-300">
      <LandingNavbar onLoginOpen={openLogin} />
      
      <div className="h-[72px] shrink-0" />

      {/* Hero section */}
      <section className="relative py-8 sm:py-10 overflow-hidden bg-gradient-to-br from-[#FFF5EC] via-[#FFF0E2] to-[#FFE8D6] dark:from-[#121214] dark:via-[#18181B] dark:to-[#09090B] transition-colors duration-300">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[
            { emoji: '🍕', top: '10%', left: '4%', size: 44, rotate: -15, delay: 0 },
            { emoji: '🍔', top: '50%', left: '3%', size: 40, rotate: 8, delay: 0.8 },
            { emoji: '☕', bottom: '15%', left: '8%', size: 36, rotate: -10, delay: 1.8 },
            { emoji: '🎁', top: '12%', left: '22%', size: 38, rotate: -8, delay: 0.3 },
            { emoji: '🍽️', top: '50%', right: '4%', size: 42, rotate: 12, delay: 1.2 },
            { emoji: '🍴', top: '12%', right: '8%', size: 38, rotate: 20, delay: 0.5 },
            { emoji: '🧁', bottom: '15%', right: '10%', size: 36, rotate: -20, delay: 1.5 },
            { emoji: '🏷️', top: '15%', right: '22%', size: 36, rotate: -8, delay: 0.3 },
            { emoji: '💰', bottom: '25%', left: '25%', size: 34, rotate: 10, delay: 1.1 },
            { emoji: '🎉', bottom: '25%', right: '25%', size: 36, rotate: -12, delay: 1.4 },
          ].map((item, i) => (
            <div
              key={i}
              className="absolute select-none landing-bg-particle"
              style={{
                top: item.top, left: item.left, right: (item as any).right, bottom: (item as any).bottom,
                fontSize: `${item.size}px`,
                transform: `rotate(${item.rotate}deg)`,
                opacity: 0.15,
                animationDelay: `${item.delay}s`,
              }}
            >{item.emoji}</div>
          ))}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] rounded-full landing-glow-orb" style={{ background: 'radial-gradient(circle, rgba(255,107,26,0.12) 0%, transparent 70%)' }} />
        </div>

        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 mb-3" style={{ background: 'linear-gradient(135deg, rgba(255,107,26,0.15), rgba(255,107,26,0.06))', borderRadius: '999px', border: '1px solid rgba(255,107,26,0.25)' }}>
            <Sparkles className="w-[14px] h-[14px]" style={{ color: '#FF6B1A' }} />
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#FF6B1A' }}>Exclusive Deals</span>
          </div>
          <h1 className="text-[28px] sm:text-[36px] lg:text-[42px] font-bold landing-font-hero leading-[1.1] text-slate-900 dark:text-white">
            Offers & <span className="italic text-[#FF6B1A]">Deals</span>
          </h1>
          <p className="text-[14px] sm:text-[15px] mt-2 max-w-[500px] mx-auto text-slate-600 dark:text-neutral-400">
            Save more with our exclusive restaurant deals and discount codes
          </p>

          <div className="flex items-center justify-center gap-6 sm:gap-10 mt-5">
            {[
              { value: loading ? '...' : `${offers.length}+`, label: 'Active Offers' },
              { value: '40%', label: 'Max Savings' },
              { value: '100+', label: 'Restaurants' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-[20px] sm:text-[24px] font-bold" style={{ color: '#FF6B1A' }}>{stat.value}</div>
                <div className="text-[11px] uppercase tracking-wider mt-0.5 text-slate-500 dark:text-neutral-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Category Tabs ────────────────────────────── */}
      <div className="sticky top-[64px] z-40 bg-[#FFF8F3]/95 dark:bg-neutral-950/95 backdrop-blur-md border-b border-slate-200 dark:border-neutral-800 transition-colors duration-300">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-3 flex items-center gap-2.5 overflow-x-auto landing-hide-scrollbar">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className="whitespace-nowrap px-4 py-2 text-[13px] font-semibold shrink-0 transition-all duration-150 rounded-full border bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-850 text-slate-600 dark:text-neutral-300 hover:border-[#FF6B1A] dark:hover:border-[#FF6B1A]"
                style={isActive ? {
                  borderColor: '#FF6B1A',
                  backgroundColor: '#FF6B1A',
                  color: '#FFFFFF',
                  boxShadow: '0 2px 12px rgba(255,107,26,0.3)',
                } : undefined}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Offers Grid ──────────────────────────────── */}
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOffers.map((offer) => (
            <div
              key={offer._id}
              className="landing-card-hover landing-shiny overflow-hidden"
              style={{ borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}
            >
              <div className="relative overflow-hidden flex" style={{ background: 'linear-gradient(135deg, #1A1008 0%, #2D1F10 100%)', minHeight: '190px' }}>
                <div className="flex-1 p-5 flex flex-col justify-between relative z-10">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Tag className="w-[13px] h-[13px] text-white opacity-60" />
                    </div>
                    <h3 className="text-[20px] sm:text-[24px] font-bold text-white leading-tight">
                      {offer.discountType === 'PERCENTAGE' ? `FLAT ${offer.discountValue}% OFF` : `₹${offer.discountValue} OFF`}
                    </h3>
                    <p className="text-[12px] text-white opacity-50 mt-1">
                      {offer.description || (offer.minOrderAmount ? `On orders above ₹${offer.minOrderAmount}` : 'Limited time offer')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 mt-4">
                    <button
                      onClick={() => handleCopy(offer._id, offer.promoCode)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold transition-all duration-150"
                      style={{ borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.08)', color: '#FFFFFF' }}
                    >
                      {copiedId === offer._id ? (
                        <><Check className="w-[12px] h-[12px]" style={{ color: '#4CAF50' }} /><span style={{ color: '#4CAF50' }}>Copied!</span></>
                      ) : (
                        <><span className="tracking-widest opacity-60" style={{ fontSize: '10px' }}>Code:</span><span className="tracking-widest">{offer.promoCode}</span><Copy className="w-[12px] h-[12px] opacity-60" /></>
                      )}
                    </button>
                  </div>
                </div>
                <div className="w-[130px] sm:w-[150px] shrink-0 relative">
                  {offer.image ? (
                    <img src={offer.image} alt="offer" className="absolute inset-0 w-full h-full object-cover" loading="lazy" style={{ maskImage: 'linear-gradient(to right, transparent 0%, black 30%)', WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 30%)' }} />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Percent className="w-16 h-16 text-white/10" />
                    </div>
                  )}
                </div>
              </div>
              <div className="px-5 py-3 flex items-center justify-between" style={{ background: 'rgba(0,0,0,0.9)' }}>
                <span className="flex items-center gap-1.5 text-[12px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  <Clock className="w-[12px] h-[12px]" /> {formatValidity(offer.startDate, offer.expiryDate)}
                </span>
                <span className="text-[12px] font-semibold" style={{ color: '#FF6B1A' }}>Apply Now →</span>
              </div>
            </div>
          ))}
        </div>

        {!loading && filteredOffers.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-orange-400" />
            </div>
            <p className="text-[18px] font-semibold">No active offers right now</p>
            <p className="text-[14px] mt-2" style={{ color: '#666666' }}>Check back later for exciting deals!</p>
          </div>
        )}

        {loading && (
          <div className="text-center py-20">
            <div className="w-10 h-10 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-500">Loading offers...</p>
          </div>
        )}
      </div>

      <LandingFooter />
    </div>
  );
}
