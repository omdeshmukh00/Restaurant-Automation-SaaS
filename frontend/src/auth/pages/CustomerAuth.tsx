import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../AuthProvider';
import { apiClient } from '../../shared/services/apiClient';
import { setAccessToken, setStoredRole, setStoredUser } from '../tokenStore';
import { ArrowRight, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCustomerStore } from '../../features/customer/store/customer.store';

const getOtpExpiryDate = (durationSeconds: number): string => {
  return new Date(Date.now() + durationSeconds * 1000).toISOString();
};

const CustomerAuth: React.FC = () => {
  const { signInAs, setAccessTokenState, setUser, switchPanel } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const tableToken = searchParams.get('table_token');
  const fromPath = (location.state as any)?.from;
  const from = fromPath ? `${fromPath.pathname}${fromPath.search || ''}` : '/customer';

  const [mobile, setMobile] = useState(searchParams.get('mobile') || '');
  const [otp, setOtp] = useState<string[]>(['', '', '', '']);
  const [name, setName] = useState('');
  const [userExists, setUserExists] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otpExpiresAt, setOtpExpiresAt] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [showNamePrompt, setShowNamePrompt] = useState(false);

  const otpRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    const saved = localStorage.getItem('customerOtpExpiresAt');
    if (saved) {
      const remaining = Math.max(0, Math.floor((new Date(saved).getTime() - new Date().getTime()) / 1000));
      if (remaining > 0) {
        setOtpExpiresAt(saved);
        setCountdown(remaining);
        setOtpSent(true);
      } else {
        localStorage.removeItem('customerOtpExpiresAt');
      }
    }
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (otpExpiresAt) {
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [otpExpiresAt]);

  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
    setMobile(value);
    setError(null);
  };

  const handleOtpChange = (index: number, value: string) => {
    const cleanValue = value.replace(/\D/g, '').slice(0, 1);
    const newOtp = [...otp];
    newOtp[index] = cleanValue;
    setOtp(newOtp);
    setError(null);

    // Auto-focus next input
    if (cleanValue && index < 3) {
      otpRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
  };

  const handleRequestOtp = async () => {
    if (mobile.length !== 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/auth/request-otp', { mobile });
      const payload = response.data.data;
      setUserExists(Boolean(payload.exists));
      setOtpSent(true);
      const durationSeconds = payload.otpExpiresIn || 120;
      const clientExpiresAt = getOtpExpiryDate(durationSeconds);
      setOtpExpiresAt(clientExpiresAt);
      localStorage.setItem('customerOtpExpiresAt', clientExpiresAt);
      setCountdown(durationSeconds);

      if (payload.devOtp) {
        setSuccess(`OTP sent successfully!`);
      } else {
        setSuccess('OTP sent successfully!');
      }
      setTimeout(() => setSuccess(null), 8000);
      // Focus first OTP field
      setTimeout(() => otpRefs[0].current?.focus(), 100);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 4) {
      setError('Please enter the 4-digit OTP code');
      return;
    }

    if (!userExists && !name.trim()) {
      setError('Please enter your name');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/auth/verify-otp', {
        mobile,
        otp: otpCode,
        name: !userExists ? name.trim() : undefined,
      });

      const data = response.data.data;

      // Save tokens using tokenStore helpers
      setAccessToken('customer', data.accessToken);
      setStoredRole('customer', 'customer');
      
      if (setAccessTokenState) {
        setAccessTokenState(data.accessToken);
      }
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.removeItem('customerOtpExpiresAt');

      const userPayload = {
        id: data.user?.id || data.customerId,
        name: data.user?.name || 'Customer',
        role: 'customer' as const,
        panel: 'customer' as const,
        restaurantName: 'Amber Table',
        mobile,
      };

      setStoredUser('customer', userPayload);
      if (setUser) {
        setUser(userPayload);
      }

      // Sync customer store
      const { updateProfile } = useCustomerStore.getState();
      updateProfile({
        name: userPayload.name,
        phone: mobile,
        avatar: 'person',
      });

      // Switch active panel context immediately
      switchPanel('customer');

      setSuccess('Logged in successfully!');
      setTimeout(() => {
        if (tableToken) {
          navigate(`/table?token=${tableToken}`, { replace: true });
        } else {
          navigate(from, { replace: true });
        }
      }, 800);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || 'Invalid OTP code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpSent) {
      handleRequestOtp();
    } else {
      handleVerifyOtp();
    }
  };

  const handleGuestContinue = () => {
    signInAs('customer');
    navigate('/customer', { replace: true });
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="bg-white dark:bg-card border border-slate-100 dark:border-zinc-800 rounded-3xl p-8 shadow-premium relative overflow-hidden"
    >
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 rounded-full bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center mb-4">
          <User className="w-8 h-8 text-orange-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-zinc-100 font-display">Customer Login</h2>
        <p className="text-slate-500 dark:text-zinc-400 text-sm mt-1 text-center font-sans">
          {showNamePrompt ? 'Almost there! Set your name' : 'Login to continue and explore our services'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Mobile Input */}
        <div className={otpSent ? 'opacity-50 pointer-events-none' : ''}>
              <label className="block text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1 font-sans">
                Enter Mobile Number
              </label>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mb-3 font-sans">
                We will send you a 4-digit OTP
              </p>

              <div className="flex items-stretch border border-slate-200 dark:border-zinc-700 rounded-2xl overflow-hidden focus-within:border-orange-500 focus-within:ring-1 focus-within:ring-orange-500 transition-all duration-200">
                {/* Country selector */}
                <div className="flex items-center space-x-2 px-4 bg-slate-50 dark:bg-zinc-800 border-r border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300">
                  <span className="text-lg">🇮🇳</span>
                  <span className="font-medium text-sm">+91</span>
                  <span className="text-[10px] text-slate-400">▼</span>
                </div>

                <input
                  type="tel"
                  placeholder="Enter mobile number"
                  value={mobile}
                  onChange={handleMobileChange}
                  disabled={otpSent || loading}
                  className="flex-1 w-full px-4 py-3 text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-600 bg-transparent border-0 outline-none focus:ring-0 text-base font-sans"
                  maxLength={10}
                />
              </div>
            </div>

            {/* OTP Input Section */}
            <AnimatePresence>
              {otpSent && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3 overflow-hidden"
                >
                  {!userExists && (
                    <div className="space-y-1.5 mt-2">
                      <label className="block text-sm font-semibold text-slate-700 dark:text-zinc-300 font-sans">
                        What is your name?
                      </label>
                      <p className="text-xs text-slate-400 dark:text-zinc-500 font-sans">
                        Please enter your name to complete your registration
                      </p>
                      <div className="flex items-center border border-slate-200 dark:border-zinc-700 rounded-2xl overflow-hidden focus-within:border-orange-500 focus-within:ring-1 focus-within:ring-orange-500 transition-all duration-200 bg-slate-50 dark:bg-zinc-800">
                        <input
                          type="text"
                          placeholder="Enter your name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="flex-1 w-full px-4 py-3 text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-600 bg-transparent border-0 outline-none focus:ring-0 text-base font-sans"
                          required
                          disabled={loading}
                        />
                      </div>
                    </div>
                  )}

                  <label className="block text-sm font-semibold text-slate-700 dark:text-zinc-300 font-sans">
                    Enter OTP
                  </label>
                  <p className="text-xs text-slate-400 dark:text-zinc-500 font-sans">
                    Enter the 4-digit code sent to your mobile number
                  </p>

                  <div className="flex justify-between space-x-3 py-2">
                    {otp.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={otpRefs[idx]}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(idx, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(idx, e)}
                        disabled={loading}
                        className="w-16 h-16 text-center text-xl font-bold text-slate-800 dark:text-zinc-100 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:bg-white outline-none transition-all duration-200"
                        placeholder="-"
                      />
                    ))}
                  </div>

                  <div className="flex justify-between items-center text-xs mt-2 px-1 font-sans">
                    <span className="text-slate-400 dark:text-zinc-500">
                      {countdown > 0 ? (
                        <>OTP expires in <span className="text-orange-500 font-medium">{formatCountdown(countdown)}</span></>
                      ) : (
                        <span className="text-red-500 font-medium">OTP expired.</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={handleRequestOtp}
                      disabled={countdown > 0 || loading}
                      className={`font-semibold transition-colors ${
                        countdown > 0
                          ? 'text-slate-300 dark:text-zinc-600 cursor-not-allowed'
                          : 'text-orange-600 dark:text-orange-500 hover:text-orange-700'
                      }`}
                    >
                      Resend OTP
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

        {/* Feedback alerts */}
        {error && (
          <div className="text-red-500 dark:text-red-400 text-sm font-medium bg-red-50 dark:bg-red-950/20 px-4 py-3 rounded-2xl border border-red-100 dark:border-red-900/30 font-sans">
            {error}
          </div>
        )}
        {success && (
          <div className="text-green-500 dark:text-green-400 text-sm font-medium bg-green-50 dark:bg-green-950/20 px-4 py-3 rounded-2xl border border-green-100 dark:border-green-900/30 font-sans">
            {success}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || (otpSent && (otp.some((d) => !d) || countdown <= 0 || (!userExists && !name.trim())))}
          className={`w-full flex items-center justify-center space-x-2 py-3.5 text-white font-semibold rounded-2xl shadow-soft transition-all active:scale-[0.98] disabled:pointer-events-none font-sans ${
            (otpSent && countdown <= 0) ? 'bg-slate-400 cursor-not-allowed opacity-100' : 'bg-orange-600 hover:bg-orange-700 hover:shadow-md disabled:opacity-50'
          }`}
        >
          <span>
            {!otpSent ? 'Get OTP' : 'Verify & Login'}
          </span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </form>

      {/* Footer */}
    </motion.div>
  );
};

export default CustomerAuth;