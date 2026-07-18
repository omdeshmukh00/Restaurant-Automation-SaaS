import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, MapPin, Calendar, Clock, Users,
  CheckCircle, Shield, Smartphone, Gift, Headphones, TrendingUp
} from 'lucide-react';
import { apiClient } from '../../../../shared/services/apiClient';

interface HeroSectionProps {
  onLoginOpen: () => void;
  restaurants?: any[];
}

const TRENDING_SEARCHES = ['Pizza', 'Buffet', 'Cafe', 'Seafood', 'Fine Dining'];
const SEARCH_TABS = ['Restaurants', 'Dishes', 'Cuisine', 'Location'] as const;

const TRUST_BADGES = [
  { icon: CheckCircle, label: 'Instant Reservations' },
  { icon: Shield, label: 'Verified Restaurants' },
  { icon: Smartphone, label: 'Digital Dining' },
  { icon: Gift, label: 'Exclusive Rewards' },
  { icon: Headphones, label: '24/7 Support' },
];

export default function HeroSection({ onLoginOpen, restaurants = [] }: HeroSectionProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<typeof SEARCH_TABS[number]>('Restaurants');
  const [searchQuery, setSearchQuery] = useState('');

  // Booking states
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('');
  
  // Date, Time, Guests arrays
  const datesList = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const yyyyMmDd = d.toISOString().split('T')[0];
    const formatted = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
    return { value: yyyyMmDd, label: formatted };
  });

  const timeSlots = [
    { value: '12:00', label: '12:00 PM' },
    { value: '12:30', label: '12:30 PM' },
    { value: '13:00', label: '01:00 PM' },
    { value: '13:30', label: '01:30 PM' },
    { value: '14:00', label: '02:00 PM' },
    { value: '14:30', label: '02:30 PM' },
    { value: '18:00', label: '06:00 PM' },
    { value: '18:30', label: '06:30 PM' },
    { value: '19:00', label: '07:00 PM' },
    { value: '19:30', label: '07:30 PM' },
    { value: '20:00', label: '08:00 PM' },
    { value: '20:30', label: '08:30 PM' },
    { value: '21:00', label: '09:00 PM' },
    { value: '21:30', label: '09:30 PM' },
    { value: '22:00', label: '10:00 PM' },
  ];

  const guestOptions = Array.from({ length: 10 }, (_, i) => ({ value: i + 1, label: `${i + 1} People` }));

  const [selectedDate, setSelectedDate] = useState(datesList[0].value);
  const [selectedTime, setSelectedTime] = useState('19:00');
  const [selectedGuests, setSelectedGuests] = useState(2);
  const [phoneNumber, setPhoneNumber] = useState('');
  
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  const handleBookTable = async () => {
    if (!selectedRestaurantId) {
      setBookingError('Please select a restaurant');
      return;
    }
    if (phoneNumber.length !== 10) {
      setBookingError('Please enter a 10-digit phone number');
      return;
    }

    setBookingLoading(true);
    setBookingError(null);
    try {
      await apiClient.post('/public/landing/reserve', {
        restaurantId: selectedRestaurantId,
        guests: Number(selectedGuests),
        date: selectedDate,
        slot: selectedTime,
        mobile: phoneNumber,
        customerName: 'Guest'
      });
      setBookingSuccess(true);
      setTimeout(() => {
        navigate(`/auth/customer?mobile=${phoneNumber}`);
      }, 2000);
    } catch (err: any) {
      setBookingError(err.response?.data?.message || 'Failed to book table. Please try again.');
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <section
      id="home"
      className="relative min-h-[680px] flex flex-col justify-center overflow-hidden"
      style={{
        background: `linear-gradient(90deg, rgba(15,15,15,0.88) 0%, rgba(15,15,15,0.4) 100%), url('/images/landing/hero.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Spacer for fixed navbar */}
      <div className="h-[72px] shrink-0" />

      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 w-full py-12 lg:py-16 flex-1 flex items-center">
        <div className="w-full flex flex-col lg:flex-row items-start lg:items-center gap-12 lg:gap-16">

          {/* Left Content */}
          <div className="flex-1 max-w-[640px]">
            <h1
              className="text-[36px] sm:text-[48px] lg:text-[60px] xl:text-[64px] leading-[1.1] tracking-tight text-white"
              style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400 }}
            >
              Find the best{' '}
              <br className="hidden sm:block" />
              restaurants{' '}
              <span className="italic" style={{ color: '#FF6B1A' }}>near you</span>
            </h1>

            <p
              className="mt-5 text-[16px] sm:text-[18px] leading-relaxed max-w-[520px]"
              style={{ color: 'rgba(255,255,255,0.65)' }}
            >
              Explore top restaurants, check availability, book a table or order instantly.
            </p>

            {/* Smart Search Module */}
            <div
              className="mt-8 p-4 sm:p-5 w-full max-w-[540px]"
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '20px',
                boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
              }}
            >
              {/* Search Tabs */}
              <div className="flex gap-1 mb-3">
                {SEARCH_TABS.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className="px-3 py-1.5 text-[13px] font-medium transition-all duration-150 landing-btn-press"
                    style={{
                      borderRadius: '999px',
                      backgroundColor: activeTab === tab ? '#FF6B1A' : 'transparent',
                      color: activeTab === tab ? '#FFFFFF' : '#666666',
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Search Input */}
              <div
                className="flex items-center gap-3 px-4 h-[48px]"
                style={{
                  border: '1px solid #E5E7EB',
                  borderRadius: '14px',
                }}
              >
                <Search className="w-[18px] h-[18px] shrink-0" style={{ color: '#666666' }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search for ${activeTab.toLowerCase()}...`}
                  className="flex-1 bg-transparent border-none outline-none text-[14px] placeholder:text-[#999999]"
                  style={{ color: '#222222' }}
                  aria-label={`Search for ${activeTab.toLowerCase()}`}
                />
                <button
                  className="px-4 h-[36px] text-[13px] font-semibold text-white shrink-0 transition-colors duration-150 landing-btn-press"
                  style={{ backgroundColor: '#FF6B1A', borderRadius: '10px' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#E65A0A'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FF6B1A'; }}
                >
                  Search
                </button>
              </div>

              {/* Trending Searches */}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <TrendingUp className="w-[14px] h-[14px]" style={{ color: '#666666' }} />
                <span className="text-[12px] font-medium" style={{ color: '#666666' }}>Trending:</span>
                {TRENDING_SEARCHES.map((term) => (
                  <button
                    key={term}
                    className="px-3 py-1 text-[12px] font-medium transition-all duration-150"
                    style={{
                      borderRadius: '999px',
                      border: '1px solid #E5E7EB',
                      color: '#666666',
                      backgroundColor: 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#FF6B1A';
                      e.currentTarget.style.color = '#FF6B1A';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#E5E7EB';
                      e.currentTarget.style.color = '#666666';
                    }}
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right — Reservation Widget */}
          <div
            className="w-full lg:w-[400px] xl:w-[420px] shrink-0 p-6 sm:p-8"
            style={{
              backgroundColor: 'rgba(255,255,255,0.97)',
              borderRadius: '20px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <h3 className="text-[22px] font-bold" style={{ color: '#222222' }}>
              Book a Table
            </h3>
            <p className="text-[14px] mt-1" style={{ color: '#666666' }}>
              Find available tables instantly
            </p>

            <div className="space-y-3 mt-5">
              {/* Restaurant Dropdown */}
              <div>
                <label className="text-[12px] font-medium mb-1 block" style={{ color: '#666666' }}>
                  Restaurant
                </label>
                <div
                  className="flex items-center gap-2 px-3 h-[48px]"
                  style={{ border: '1px solid #E5E7EB', borderRadius: '14px' }}
                >
                  <MapPin className="w-[16px] h-[16px] shrink-0" style={{ color: '#FF6B1A' }} />
                  <select
                    className="flex-1 bg-transparent border-none outline-none text-[14px] font-medium appearance-none cursor-pointer"
                    style={{ color: '#222222' }}
                    value={selectedRestaurantId}
                    onChange={(e) => setSelectedRestaurantId(e.target.value)}
                    aria-label="Select Restaurant"
                  >
                    <option value="" disabled>Select a restaurant</option>
                    {restaurants.map((r: any) => (
                      <option key={r._id || r.id} value={r._id || r.id}>
                        {r.name} — {r.city || 'Mumbai'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date & Time Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-medium mb-1 block" style={{ color: '#666666' }}>
                    Date
                  </label>
                  <div
                    className="flex items-center gap-2 px-3 h-[48px]"
                    style={{ border: '1px solid #E5E7EB', borderRadius: '14px' }}
                  >
                    <Calendar className="w-[16px] h-[16px] shrink-0" style={{ color: '#FF6B1A' }} />
                    <select
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="flex-1 bg-transparent border-none outline-none text-[14px] font-medium appearance-none cursor-pointer"
                      style={{ color: '#222222' }}
                      aria-label="Select Date"
                    >
                      {datesList.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[12px] font-medium mb-1 block" style={{ color: '#666666' }}>
                    Time
                  </label>
                  <div
                    className="flex items-center gap-2 px-3 h-[48px]"
                    style={{ border: '1px solid #E5E7EB', borderRadius: '14px' }}
                  >
                    <Clock className="w-[16px] h-[16px] shrink-0" style={{ color: '#FF6B1A' }} />
                    <select
                      value={selectedTime}
                      onChange={(e) => setSelectedTime(e.target.value)}
                      className="flex-1 bg-transparent border-none outline-none text-[14px] font-medium appearance-none cursor-pointer"
                      style={{ color: '#222222' }}
                      aria-label="Select Time"
                    >
                      {timeSlots.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Guests & Phone Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-medium mb-1 block" style={{ color: '#666666' }}>
                    Guests
                  </label>
                  <div
                    className="flex items-center gap-2 px-3 h-[48px]"
                    style={{ border: '1px solid #E5E7EB', borderRadius: '14px' }}
                  >
                    <Users className="w-[16px] h-[16px] shrink-0" style={{ color: '#FF6B1A' }} />
                    <select
                      value={selectedGuests}
                      onChange={(e) => setSelectedGuests(Number(e.target.value))}
                      className="flex-1 bg-transparent border-none outline-none text-[14px] font-medium appearance-none cursor-pointer"
                      style={{ color: '#222222' }}
                      aria-label="Select Guests"
                    >
                      {guestOptions.map((g) => (
                        <option key={g.value} value={g.value}>
                          {g.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[12px] font-medium mb-1 block" style={{ color: '#666666' }}>
                    Phone Number
                  </label>
                  <div
                    className="flex items-center gap-2 px-3 h-[48px]"
                    style={{ border: '1px solid #E5E7EB', borderRadius: '14px' }}
                  >
                    <span className="text-[14px] font-semibold text-[#FF6B1A]">+91</span>
                    <input
                      type="tel"
                      maxLength={10}
                      placeholder="98765 43210"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="flex-1 bg-transparent border-none outline-none text-[14px] font-medium placeholder:text-[#999999]"
                      style={{ color: '#222222' }}
                      aria-label="Phone Number"
                    />
                  </div>
                </div>
              </div>
            </div>

            {bookingError && (
              <div className="mt-3 p-2.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg">
                {bookingError}
              </div>
            )}
            {bookingSuccess && (
              <div className="mt-3 p-2.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg animate-pulse">
                🎉 Table booked successfully! Redirecting...
              </div>
            )}

            <button
              onClick={handleBookTable}
              disabled={bookingLoading}
              className="w-full h-[52px] mt-5 text-[15px] font-semibold text-white transition-colors duration-150 landing-btn-press flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ backgroundColor: '#FF6B1A', borderRadius: '14px' }}
              onMouseEnter={(e) => { if(!bookingLoading) e.currentTarget.style.backgroundColor = '#E65A0A'; }}
              onMouseLeave={(e) => { if(!bookingLoading) e.currentTarget.style.backgroundColor = '#FF6B1A'; }}
            >
              {bookingLoading ? 'Reserving...' : 'Book Table Now'}
            </button>

            <p className="text-center text-[12px] mt-3" style={{ color: '#666666' }}>
              Free cancellation • Instant confirmation
            </p>
          </div>
        </div>
      </div>

      {/* Trust Badges Strip */}
      <div
        className="shrink-0 py-4 landing-hide-scrollbar overflow-x-auto"
        style={{
          backgroundColor: 'rgba(0,0,0,0.35)',
          backdropFilter: 'blur(8px)',
          borderTop: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 flex items-center gap-8 lg:justify-between min-w-max lg:min-w-0">
          {TRUST_BADGES.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2.5 shrink-0">
              <div
                className="w-[32px] h-[32px] rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
              >
                <Icon className="w-[16px] h-[16px]" style={{ color: '#FF6B1A' }} />
              </div>
              <span className="text-[13px] font-semibold text-white whitespace-nowrap">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
