import React, { useState } from 'react';
import { useAuth } from '../../../auth/AuthProvider';
import { apiClient } from '../../../shared/services/apiClient';
import { Shield, Eye, EyeOff, Check, AlertCircle, CheckCircle, Lock } from 'lucide-react';
import { setAccessToken, setStoredRole, setStoredUser } from '../../../auth/tokenStore';

export default function ResetPasswordPage() {
  const { signOutAll } = useAuth();
  
  const [temporaryPassword, setTemporaryPassword] = useState(() => {
    return sessionStorage.getItem('last_used_password') || '';
  });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Visibility states
  const [showTemp, setShowTemp] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Status states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Realtime password checks
  const checks = {
    length: newPassword.length >= 8,
    upper: /[A-Z]/.test(newPassword),
    lower: /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[^A-Za-z0-9\s]/.test(newPassword),
  };

  const isPasswordValid = Object.values(checks).every(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!temporaryPassword || !newPassword || !confirmPassword) {
      setErrorMsg('Please fill in all fields.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('New passwords do not match.');
      return;
    }

    if (!isPasswordValid) {
      setErrorMsg('Please satisfy all password complexity requirements.');
      return;
    }

    setLoading(true);

    try {
      const response = await apiClient.post('/auth/reset-first-login-password', {
        temporaryPassword,
        newPassword,
        confirmPassword,
      });

      const data = response.data?.data;
      if (data?.user && data?.accessToken) {
        const panel = data.panel || 'admin';
        setStoredRole(panel, data.user.role);
        setStoredUser(panel, { ...data.user, panel });
        setAccessToken(panel, data.accessToken);
        
        sessionStorage.removeItem('last_used_password');
        setSuccess(true);
        
        setTimeout(() => {
          window.location.href = '/admin';
        }, 1500);
      } else {
        setSuccess(true);
        sessionStorage.removeItem('last_used_password');
        
        // Auto log out after 3 seconds
        setTimeout(() => {
          signOutAll();
          window.location.href = '/auth/admin';
        }, 3000);
      }
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Failed to reset password.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Success state (still a full-screen modal overlay) ──
  if (success) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        {/* Blurred backdrop */}
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />

        {/* Success card */}
        <div className="relative w-full max-w-md bg-white border border-slate-200/80 rounded-3xl p-8 text-center space-y-6 shadow-2xl animate-in fade-in zoom-in duration-300">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto shadow-sm border border-emerald-100">
            <CheckCircle className="w-8 h-8" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-800">Password Reset Successful!</h2>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
              Your password has been changed. For security reasons, you have been logged out of all active sessions.
            </p>
          </div>

          <div className="text-xs text-slate-400 animate-pulse">
            Redirecting to Admin Login in 3 seconds...
          </div>
        </div>
      </div>
    );
  }

  // ── Main modal overlay ──
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Blurred backdrop — covers entire screen including sidebar/header */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />

      {/* Reset credentials card */}
      <div className="relative w-full max-w-md bg-white border border-slate-200/80 rounded-[2rem] p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in duration-300">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center mx-auto shadow-sm border border-orange-100">
            <Shield className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Reset Credentials</h2>
          <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
            This is your first login. You must update your temporary credentials to secure your account.
          </p>
        </div>

        {/* Error Message */}
        {errorMsg && (
          <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-600">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Temporary Password */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Temporary Password
            </label>
            <div className="relative">
              <input
                type={showTemp ? 'text' : 'password'}
                value={temporaryPassword}
                onChange={(e) => setTemporaryPassword(e.target.value)}
                placeholder="Paste temporary password from email"
                className="w-full bg-white border border-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 rounded-xl pl-4 pr-10 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowTemp(!showTemp)}
                className="absolute right-3.5 top-2.5 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showTemp ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter strong password"
                className="w-full bg-white border border-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 rounded-xl pl-4 pr-10 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3.5 top-2.5 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm New Password */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full bg-white border border-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 rounded-xl pl-4 pr-10 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3.5 top-2.5 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Password Strength Checklist */}
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-slate-400" />
              Password requirements:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
              <div className="flex items-center gap-2 text-[10px]">
                <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${checks.length ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                  <Check className="w-2.5 h-2.5" />
                </div>
                <span className={checks.length ? 'text-slate-700 font-medium' : 'text-slate-400'}>At least 8 characters</span>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${checks.upper ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                  <Check className="w-2.5 h-2.5" />
                </div>
                <span className={checks.upper ? 'text-slate-700 font-medium' : 'text-slate-400'}>One uppercase letter</span>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${checks.lower ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                  <Check className="w-2.5 h-2.5" />
                </div>
                <span className={checks.lower ? 'text-slate-700 font-medium' : 'text-slate-400'}>One lowercase letter</span>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${checks.number ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                  <Check className="w-2.5 h-2.5" />
                </div>
                <span className={checks.number ? 'text-slate-700 font-medium' : 'text-slate-400'}>One number (0-9)</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] sm:col-span-2">
                <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${checks.special ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                  <Check className="w-2.5 h-2.5" />
                </div>
                <span className={checks.special ? 'text-slate-700 font-medium' : 'text-slate-400'}>One special character (!@#...)</span>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-[#FF6B1A] hover:bg-orange-600 text-white font-bold text-xs shadow-md shadow-orange-500/15 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none transition-all duration-200"
          >
            {loading ? 'Updating Credentials...' : 'Save & Update Credentials'}
          </button>
        </form>
      </div>
    </div>
  );
}
