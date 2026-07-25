import React, { useState, useRef } from 'react';
import { User, Bell, Settings2, LogOut, Edit2, Camera, Check, Shield, Globe, Monitor, Moon, Sun } from 'lucide-react';
import { useStaffProfile } from '../hooks/useStaffProfile';
import { useTheme, ThemeMode } from '../../../app/providers/ThemeProvider';
import ImageCropperModal from '../../customer/components/dashboard/ImageCropperModal';
import { useAuth } from '../../../auth/AuthProvider';
import { apiClient } from '../../../shared/services/apiClient';

export default function StaffProfilePage() {
  const { signOut } = useAuth();
  const { profile, updateProfile } = useStaffProfile();
  const { theme, setTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeSection, setActiveSection] = useState<'profile' | 'notifications' | 'system'>('profile');
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showCropModal, setShowCropModal] = useState(false);

  // Settings states
  const [assistanceCalls, setAssistanceCalls] = useState(true);
  const [foodReady, setFoodReady] = useState(true);
  const [systemWarnings, setSystemWarnings] = useState(true);

  // Info Modal states
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editId, setEditId] = useState('');
  const [editSection, setEditSection] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');

  // OTP Verification states
  const [otpStep, setOtpStep] = useState<boolean>(false);
  const [enteredOtp, setEnteredOtp] = useState<string>('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState<boolean>(false);

  // Cropper states
  const [cropImageSrc, setCropImageSrc] = useState('');

  const openInfoModal = () => {
    setEditName(profile.name);
    setEditRole(profile.role);
    setEditId(profile.id);
    setEditSection(profile.section);
    setEditPhone(profile.phone);
    setEditEmail(profile.email);
    setOtpStep(false);
    setEnteredOtp('');
    setOtpError(null);
    setShowInfoModal(true);
  };

  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editPhone.trim() !== (profile.phone || '').trim()) {
      setIsSendingOtp(true);
      setOtpError(null);
      try {
        const { profileAPI } = await import('../api/staff.api');
        const res = await profileAPI.sendPhoneOTP(editPhone);
        if (res.success) {
          setOtpStep(true);
        } else {
          setOtpError(res.error || 'Failed to generate verification OTP.');
        }
      } catch (err) {
        console.error('OTP send failed', err);
        setOtpError('Failed to send OTP to backend server.');
      } finally {
        setIsSendingOtp(false);
      }
      return;
    }

    try {
      await apiClient.patch('/users/me', {
        name: editName,
        mobile: editPhone,
      });
    } catch {
      // ignore
    }
    window.dispatchEvent(new CustomEvent('ra-user-updated', { detail: { name: editName, mobile: editPhone } }));
    updateProfile({
      name: editName,
      role: editRole,
      id: editId,
      section: editSection,
      phone: editPhone,
      email: editEmail,
    });
    setShowInfoModal(false);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSendingOtp(true);
    setOtpError(null);
    try {
      const { profileAPI } = await import('../api/staff.api');
      const verifyRes = await profileAPI.verifyPhoneOTP(editPhone, enteredOtp.trim());
      if (verifyRes.success) {
        try {
          await apiClient.patch('/users/me', {
            name: editName,
            mobile: editPhone,
          });
        } catch {
          // ignore
        }
        window.dispatchEvent(new CustomEvent('ra-user-updated', { detail: { name: editName, mobile: editPhone } }));
        await updateProfile({
          name: editName,
          role: editRole,
          id: editId,
          section: editSection,
          phone: editPhone,
          email: editEmail,
        });
        setShowInfoModal(false);
        setOtpStep(false);
        setEnteredOtp('');
        setOtpError(null);
      } else {
        setOtpError(verifyRes.error || 'Invalid OTP code. Please try again.');
      }
    } catch (err) {
      console.error('OTP verification failed', err);
      setOtpError('OTP verification failed on server.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setCropImageSrc(reader.result);
          setShowCropModal(true);
        }
        e.target.value = '';
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropConfirm = async (croppedBase64: string) => {
    try {
      await apiClient.patch('/users/me', { avatar: croppedBase64 });
    } catch {
      // ignore
    }
    window.dispatchEvent(new CustomEvent('ra-user-updated', { detail: { avatar: croppedBase64 } }));
    updateProfile({ avatar: croppedBase64 });
    setShowCropModal(false);
  };

  const navSections = [
    { id: 'profile', label: 'Profile Settings', icon: User },
    { id: 'notifications', label: 'Notification Preferences', icon: Bell },
    { id: 'system', label: 'System Preferences', icon: Settings2 },
  ];

  return (
    <>
      <div className="space-y-6 max-w-6xl animate-fadeIn font-sans">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 font-sans tracking-tight">
            Settings
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage your personal profile, notification preferences, and system settings.
          </p>
        </div>

        {/* Sidebar + Main Content Layout */}
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
          {/* Vertical Settings Sidebar (matching design screenshot) */}
          <nav className="w-full lg:w-64 shrink-0">
            <ul className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0">
              {navSections.map(({ id, label, icon: Icon }) => {
                const isActive = activeSection === id;
                return (
                  <li key={id} className="shrink-0 lg:shrink lg:w-full">
                    <button
                      onClick={() => setActiveSection(id as any)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all text-left whitespace-nowrap lg:w-full lg:whitespace-normal cursor-pointer ${isActive
                          ? 'bg-orange-500/10 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-500/20 font-extrabold shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                        }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 ${isActive
                            ? 'text-orange-500 dark:text-orange-400'
                            : 'text-slate-400 dark:text-slate-500'
                          }`}
                      />
                      <span className="lg:truncate">{label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Main Active Section Content */}
          <div className="flex-1 w-full space-y-6">
            {/* 1. Profile Settings Section */}
            {activeSection === 'profile' && (
              <div className="space-y-6">
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm relative dark:bg-sd-surface-container dark:border-sd-outline-variant/40">
                  <button
                    onClick={openInfoModal}
                    className="absolute top-4 right-4 text-slate-400 hover:text-dine-orange transition-colors cursor-pointer focus:outline-none p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800"
                    title="Edit Profile Information"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                    <button
                      onClick={handlePhotoClick}
                      className="w-24 h-24 rounded-full bg-dine-orange/15 hover:scale-105 transition-transform flex items-center justify-center text-dine-orange font-black text-3xl shadow-sm border border-dine-orange/10 overflow-hidden cursor-pointer relative group focus:outline-none shrink-0"
                      title="Change Photo"
                    >
                      {profile.avatar ? (
                        <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover" />
                      ) : (
                        profile.name.split(' ').map((n) => n[0]).join('').toUpperCase()
                      )}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera className="w-5 h-5 text-white" />
                      </div>
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handlePhotoChange}
                      accept="image/*"
                      className="hidden"
                    />

                    <div className="flex-1 text-center sm:text-left space-y-2">
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                        <h2 className="font-extrabold text-xl text-slate-850 dark:text-slate-150 font-sans">
                          {profile.name}
                        </h2>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-sans">
                        {profile.role} • ID: <span className="font-mono">{profile.id}</span>
                      </p>

                      <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="bg-slate-50 dark:bg-sd-surface-container-low p-3 rounded-xl border border-slate-100 dark:border-sd-outline-variant/30">
                          <span className="text-[10px] text-slate-400 block">Assigned Zone</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{profile.section}</span>
                        </div>
                        <div className="bg-slate-50 dark:bg-sd-surface-container-low p-3 rounded-xl border border-slate-100 dark:border-sd-outline-variant/30">
                          <span className="text-[10px] text-slate-400 block">Email Address</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 truncate block" title={profile.email}>
                            {profile.email}
                          </span>
                        </div>
                        <div className="bg-slate-50 dark:bg-sd-surface-container-low p-3 rounded-xl border border-slate-100 dark:border-sd-outline-variant/30">
                          <span className="text-[10px] text-slate-400 block">Phone Number</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{profile.phone}</span>
                        </div>
                        <div className="bg-slate-50 dark:bg-sd-surface-container-low p-3 rounded-xl border border-slate-100 dark:border-sd-outline-variant/30">
                          <span className="text-[10px] text-slate-400 block">Joined Platform</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{profile.joined}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 dark:border-sd-outline-variant/40 flex justify-end">
                    <button
                      onClick={() => signOut()}
                      className="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 font-bold text-xs py-2.5 px-5 rounded-xl transition-all cursor-pointer flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 2. Notification Preferences Section */}
            {activeSection === 'notifications' && (
              <div className="bg-white border border-slate-100 dark:bg-sd-surface-container dark:border-sd-outline-variant/40 rounded-2xl p-6 shadow-sm space-y-6">
                <div>
                  <h2 className="font-extrabold text-base text-slate-800 dark:text-slate-100 font-sans">
                    Notification Preferences
                  </h2>
                  <p className="text-xs text-slate-450 dark:text-slate-400 mt-0.5 font-sans">
                    Control sound, vibration, and push notification alerts for your shift assignments.
                  </p>
                </div>

                <div className="space-y-4 font-sans text-xs">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200">Customer Assistance Calls</p>
                      <p className="text-[11px] text-slate-450 dark:text-slate-400 mt-0.5">
                        Vibrate or sound when a guest calls for waiter assistance at assigned tables.
                      </p>
                    </div>
                    <button
                      onClick={() => setAssistanceCalls(!assistanceCalls)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${assistanceCalls ? 'bg-dine-orange' : 'bg-slate-200 dark:bg-slate-700'
                        }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${assistanceCalls ? 'translate-x-4' : 'translate-x-0'
                          }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200">Food Ready Notifications</p>
                      <p className="text-[11px] text-slate-450 dark:text-slate-400 mt-0.5">
                        Alert immediately when food dishes are marked ready by kitchen chefs.
                      </p>
                    </div>
                    <button
                      onClick={() => setFoodReady(!foodReady)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${foodReady ? 'bg-dine-orange' : 'bg-slate-200 dark:bg-slate-700'
                        }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${foodReady ? 'translate-x-4' : 'translate-x-0'
                          }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200">System Warnings & Alerts</p>
                      <p className="text-[11px] text-slate-450 dark:text-slate-400 mt-0.5">
                        Receive shift reassignments or high table delay warnings from supervisors.
                      </p>
                    </div>
                    <button
                      onClick={() => setSystemWarnings(!systemWarnings)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${systemWarnings ? 'bg-dine-orange' : 'bg-slate-200 dark:bg-slate-700'
                        }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${systemWarnings ? 'translate-x-4' : 'translate-x-0'
                          }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 3. System Preferences Section */}
            {activeSection === 'system' && (
              <div className="space-y-6">
                {/* Theme Options */}
                <div className="bg-white border border-slate-100 dark:bg-sd-surface-container dark:border-sd-outline-variant/40 rounded-2xl p-6 shadow-sm space-y-4">
                  <div>
                    <h2 className="font-extrabold text-base text-slate-800 dark:text-slate-100 font-sans">
                      Display Theme
                    </h2>
                    <p className="text-xs text-slate-450 dark:text-slate-400 mt-0.5 font-sans">
                      Choose light or dark appearance, or sync with your system theme.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { id: 'light', label: 'Light Mode', icon: Sun },
                      { id: 'dark', label: 'Dark Mode', icon: Moon },
                      { id: 'system', label: 'System Theme', icon: Monitor },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setTheme(item.id as ThemeMode)}
                          className={`flex flex-col items-center justify-center p-4 rounded-2xl border font-sans text-xs font-bold transition-all gap-2 cursor-pointer ${theme === item.id
                              ? 'border-dine-orange bg-dine-light-orange/30 text-dine-orange dark:bg-orange-950/20'
                              : 'border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 bg-slate-50 dark:bg-slate-800/50'
                            }`}
                        >
                          <Icon className="w-5 h-5" />
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Profile Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-sd-surface-container rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-xl w-full max-w-sm">
            {otpStep ? (
              <div>
                <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 mb-1 font-sans">
                  Verify Phone Change
                </h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-400 mb-4 font-sans leading-relaxed">
                  An OTP has been generated for changing phone number to{' '}
                  <strong className="text-slate-700 dark:text-slate-200">{editPhone}</strong>.
                </p>

                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 rounded-xl text-[11px] text-amber-700 dark:text-amber-300 font-sans mb-4 space-y-1">
                  <p className="font-extrabold flex items-center gap-1">
                    Terminal OTP Sent!
                  </p>
                  <p>Check your running backend server terminal console to get the 6-digit OTP code.</p>
                </div>

                <form onSubmit={handleVerifyOtp} className="space-y-4 font-sans text-xs">
                  <div>
                    <label htmlFor="otp-input" className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                      Enter 6-Digit OTP
                    </label>
                    <input
                      id="otp-input"
                      type="text"
                      maxLength={6}
                      value={enteredOtp}
                      onChange={(e) => {
                        setEnteredOtp(e.target.value);
                        setOtpError(null);
                      }}
                      placeholder="e.g. 123456"
                      className="w-full p-2.5 text-center tracking-widest font-mono text-base border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                      required
                      autoFocus
                    />
                  </div>

                  {otpError && <p className="text-[11px] font-bold text-red-500 font-sans">{otpError}</p>}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setOtpStep(false);
                        setOtpError(null);
                      }}
                      className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 text-slate-640 dark:text-slate-400 rounded-xl font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-all active:scale-95 cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2 bg-dine-orange text-white rounded-xl font-bold hover:bg-orange-600 transition-all active:scale-95 cursor-pointer"
                    >
                      Verify & Update
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div>
                <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 mb-1 font-sans">
                  Edit Profile Information
                </h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-400 mb-4 font-sans leading-relaxed">
                  Update your employee details below.
                </p>
                <form onSubmit={handleSaveInfo} className="space-y-4 font-sans text-xs">
                  <div>
                    <label htmlFor="edit-name" className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                      Full Name
                    </label>
                    <input
                      id="edit-name"
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-role" className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                      Role
                    </label>
                    <input
                      id="edit-role"
                      type="text"
                      value={editRole}
                      disabled
                      readOnly
                      className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-100 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 cursor-not-allowed font-medium opacity-80"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-email" className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                      Email
                    </label>
                    <input
                      id="edit-email"
                      type="email"
                      value={editEmail}
                      disabled
                      readOnly
                      className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-100 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 cursor-not-allowed font-medium opacity-80"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-phone" className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                      Phone
                    </label>
                    <input
                      id="edit-phone"
                      type="text"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                      required
                    />
                  </div>

                  {otpError && <p className="text-[11px] font-bold text-red-500 font-sans">{otpError}</p>}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowInfoModal(false)}
                      className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 text-slate-640 dark:text-slate-400 rounded-xl font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-all active:scale-95 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSendingOtp}
                      className="flex-1 py-2 bg-dine-orange text-white rounded-xl font-bold hover:bg-orange-600 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      {isSendingOtp ? 'Sending OTP...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Image Cropper Modal */}
      <ImageCropperModal
        isOpen={showCropModal}
        imageSrc={cropImageSrc}
        onClose={() => setShowCropModal(false)}
        onConfirm={handleCropConfirm}
      />
    </>
  );
}
