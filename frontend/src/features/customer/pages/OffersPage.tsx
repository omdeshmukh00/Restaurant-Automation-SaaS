import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Check, Tag, Sparkles, Clock, Percent } from 'lucide-react';
import '../components/landing/landing.css';
import { LandingNavbar, LandingFooter } from '../components/landing';

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

export default function OffersPage() {
  const [offers, setOffers] = useState<ApiOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchOffers = async () => {
      try {
        const { apiClient } = await import('../../../shared/services/apiClient');
        // Use landing/data which returns all active offers across restaurants
        const res = await apiClient.get('/public/landing/data');
        setOffers(res.data.data.offers || []);
      } catch {
        // Silently fail - offers are non-critical
        setOffers([]);
      } finally {
        setLoading(false);
      }
    };
    fetchOffers();
  }, []);

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
    <div className="min-h-screen landing-font-inter flex flex-col justify-between" style={{ background: '#FFF8F3', color: '#222222' }}>
      <LandingNavbar onLoginOpen={openLogin} />
      
      <div className="h-[72px] shrink-0" />

      {/* Hero section */}
      <section
        className="relative py-16 sm:py-20 overflow-hidden"
        style={{
          background: `linear-gradient(135deg, rgba(255,240,225,0.93) 0%, rgba(255,232,214,0.95) 100%), url('https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1400&auto=format&fit=crop')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[
            { emoji: '🎁', top: '8%', left: '5%', size: 52, rotate: -15, delay: 0 },
            { emoji: '🏷️', top: '60%', right: '6%', size: 48, rotate: 12, delay: 1 },
            { emoji: '💰', top: '20%', right: '10%', size: 44, rotate: -10, delay: 0.5 },
            { emoji: '🎉', bottom: '12%', left: '8%', size: 50, rotate: 8, delay: 1.5 },
          ].map((item, i) => (
            <div
              key={i}
              className="absolute select-none landing-stamp-float"
              style={{
                top: item.top, left: item.left, right: (item as any).right, bottom: (item as any).bottom,
                fontSize: `${item.size}px`,
                transform: `rotate(${item.rotate}deg)`,
                opacity: 0.06,
                animationDelay: `${item.delay}s`,
              }}
            >{item.emoji}</div>
          ))}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full landing-glow-orb" style={{ background: 'radial-gradient(circle, rgba(255,107,26,0.08) 0%, transparent 70%)' }} />
        </div>

        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-5" style={{ background: 'linear-gradient(135deg, rgba(255,107,26,0.15), rgba(255,107,26,0.06))', borderRadius: '999px', border: '1px solid rgba(255,107,26,0.25)' }}>
            <Sparkles className="w-[15px] h-[15px]" style={{ color: '#FF6B1A' }} />
            <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: '#FF6B1A' }}>Exclusive Deals</span>
          </div>
          <h1 className="text-[32px] sm:text-[42px] lg:text-[56px] font-bold landing-font-hero leading-[1.1]" style={{ color: '#222222' }}>
            Offers & <span className="italic" style={{ color: '#FF6B1A' }}>Deals</span>
          </h1>
          <p className="text-[15px] sm:text-[17px] mt-3 max-w-[500px] mx-auto" style={{ color: '#666666' }}>
            Save more with our exclusive restaurant deals and discount codes
          </p>

          <div className="flex items-center justify-center gap-6 sm:gap-10 mt-8">
            {[
              { value: loading ? '...' : `${offers.length}+`, label: 'Active Offers' },
              { value: '40%', label: 'Max Savings' },
              { value: '100+', label: 'Restaurants' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-[22px] sm:text-[28px] font-bold" style={{ color: '#FF6B1A' }}>{stat.value}</div>
                <div className="text-[11px] uppercase tracking-wider mt-0.5" style={{ color: '#888888' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Offers Grid */}
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {offers.map((offer) => (
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

        {!loading && offers.length === 0 && (
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
