import React, { useState } from 'react';
import { Phone, ShieldCheck, AlertCircle, X, CheckCircle2 } from 'lucide-react';
import { useSettingsStore } from '../../store/settings.store';
import { adminUserApi } from '../../api/admin.users.api';
import { useAuth } from '../../../../auth/AuthProvider';

const ROLE_LABELS: Record<string, string> = {
  'restaurant-admin': 'Administrator',
  'restaurant-manager': 'Manager',
  admin: 'Administrator',
  manager: 'Manager',
};

function humanizeRole(role: string): string {
  if (ROLE_LABELS[role]) return ROLE_LABELS[role];
  return role
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function ProfileCard(): JSX.Element {
  const { user } = useAuth();
  const admin = useSettingsStore((s) => s.admin);
  const updateProfile = useSettingsStore((s) => s.updateProfile);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const avatarImage = user?.avatar || admin.avatar;

  const [formData, setFormData] = useState({
    name: admin.name,
    mobile: admin.mobile,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // OTP modal state
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [pendingMobile, setPendingMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSaving, setOtpSaving] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSuccess, setOtpSuccess] = useState(false);
  const [otpResendTimer, setOtpResendTimer] = useState(0);

  React.useEffect(() => {
    setFormData({ name: admin.name, mobile: admin.mobile });
  }, [admin.name, admin.mobile]);

  // Resend countdown
  React.useEffect(() => {
    if (otpResendTimer <= 0) return;
    const id = setInterval(() => setOtpResendTimer((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [otpResendTimer]);

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        if (typeof reader.result === 'string') {
          await updateProfile({ avatar: reader.result });
          window.dispatchEvent(new CustomEvent('ra-user-updated', { detail: { avatar: reader.result } }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const changedMobile = formData.mobile !== admin.mobile;

    if (changedMobile) {
      // Phone is changing — call API directly to trigger OTP flow
      setSaving(true);
      try {
        const result = await adminUserApi.updateMe({
          name: formData.name,
          mobile: formData.mobile,
        });

        if ('otpSent' in result) {
          // OTP was sent — show verification modal
          setPendingMobile(formData.mobile);
          setShowOtpModal(true);
          setOtpResendTimer(60);
        } else {
          // Shouldn't happen with phone change, but handle gracefully
          setError('Unexpected response from server. Please try again.');
        }
      } catch (err: any) {
        setError(err?.response?.data?.message || err?.message || 'Failed to save');
      } finally {
        setSaving(false);
      }
    } else {
      // Only name changed, go through the store
      setSaving(true);
      try {
        await updateProfile({ name: formData.name });
      } catch (err: any) {
        setError(err?.response?.data?.message || err?.message || 'Failed to save');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length < 4) {
      setOtpError('Please enter the OTP sent to your email');
      return;
    }
    setOtpSaving(true);
    setOtpError(null);
    try {
      const updatedUser = await adminUserApi.verifyPhoneOtp(otp);
      // Update the store with the new phone number
      useSettingsStore.setState((s) => ({
        admin: {
          ...s.admin,
          mobile: updatedUser.mobile || pendingMobile,
        },
        saved: 'Phone number updated successfully',
      }));
      setOtpSuccess(true);
      setTimeout(() => {
        setShowOtpModal(false);
        setOtp('');
        setOtpSuccess(false);
      }, 1500);
    } catch (err: any) {
      setOtpError(err?.response?.data?.message || err?.message || 'OTP verification failed');
    } finally {
      setOtpSaving(false);
    }
  };

  const handleResendOtp = async () => {
    if (otpResendTimer > 0) return;
    setOtpError(null);
    try {
      await adminUserApi.requestPhoneChangeOtp(pendingMobile);
      setOtpResendTimer(60);
    } catch (err: any) {
      setOtpError(err?.response?.data?.message || err?.message || 'Failed to resend OTP');
    }
  };

  return (
    <>
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 transition-colors duration-200">
        <div className="flex items-center gap-4 mb-5">
          <div className="relative group shrink-0">
            <div className="w-14 h-14 rounded-full bg-blue-500 overflow-hidden flex items-center justify-center text-white text-xl font-semibold shadow-sm">
              {avatarImage ? (
                <img src={avatarImage} alt={admin.name || 'Admin'} className="w-full h-full object-cover" />
              ) : (
                admin.name ? admin.name.charAt(0).toUpperCase() : 'A'
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-6 h-6 bg-white dark:bg-gray-800 shadow-md rounded-full flex items-center justify-center border border-gray-200 dark:border-gray-700 text-gray-600 hover:text-blue-500 transition-colors"
              title="Change Avatar Photo"
            >
              <span className="material-symbols-outlined text-[13px]">photo_camera</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarFileChange}
              accept="image/*"
              className="hidden"
            />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-gray-100">{admin.name || 'Admin'}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{humanizeRole(admin.role)}</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-medium">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Full Name</label>
            <input
              type="text"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.name}
              onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Email</label>
            <input
              type="email"
              disabled
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 text-sm cursor-not-allowed"
              value={admin.email}
              title="Email cannot be changed from here"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Phone</label>
            <div className="relative">
              <Phone size={15} className="absolute left-3 top-3 text-gray-400" />
              <input
                type="tel"
                className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.mobile}
                onChange={(e) => setFormData((f) => ({ ...f, mobile: e.target.value }))}
                placeholder="Phone number"
              />
            </div>
            <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">
              Changing phone number requires OTP verification via email
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Role</label>
            <input
              type="text"
              disabled
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 text-sm cursor-not-allowed"
              value={humanizeRole(admin.role)}
            />
          </div>

          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60 cursor-pointer"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* OTP Verification Modal */}
      {showOtpModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 shadow-xl">
            <button
              type="button"
              onClick={() => { if (!otpSuccess) setShowOtpModal(false); }}
              className="absolute top-4 right-4 p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900 flex items-center justify-center">
                <ShieldCheck size={20} className="text-orange-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">Verify Phone Number</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  We've sent a verification code to <strong>{admin.email}</strong>
                </p>
              </div>
            </div>

            {otpSuccess ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mb-3">
                  <CheckCircle2 size={28} className="text-emerald-500" />
                </div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Phone number updated!</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Your phone number has been changed successfully.</p>
              </div>
            ) : (
              <>
                {otpError && (
                  <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-medium">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{otpError}</span>
                  </div>
                )}

                <div className="text-xs text-gray-500 dark:text-gray-400 mb-4 space-y-1">
                  <p>New phone number: <strong className="text-gray-800 dark:text-gray-200">{pendingMobile}</strong></p>
                  <p>Please enter the OTP sent to your registered email address to confirm the change.</p>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Enter OTP</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    className="w-full px-4 py-3 text-center text-lg font-mono font-bold tracking-[0.5em] rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                  />
                </div>

                <div className="flex items-center justify-between mb-4">
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={otpResendTimer > 0}
                    className="text-xs font-medium text-orange-500 hover:text-orange-600 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {otpResendTimer > 0 ? `Resend OTP in ${otpResendTimer}s` : 'Resend OTP'}
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowOtpModal(false)}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-700 dark:text-gray-300 font-medium text-sm transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={otpSaving || otp.length < 4}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium text-sm shadow-sm shadow-orange-500/20 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    {otpSaving ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Verifying…
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} />
                        Verify OTP
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
