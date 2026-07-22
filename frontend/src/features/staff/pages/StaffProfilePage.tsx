import React, { useState, useRef } from 'react';
import { useStaffProfile } from '../hooks/useStaffProfile';
import ImageCropperModal from '../../customer/components/dashboard/ImageCropperModal';
import { useAuth } from '../../../auth/AuthProvider';
import { apiClient } from '../../../shared/services/apiClient';

export default function StaffProfilePage() {
  const { signOut } = useAuth();
  const { profile, updateProfile } = useStaffProfile();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showCropModal, setShowCropModal] = useState(false);

  // Info Modal states
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editId, setEditId] = useState('');
  const [editSection, setEditSection] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');

  // Cropper states
  const [cropImageSrc, setCropImageSrc] = useState('');

  const openInfoModal = () => {
    setEditName(profile.name);
    setEditRole(profile.role);
    setEditId(profile.id);
    setEditSection(profile.section);
    setEditPhone(profile.phone);
    setEditEmail(profile.email);
    setShowInfoModal(true);
  };

  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
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

  interface ScheduleItem {
    day: string;
    shift: string;
    defaultStatus: string;
  }

  const [scheduleData, setScheduleData] = useState<ScheduleItem[]>(() => {
    const defaults = [
      { day: 'Monday', shift: '04:00 PM - 11:00 PM', defaultStatus: 'Upcoming' },
      { day: 'Tuesday', shift: '04:00 PM - 11:00 PM', defaultStatus: 'Upcoming' },
      { day: 'Wednesday', shift: '04:00 PM - 11:00 PM', defaultStatus: 'Upcoming' },
      { day: 'Thursday', shift: 'Weekly Off', defaultStatus: 'Off' },
      { day: 'Friday', shift: '04:00 PM - 11:00 PM', defaultStatus: 'Upcoming' },
      { day: 'Saturday', shift: '12:00 PM - 11:00 PM (Double Shift)', defaultStatus: 'Upcoming' },
      { day: 'Sunday', shift: '12:00 PM - 09:00 PM', defaultStatus: 'Upcoming' },
    ];
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dineease-staff-schedule');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { return defaults; }
      }
    }
    return defaults;
  });

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [tempShifts, setTempShifts] = useState<Record<string, string>>({});

  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayIndex = new Date().getDay(); // 0 is Sunday, 1 is Monday...

  const schedule = scheduleData.map(item => {
    const itemDayIndex = weekdays.indexOf(item.day);
    const adjustedItemIdx = itemDayIndex === 0 ? 7 : itemDayIndex;
    const adjustedTodayIdx = todayIndex === 0 ? 7 : todayIndex;

    let status = 'Upcoming';
    let dayLabel = item.day;

    const isOff = item.shift.toLowerCase().includes('off');

    if (isOff) {
      status = 'Off';
    } else if (adjustedItemIdx === adjustedTodayIdx) {
      status = 'Active';
      dayLabel = `${item.day} (Today)`;
    } else if (adjustedItemIdx < adjustedTodayIdx) {
      status = 'Completed';
    }

    return {
      day: dayLabel,
      shift: item.shift,
      status
    };
  });

  return (
    <>
      <div className="space-y-6 animate-fadeIn">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 font-sans tracking-tight">My Profile</h1>
          <p className="text-sm text-slate-550 mt-0.5">Manage your shift schedules, profile, and status.</p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Side: Profile Card */}
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between relative dark:bg-sd-surface-container dark:border-sd-outline-variant/40">
            {/* Edit Pencil Button */}
            <button
              onClick={openInfoModal}
              className="absolute top-4 right-4 text-slate-400 hover:text-dine-orange transition-colors cursor-pointer focus:outline-none"
              title="Edit Profile Information"
            >
              <span className="material-symbols-outlined text-[18px]">edit</span>
            </button>

            <div className="text-center space-y-4">
              <button
                onClick={handlePhotoClick}
                className="w-24 h-24 rounded-full bg-dine-orange/15 hover:scale-105 transition-transform mx-auto flex items-center justify-center text-dine-orange font-black text-3xl shadow-sm border border-dine-orange/10 overflow-hidden cursor-pointer relative group focus:outline-none"
                title="Change Photo"
              >
                {profile.avatar ? (
                  <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover" />
                ) : (
                  profile.name.split(' ').map(n => n[0]).join('').toUpperCase()
                )}
                {/* Overlay camera icon on hover */}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="material-symbols-outlined text-white text-[20px]">photo_camera</span>
                </div>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handlePhotoChange}
                accept="image/*"
                className="hidden"
              />

              <div>
                <h2 className="font-extrabold text-lg text-slate-850 dark:text-slate-150 font-sans">{profile.name}</h2>
                <p className="text-xs text-slate-455 dark:text-slate-400 font-sans mt-0.5">{profile.role} ({profile.id})</p>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-green-50 text-green-650 dark:bg-green-950/40 dark:text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                {profile.status}
              </div>
            </div>

            <div className="mt-8 space-y-3 border-t border-slate-100 dark:border-sd-outline-variant/40 pt-4 text-xs font-sans">
              <div className="flex justify-between">
                <span className="text-slate-455 dark:text-slate-400">Assigned Section:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{profile.section}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-455 dark:text-slate-400">Email:</span>
                <span className="font-bold text-slate-850 dark:text-slate-200 truncate max-w-[150px]" title={profile.email}>{profile.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-455 dark:text-slate-400">Phone:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{profile.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-455 dark:text-slate-400">Joined DineEase:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{profile.joined}</span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-8 pt-4 border-t border-slate-100 dark:border-sd-outline-variant/40 space-y-2.5">
              <button
                onClick={() => alert('Break request submitted to manager.')}
                className="w-full border border-slate-200 dark:border-sd-outline-variant/60 dark:text-slate-300 hover:border-dine-orange hover:text-dine-orange font-bold text-xs py-2.5 px-4 rounded-xl transition-all cursor-pointer"
              >
                Request Break
              </button>
              <button
                onClick={() => alert('Clocked out successfully. Enjoy your rest!')}
                className="w-full bg-red-500 hover:bg-red-650 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-md transition-all cursor-pointer"
              >
                Clock Out
              </button>
              <button
                onClick={() => signOut()}
                className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs py-2.5 px-4 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">logout</span>
                Logout
              </button>
            </div>
          </div>

          {/* Right Side: Shift Schedule */}
          <div className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm dark:bg-sd-surface-container dark:border-sd-outline-variant/40">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-sd-outline-variant/40">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-dine-orange">calendar_month</span>
                <h2 className="font-bold text-base text-slate-850 dark:text-slate-150 font-sans">Shift Schedule</h2>
              </div>
              <button
                onClick={() => {
                  setTempShifts(scheduleData.reduce((acc: Record<string, string>, curr) => ({ ...acc, [curr.day]: curr.shift }), {}));
                  setShowScheduleModal(true);
                }}
                className="text-dine-orange hover:text-orange-655 font-bold text-xs flex items-center gap-1 transition-all border-none bg-transparent cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">edit_calendar</span>
                Edit Schedule
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {schedule.map((sch, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                    sch.status === 'Active'
                      ? 'bg-dine-light-orange/30 border-dine-orange/30 dark:bg-orange-950/20 dark:border-dine-orange/40'
                      : 'bg-slate-50 border border-slate-100 dark:bg-sd-surface-container-low dark:border-sd-outline-variant/20'
                  }`}
                >
                  <div>
                    <p className="font-bold text-xs text-slate-800 dark:text-slate-200 font-sans">{sch.day}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-sans">{sch.shift}</p>
                  </div>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                    sch.status === 'Active' ? 'bg-orange-100 text-dine-orange dark:bg-orange-950/50 dark:text-orange-400 animate-pulse' :
                    sch.status === 'Off' ? 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400' :
                    sch.status === 'Completed' ? 'bg-green-105 text-green-600 dark:bg-green-950/40 dark:text-green-400' :
                    'bg-blue-50 text-blue-600 dark:bg-blue-950/40'
                  }`}>
                    {sch.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-sd-surface-container rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-xl w-full max-w-sm">
            <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 mb-1 font-sans">Edit Profile Information</h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-400 mb-4 font-sans leading-relaxed">
              Update your employee details below.
            </p>
            <form onSubmit={handleSaveInfo} className="space-y-4 font-sans text-xs">
              <div>
                <label htmlFor="edit-name" className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5">Full Name</label>
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
                <label htmlFor="edit-role" className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5">Role</label>
                <input
                  id="edit-role"
                  type="text"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  required
                />
              </div>
              <div>
                <label htmlFor="edit-id" className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5">Staff ID</label>
                <input
                  id="edit-id"
                  type="text"
                  value={editId}
                  onChange={(e) => setEditId(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  required
                />
              </div>
              <div>
                <label htmlFor="edit-section" className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5">Assigned Section</label>
                <input
                  id="edit-section"
                  type="text"
                  value={editSection}
                  onChange={(e) => setEditSection(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  required
                />
              </div>
              <div>
                <label htmlFor="edit-email" className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5">Email</label>
                <input
                  id="edit-email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  required
                />
              </div>
              <div>
                <label htmlFor="edit-phone" className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5">Phone</label>
                <input
                  id="edit-phone"
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  required
                />
              </div>
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
                  className="flex-1 py-2 bg-dine-orange text-white rounded-xl font-bold hover:bg-orange-600 transition-all active:scale-95 cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
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

      {/* Edit Shift Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-sd-surface-container rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-xl w-full max-w-md">
            <h3 className="font-extrabold text-sm text-slate-850 dark:text-slate-100 mb-1 font-sans">Modify Shift Schedule</h3>
            <p className="text-[11px] text-slate-400 mb-4 font-sans leading-relaxed">
              Update your shift durations for each weekday.
            </p>
            <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
              {scheduleData.map(item => (
                <div key={item.day} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="font-bold text-xs text-slate-700 dark:text-slate-350 w-24 shrink-0 font-sans">{item.day}</span>
                  <input
                    type="text"
                    value={tempShifts[item.day] || ''}
                    onChange={e => setTempShifts({ ...tempShifts, [item.day]: e.target.value })}
                    className="w-full sm:flex-1 p-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs"
                    placeholder="e.g. 04:00 PM - 11:00 PM or Weekly Off"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="flex-1 py-2 bg-slate-105 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const updatedData = scheduleData.map(item => ({
                    ...item,
                    shift: tempShifts[item.day] || item.shift
                  }));
                  setScheduleData(updatedData);
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('dineease-staff-schedule', JSON.stringify(updatedData));
                  }
                  setShowScheduleModal(false);
                }}
                className="flex-1 py-2 bg-dine-orange text-white rounded-xl font-bold hover:bg-orange-600 transition-all cursor-pointer border-none"
              >
                Save Shifts
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
