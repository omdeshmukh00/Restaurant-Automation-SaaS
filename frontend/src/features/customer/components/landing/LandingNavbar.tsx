import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Bell, Menu, X, ChevronRight } from 'lucide-react';
import { useCustomerStore } from '../../store/customer.store';
import { useAuth } from '../../../../auth/AuthProvider';
import './landing.css';

interface LandingNavbarProps {
  onLoginOpen: () => void;
}

interface NavLink {
  label: string;
  href: string;
  requiresAuth: boolean;
}

const NAV_LINKS: NavLink[] = [
  { label: 'Home', href: '/', requiresAuth: false },
  { label: 'Restaurants', href: '/customer/restaurants', requiresAuth: false },
  { label: 'Reservations', href: '/customer/reservations', requiresAuth: true },
  { label: 'Offers', href: '/customer/offers', requiresAuth: false },
];

export default function LandingNavbar({ onLoginOpen }: LandingNavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const { isPanelAuthenticated } = useAuth();
  const isCustomerAuth = isPanelAuthenticated('customer');

  const {
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    clearAllNotifications,
  } = useCustomerStore();
  const unreadCount = isCustomerAuth ? notifications.filter((n) => !n.read).length : 0;

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMobileMenuOpen]);

  const handleNavClick = (e: React.MouseEvent, link: NavLink) => {
    e.preventDefault();
    if (link.requiresAuth) {
      onLoginOpen();
    } else {
      navigate(link.href);
    }
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled ? 'landing-navbar-scrolled' : ''
        }`}
        style={{
          background: isScrolled
            ? undefined
            : 'linear-gradient(135deg, rgba(15,15,15,0.85) 0%, rgba(30,20,10,0.75) 50%, rgba(15,15,15,0.85) 100%)',
          backdropFilter: isScrolled ? undefined : 'blur(12px) saturate(150%)',
        }}
      >
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 h-[72px] flex items-center justify-between">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2.5 landing-focus-ring">
            <div
              className="w-[38px] h-[38px] rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: '#FF6B1A', boxShadow: '0 0 14px rgba(255,107,26,0.35)' }}
            >
              <span className="material-symbols-outlined text-[18px] font-bold text-white block">restaurant</span>
            </div>
            <span className="font-bold text-[20px] tracking-tight text-white">
              Resto<span style={{ color: '#FF6B1A' }}>Hub</span>
            </span>
          </a>

          {/* Desktop Nav Links */}
          <nav className="hidden lg:flex items-center gap-1.5">
            {NAV_LINKS.map((link) => {
              const isActive = location.pathname === link.href;
              return (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link)}
                  className={`landing-nav-capsule text-[14px] font-medium landing-focus-ring relative z-10 flex items-center gap-1.5 ${
                    isActive ? 'active' : ''
                  }`}
                  style={{
                    color: isActive ? '#FF6B1A' : 'rgba(255,255,255,0.7)',
                    textDecoration: 'none',
                    backgroundColor: isActive ? 'rgba(255,107,26,0.08)' : undefined,
                    borderRadius: '12px',
                    padding: '8px 16px'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#FF6B1A'; }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = isActive ? '#FF6B1A' : 'rgba(255,255,255,0.7)';
                  }}
                >
                  {link.label}
                </a>
              );
            })}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-3">

            {/* Notifications Icon with Interactive Dropdown */}
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="hidden sm:flex w-[40px] h-[40px] rounded-full items-center justify-center transition-colors duration-150 landing-focus-ring relative cursor-pointer"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  color: '#FFFFFF',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
                aria-label="Notifications"
              >
                <Bell className="w-[18px] h-[18px]" />
                {unreadCount > 0 && (
                  <span
                    className="absolute top-[8px] right-[8px] w-[8px] h-[8px] rounded-full landing-pulse-dot bg-orange-500"
                  />
                )}
              </button>

              {/* Notifications Dropdown */}
              {notificationsOpen && (
                <>
                  {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
                  <div className="fixed inset-0 z-40" onClick={() => setNotificationsOpen(false)} />
                  <div className="absolute right-0 mt-2.5 w-80 sm:w-96 bg-white border border-[#E5E7EB] rounded-2xl shadow-xl z-50 overflow-hidden animate-fadeIn max-h-[500px] flex flex-col">
                    {!isCustomerAuth ? (
                      <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                        <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center text-orange-500 mb-3">
                          <Bell className="w-5 h-5 animate-bounce" />
                        </div>
                        <p className="text-sm font-bold text-slate-800 font-sans">Login to view notifications</p>
                        <p className="text-xs text-slate-500 font-sans mt-1">Get real-time updates on your table reservations and orders.</p>
                        <button
                          onClick={() => {
                            setNotificationsOpen(false);
                            onLoginOpen();
                          }}
                          className="mt-4 px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-orange-500 to-red-500 rounded-xl hover:opacity-90 transition-opacity font-sans"
                        >
                          Login / Sign Up
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Header */}
                        <div className="p-4 border-b border-[#E5E7EB] bg-slate-50 flex justify-between items-center shrink-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-800 font-sans">Notifications</span>
                            {unreadCount > 0 && (
                              <span className="text-[10px] font-bold bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-sans animate-pulse">
                                {unreadCount} New
                              </span>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {unreadCount > 0 && (
                              <button
                                onClick={() => markAllNotificationsRead()}
                                className="text-xs text-orange-600 font-bold hover:underline font-sans bg-transparent border-0 p-0 cursor-pointer"
                              >
                                Mark all read
                              </button>
                            )}
                            {notifications.length > 0 && (
                              <button
                                onClick={() => clearAllNotifications()}
                                className="text-xs text-red-500 font-bold hover:underline font-sans bg-transparent border-0 p-0 cursor-pointer"
                              >
                                Clear all
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto max-h-96 divide-y divide-slate-100">
                          {notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                              <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mb-3">
                                <span className="material-symbols-outlined text-2xl text-slate-400/50">notifications_off</span>
                              </div>
                              <p className="text-sm font-bold text-slate-800 font-sans">All caught up!</p>
                              <p className="text-xs text-slate-500 font-sans mt-0.5">No new notifications at the moment.</p>
                            </div>
                          ) : (
                            notifications.map((n) => {
                              let iconColor = 'bg-blue-50 text-blue-500';
                              let iconName = 'info';

                              if (n.type === 'order') {
                                iconColor = 'bg-orange-50 text-orange-500';
                                iconName = 'shopping_bag';
                              } else if (n.type === 'offer') {
                                iconColor = 'bg-purple-50 text-purple-500';
                                iconName = 'sell';
                              }

                              return (
                                <div
                                  key={n.id}
                                  className={`p-4 flex gap-3 transition-colors ${
                                    !n.read ? 'bg-orange-50/10' : 'hover:bg-slate-50'
                                  }`}
                                >
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${iconColor}`}>
                                    <span className="material-symbols-outlined text-lg">{iconName}</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                      <p className={`text-xs font-bold font-sans text-left ${!n.read ? 'text-slate-900' : 'text-slate-700'}`}>
                                        {n.title}
                                      </p>
                                      <span className="text-[10px] text-slate-400 font-sans shrink-0">
                                        {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-500 font-sans mt-0.5 leading-relaxed text-left">
                                      {n.message}
                                    </p>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            <button
              onClick={onLoginOpen}
              className="hidden sm:flex items-center gap-2 px-5 h-[42px] text-[14px] font-semibold text-white transition-all duration-150 landing-btn-premium landing-focus-ring"
              style={{
                background: 'linear-gradient(135deg, #FF6B1A 0%, #E65A0A 100%)',
                borderRadius: '14px',
                boxShadow: '0 4px 15px rgba(255,107,26,0.3)',
              }}
            >
              Login / Sign Up
            </button>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden w-[40px] h-[40px] rounded-full flex items-center justify-center transition-colors duration-150 landing-focus-ring"
              style={{
                backgroundColor: 'rgba(255,255,255,0.08)',
                color: '#FFFFFF',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {isMobileMenuOpen ? <X className="w-[20px] h-[20px]" /> : <Menu className="w-[20px] h-[20px]" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-[60] flex flex-col"
          style={{ background: 'linear-gradient(135deg, #0F0F0F 0%, #1A1008 100%)' }}
        >
          <div className="flex items-center justify-between px-6 h-[72px]">
            <a href="/" className="flex items-center gap-2.5">
              <div
                className="w-[38px] h-[38px] rounded-full flex items-center justify-center"
                style={{ backgroundColor: '#FF6B1A' }}
              >
                <span className="material-symbols-outlined text-[18px] font-bold text-white block">restaurant</span>
              </div>
              <span className="font-bold text-[20px] tracking-tight text-white">
                Resto<span style={{ color: '#FF6B1A' }}>Hub</span>
              </span>
            </a>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="w-[40px] h-[40px] rounded-full flex items-center justify-center text-white"
              style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
              aria-label="Close menu"
            >
              <X className="w-[20px] h-[20px]" />
            </button>
          </div>

          <nav className="flex-1 flex flex-col justify-center px-8 overflow-y-auto py-4 gap-1">
            {NAV_LINKS.map((link) => {
              const isActive = location.pathname === link.href;
              return (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={(e) => {
                    handleNavClick(e, link);
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center justify-between py-3.5 text-[20px] font-semibold border-b transition-colors duration-150"
                  style={{
                    borderColor: 'rgba(255,255,255,0.1)',
                    textDecoration: 'none',
                    color: isActive ? '#FF6B1A' : '#FFFFFF'
                  }}
                >
                  <span className="flex items-center gap-2">
                    {link.label}
                    {link.requiresAuth && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'rgba(255,107,26,0.15)', color: '#FF6B1A' }}>
                        Login
                      </span>
                    )}
                  </span>
                  <ChevronRight className="w-[18px] h-[18px]" style={{ color: isActive ? '#FF6B1A' : 'rgba(255,255,255,0.5)' }} />
                </a>
              );
            })}
          </nav>

          <div className="px-8 pb-8 shrink-0">
            <button
              onClick={() => { onLoginOpen(); setIsMobileMenuOpen(false); }}
              className="w-full h-[52px] text-[16px] font-semibold text-white landing-btn-premium"
              style={{ background: 'linear-gradient(135deg, #FF6B1A 0%, #E65A0A 100%)', borderRadius: '14px' }}
            >
              Login / Sign Up
            </button>
          </div>
        </div>
      )}
    </>
  );
}
