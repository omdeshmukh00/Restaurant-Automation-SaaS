import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCleaning } from '../hooks/usecleaning';
import ImageCropperModal from '../../customer/components/dashboard/ImageCropperModal';
import { useAuth } from '../../../auth/AuthProvider';
import { useToast } from '../components/dashboard/Toast';
import { cleaningStore } from '../store/cleaning.store';
import { useTranslation } from '../hooks/useTranslation';
import { apiClient } from '../../../shared/services/apiClient';
import { useTheme, ThemeMode } from '../../../app/providers/ThemeProvider';

export default function CleaningProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dynamic system telemetry
  const { urgentTasks, profile, updateProfile, requestMobileOtp } = useCleaning();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'system'>('profile');
  const [tableList, setTableList] = useState(cleaningStore.tables);
  const [activitiesList, setActivitiesList] = useState(cleaningStore.activities);

  // App Settings state
  const [urgentAlerts, setUrgentAlerts] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cleanserve-settings-urgentAlerts');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });

  const [taskReminders, setTaskReminders] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cleanserve-settings-taskReminders');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });

  const [shiftAlerts, setShiftAlerts] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cleanserve-settings-shiftAlerts');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });

  useEffect(() => {
    const unsubscribe = cleaningStore.subscribe(() => {
      setTableList([...cleaningStore.tables]);
      setActivitiesList([...cleaningStore.activities]);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('cleanserve-settings-urgentAlerts', String(urgentAlerts));
  }, [urgentAlerts]);

  useEffect(() => {
    localStorage.setItem('cleanserve-settings-taskReminders', String(taskReminders));
  }, [taskReminders]);

  useEffect(() => {
    localStorage.setItem('cleanserve-settings-shiftAlerts', String(shiftAlerts));
  }, [shiftAlerts]);

  // Edit Modals states
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState('');

  // Info Modal Form states
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [userEnteredOtp, setUserEnteredOtp] = useState('');
  const [otpError, setOtpError] = useState('');

  // Password Modal states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const openInfoModal = () => {
    setEditName(profile.name);
    setEditEmail(profile.email);
    setEditPhone(profile.phone);
    setShowOtpInput(false);
    setUserEnteredOtp('');
    setOtpError('');
    setShowInfoModal(true);
  };

  const openPasswordModal = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setShowPasswordModal(true);
  };

  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editPhone !== profile.phone && !showOtpInput) {
      try {
        const res = await requestMobileOtp(editPhone);
        if (res.success && res.data?.otpSent) {
          const receivedOtp = res.data.otp || '';
          setOtpCode(receivedOtp);
          setShowOtpInput(true);
          setOtpError('');
          showToast("Verification code generated. Please check the backend terminal logs.", "info");
        } else {
          setOtpError(res.error || "Failed to generate verification code.");
        }
      } catch (err) {
        setOtpError("Error requesting verification code.");
      }
      return;
    }

    if (showOtpInput) {
      if (userEnteredOtp !== otpCode) {
        setOtpError("Invalid verification code. Please check the terminal logs.");
        return;
      }
      setShowOtpInput(false);
    }

    try {
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
        email: editEmail,
        phone: editPhone,
        mobileOtp: showOtpInput ? userEnteredOtp : undefined,
      } as any);
      setShowInfoModal(false);
      showToast("Profile information updated successfully!", "success");
    } catch (err) {
      showToast("Failed to update profile.", "error");
    }
  };

  const handleSavePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match!");
      return;
    }
    setPasswordError('');
    showToast("Password updated successfully!", "success");
    setShowPasswordModal(false);
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

  // Get user initials
  const initials = (profile.name || 'Riya Service')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase();

  return (
    <div className="max-w-5xl space-y-6 animate-fadeIn cleaning-panel">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 dark:text-slate-100 font-sans tracking-tight">
          Settings
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-sans mt-1">
          Manage your personal profile, notification preferences, and system settings.
        </p>
      </div>

      {/* Main Settings Grid */}
      <div className="grid grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Left Sidebar Navigation Tabs */}
        <div className="col-span-12 md:col-span-4 lg:col-span-3 space-y-2">
          <button
            onClick={() => setActiveTab('profile')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-xs font-bold font-sans transition-all text-left cursor-pointer border ${
              activeTab === 'profile'
                ? 'bg-orange-500/10 text-orange-500 border-orange-500/40 dark:bg-orange-950/30 dark:text-orange-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">person</span>
            Profile Settings
          </button>

          <button
            onClick={() => setActiveTab('notifications')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-xs font-bold font-sans transition-all text-left cursor-pointer border ${
              activeTab === 'notifications'
                ? 'bg-orange-500/10 text-orange-500 border-orange-500/40 dark:bg-orange-950/30 dark:text-orange-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">notifications</span>
            Notification Preferences
          </button>

          <button
            onClick={() => setActiveTab('system')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-xs font-bold font-sans transition-all text-left cursor-pointer border ${
              activeTab === 'system'
                ? 'bg-orange-500/10 text-orange-500 border-orange-500/40 dark:bg-orange-950/30 dark:text-orange-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">tune</span>
            System Preferences
          </button>
        </div>

        {/* Right Main Card Content */}
        <div className="col-span-12 md:col-span-8 lg:col-span-9 max-w-2xl">
          {activeTab === 'profile' && (
            <div className="bg-white dark:bg-sd-surface-container rounded-3xl border border-slate-100 dark:border-slate-800 p-6 md:p-8 shadow-sm flex flex-col justify-between min-h-[360px]">
              <div>
                {/* Profile Top Row */}
                <div className="flex items-start justify-between gap-4 pb-6">
                  <div className="flex items-center gap-4">
                    <div className="relative group shrink-0">
                      {profile.avatar ? (
                        <img
                          src={profile.avatar}
                          alt={profile.name}
                          className="w-16 h-16 rounded-full object-cover border-2 border-orange-500/40"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-orange-950/40 border-2 border-orange-500/40 text-orange-400 font-extrabold text-xl flex items-center justify-center">
                          {initials}
                        </div>
                      )}
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handlePhotoChange}
                        accept="image/*"
                        className="hidden"
                      />
                      <button
                        onClick={handlePhotoClick}
                        className="absolute bottom-0 right-0 w-5 h-5 bg-orange-500 text-white rounded-full flex items-center justify-center shadow-md cursor-pointer hover:scale-105 transition-transform"
                        title="Upload Photo"
                      >
                        <span className="material-symbols-outlined text-[12px]">photo_camera</span>
                      </button>
                    </div>

                    <div>
                      <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 font-sans">
                        {profile.name}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-sans mt-0.5">
                        {profile.role || 'Floor Supervisor'} • ID: {profile.id || 'EMP-9021'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={openInfoModal}
                    className="p-1.5 text-slate-400 hover:text-orange-500 transition-colors rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    title="Edit Profile"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                </div>

                {/* 4 Info Boxes Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-4 font-sans text-xs">
                  <div className="p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30 space-y-0.5">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                      Assigned Zone
                    </p>
                    <p className="font-extrabold text-slate-800 dark:text-slate-200">
                      {profile.preferredArea || 'Zone A (Tables 1-8)'}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30 space-y-0.5">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                      Email Address
                    </p>
                    <p className="font-extrabold text-slate-800 dark:text-slate-200 truncate">
                      {profile.email}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30 space-y-0.5">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                      Phone Number
                    </p>
                    <p className="font-extrabold text-slate-800 dark:text-slate-200">
                      {profile.phone}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30 space-y-0.5">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                      Joined Platform
                    </p>
                    <p className="font-extrabold text-slate-800 dark:text-slate-200">
                      {profile.joinedOn}
                    </p>
                  </div>
                </div>
              </div>

              {/* Logout Button Bottom Right */}
              <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => signOut()}
                  className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 px-4 py-2 rounded-2xl text-xs font-bold font-sans transition-all active:scale-95 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">logout</span>
                  Logout
                </button>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="bg-white dark:bg-sd-surface-container rounded-3xl border border-slate-100 dark:border-slate-800 p-6 md:p-8 shadow-sm space-y-6 min-h-[360px]">
              <div>
                <h3 className="text-base md:text-lg font-extrabold text-slate-800 dark:text-slate-100 font-sans">
                  Notification Preferences
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-400 font-sans mt-0.5">
                  Control sound, vibration, and push notification alerts for your shift assignments.
                </p>
              </div>

              <div className="space-y-4 font-sans text-xs">
                <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800/60">
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-200">Customer Assistance Calls</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Vibrate or sound when a guest calls for waiter assistance at assigned tables.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUrgentAlerts(!urgentAlerts)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      urgentAlerts ? 'bg-orange-500' : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                  >
                    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                      urgentAlerts ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800/60">
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-200">Food Ready Notifications</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Alert immediately when food dishes are marked ready by kitchen chefs.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTaskReminders(!taskReminders)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      taskReminders ? 'bg-orange-500' : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                  >
                    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                      taskReminders ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800/60">
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-200">System Warnings & Alerts</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Receive shift reassignments or high table delay warnings from supervisors.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShiftAlerts(!shiftAlerts)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      shiftAlerts ? 'bg-orange-500' : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                  >
                    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                      shiftAlerts ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'system' && (
            <div className="bg-white dark:bg-sd-surface-container rounded-3xl border border-slate-100 dark:border-slate-800 p-6 md:p-8 shadow-sm space-y-6 min-h-[360px]">
              <div>
                <h3 className="text-base md:text-lg font-extrabold text-slate-800 dark:text-slate-100 font-sans">
                  System Preferences
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-400 font-sans mt-0.5">
                  Configure application theme mode and security settings.
                </p>
              </div>

              {/* Display Theme */}
              <div className="space-y-3 font-sans text-xs">
                <p className="font-extrabold text-slate-800 dark:text-slate-200">Display Theme</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'light', label: 'Light Mode', icon: 'light_mode' },
                    { id: 'dark', label: 'Dark Mode', icon: 'dark_mode' },
                    { id: 'system', label: 'System Theme', icon: 'desktop_windows' }
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setTheme(item.id as ThemeMode)}
                      className={`flex flex-col items-center justify-center p-3 rounded-2xl border font-sans text-xs font-bold transition-all gap-1.5 cursor-pointer ${
                        theme === item.id
                          ? 'border-orange-500 bg-orange-500/10 text-orange-500 dark:bg-slate-800 dark:text-white dark:border-slate-600'
                          : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 bg-slate-50 dark:bg-slate-800/40'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- MODALS --- */}

      {/* Edit Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-sd-surface-container rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-xl w-full max-w-md">
            <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 mb-1 font-sans">{t('editProfileInfo')}</h3>
            <p className="text-[11px] text-slate-400 mb-4 font-sans leading-relaxed">{t('updatePersonalDetails')}</p>
            <form onSubmit={handleSaveInfo} className="space-y-4 font-sans text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5">{t('fullName')}</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5">{t('email')}</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5">{t('phone')}</label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  required
                />
              </div>

              {showOtpInput && (
                <div className="p-3 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/30 rounded-xl space-y-2">
                  <label className="block font-bold text-orange-600 dark:text-orange-400">Verification OTP Code</label>
                  <input
                    type="text"
                    placeholder="Enter 6-digit OTP"
                    value={userEnteredOtp}
                    onChange={(e) => setUserEnteredOtp(e.target.value)}
                    className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono text-center tracking-widest text-sm"
                  />
                  {otpError && <p className="text-[10px] text-red-500 font-bold">{otpError}</p>}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInfoModal(false)}
                  className="flex-1 py-2 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold shadow-md"
                >
                  {showOtpInput ? "Verify & Save" : t('saveChanges')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Cropper Modal */}
      {showCropModal && cropImageSrc && (
        <ImageCropperModal
          isOpen={showCropModal}
          imageSrc={cropImageSrc}
          onClose={() => setShowCropModal(false)}
          onConfirm={handleCropConfirm}
        />
      )}
    </div>
  );
}