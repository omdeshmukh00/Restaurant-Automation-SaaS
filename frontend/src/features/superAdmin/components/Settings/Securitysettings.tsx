// src/features/superAdmin/components/Settings/SecuritySettings.tsx
import { useState } from "react";
import {
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  MonitorSmartphone,
  AlertCircle,
  Trash2,
  KeyRound,
  Check,
  RefreshCw,
} from "lucide-react";
import {
  Card,
  CardTitle,
  Field,
  Input,
  Select,
  ToggleRow,
} from "./Settingsui";
import { apiClient } from "../../../../shared/services/apiClient";

interface SecuritySettingsProps {
  darkMode: boolean;
}

function detectCurrentDevice(): string {
  if (typeof window === "undefined") return "Chrome on Windows";
  const ua = navigator.userAgent;
  let browser = "Browser";
  if (ua.includes("Chrome") && !ua.includes("Edg")) browser = "Chrome";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
  else if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Edg")) browser = "Edge";

  let os = "Device";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac OS X")) os = "macOS";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("Linux")) os = "Linux";

  return `${browser} on ${os}`;
}

export default function SecuritySettings({ darkMode }: SecuritySettingsProps) {
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });
  const [pwError, setPwError] = useState("");
  const [pwSaved, setPwSaved] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  const [twoFA, setTwoFA] = useState({ enabled: false, method: "authenticator" });

  const currentDevice = detectCurrentDevice();
  const [sessions, setSessions] = useState([
    { id: 1, device: currentDevice, location: "Active Device", time: "Active now", current: true },
  ]);

  const handleChangePw = async () => {
    setPwError("");
    setPwSaved(false);

    if (!passwords.current) {
      setPwError("Enter your current password.");
      return;
    }
    if (passwords.next.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }
    if (passwords.next !== passwords.confirm) {
      setPwError("Passwords don't match.");
      return;
    }

    setPwLoading(true);
    try {
      await apiClient.patch("/users/me/password", {
        currentPassword: passwords.current,
        newPassword: passwords.next,
      });
      setPwSaved(true);
      setPasswords({ current: "", next: "", confirm: "" });
      setTimeout(() => setPwSaved(false), 3000);
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        "Failed to update password.";
      setPwError(msg);
    } finally {
      setPwLoading(false);
    }
  };

  const revokeSession = (id: number) =>
    setSessions((s) => s.filter((sess) => sess.id !== id));

  const pwStrength =
    passwords.next.length >= 12
      ? 4
      : passwords.next.length >= 10
      ? 3
      : passwords.next.length >= 8
      ? 2
      : passwords.next.length > 0
      ? 1
      : 0;

  const strengthLabel = ["", "Too short", "Moderate", "Good", "Strong"][pwStrength];
  const strengthColor = [
    "",
    "text-red-400",
    "text-amber-400",
    "text-orange-400",
    "text-emerald-500",
  ][pwStrength];
  const barColor = [
    "",
    "bg-red-400",
    "bg-amber-400",
    "bg-orange-400",
    "bg-emerald-500",
  ][pwStrength];

  return (
    <div className="space-y-5">
      {/* Change Password */}
      <Card darkMode={darkMode}>
        <CardTitle darkMode={darkMode}>Change Password</CardTitle>

        <Field label="Current Password" icon={Lock} darkMode={darkMode}>
          <div className="relative">
            <Input
              darkMode={darkMode}
              type={showPw.current ? "text" : "password"}
              value={passwords.current}
              onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
              placeholder="Enter current password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPw((p) => ({ ...p, current: !p.current }))}
              className={`absolute right-3 top-1/2 -translate-y-1/2 ${
                darkMode ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {showPw.current ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="New Password" icon={Lock} darkMode={darkMode}>
            <div className="relative">
              <Input
                darkMode={darkMode}
                type={showPw.next ? "text" : "password"}
                value={passwords.next}
                onChange={(e) => setPasswords({ ...passwords, next: e.target.value })}
                placeholder="Min 8 characters"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPw((p) => ({ ...p, next: !p.next }))}
                className={`absolute right-3 top-1/2 -translate-y-1/2 ${
                  darkMode ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {showPw.next ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </Field>
          <Field label="Confirm Password" icon={Lock} darkMode={darkMode}>
            <div className="relative">
              <Input
                darkMode={darkMode}
                type={showPw.confirm ? "text" : "password"}
                value={passwords.confirm}
                onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                placeholder="Repeat new password"
                className="pr-10"
                onPaste={(e) => e.preventDefault()}
                onDrop={(e) => e.preventDefault()}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPw((p) => ({ ...p, confirm: !p.confirm }))}
                className={`absolute right-3 top-1/2 -translate-y-1/2 ${
                  darkMode ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {showPw.confirm ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className={`text-[10px] mt-1 ${darkMode ? "text-slate-500" : "text-slate-400"}`}>
              Please re-enter your password manually.
            </p>
          </Field>
        </div>

        {passwords.next && (
          <div className="space-y-1.5">
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((level) => (
                <div
                  key={level}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    level <= pwStrength ? barColor : darkMode ? "bg-slate-800" : "bg-slate-200"
                  }`}
                />
              ))}
            </div>
            <p className={`text-[10px] font-medium ${strengthColor}`}>{strengthLabel}</p>
          </div>
        )}

        {pwError && (
          <div className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
            <AlertCircle size={13} className="shrink-0" />
            {pwError}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleChangePw}
            disabled={pwLoading}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md ${
              pwSaved
                ? "bg-emerald-600 text-white border border-emerald-500 shadow-emerald-500/20"
                : "bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white border border-orange-400/30 shadow-orange-500/25 active:scale-95"
            }`}
          >
            {pwLoading ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>Updating Password...</span>
              </>
            ) : pwSaved ? (
              <>
                <Check size={14} />
                <span>Password Updated!</span>
              </>
            ) : (
              <>
                <Lock size={13} />
                <span>Update Password</span>
              </>
            )}
          </button>
        </div>
      </Card>

      {/* Two-Factor Authentication */}
      <Card darkMode={darkMode}>
        <div className="flex items-center justify-between mb-1">
          <CardTitle darkMode={darkMode}>Two-Factor Authentication</CardTitle>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              twoFA.enabled
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : darkMode
                ? "bg-slate-800 text-slate-500"
                : "bg-slate-100 text-slate-400"
            }`}
          >
            {twoFA.enabled ? "Enabled" : "Disabled"}
          </span>
        </div>

        <ToggleRow
          darkMode={darkMode}
          label="Enable 2FA"
          description="Add a second layer of security to your admin account."
          checked={twoFA.enabled}
          onChange={(v) => setTwoFA({ ...twoFA, enabled: v })}
        />

        {twoFA.enabled && (
          <Field label="2FA Method" icon={ShieldCheck} darkMode={darkMode}>
            <Select
              darkMode={darkMode}
              value={twoFA.method}
              onChange={(e) => setTwoFA({ ...twoFA, method: e.target.value })}
            >
              <option value="authenticator">Authenticator App (TOTP)</option>
              <option value="sms">SMS Code</option>
              <option value="email">Email OTP</option>
            </Select>
          </Field>
        )}

        {twoFA.enabled && (
          <div
            className={`rounded-xl p-3.5 text-xs flex items-start gap-2.5 ${
              darkMode
                ? "bg-slate-900 text-slate-400 border border-slate-800"
                : "bg-slate-50 text-slate-500 border border-slate-200"
            }`}
          >
            <KeyRound size={13} className="text-orange-400 mt-0.5 shrink-0" />
            <span>Scan the QR code in your authenticator app to complete setup. Recovery codes will be shown once.</span>
          </div>
        )}
      </Card>

      {/* Active Sessions */}
      <Card darkMode={darkMode}>
        <div className="flex items-center justify-between">
          <CardTitle darkMode={darkMode}>Active Sessions</CardTitle>
          <MonitorSmartphone size={14} className="text-orange-400" />
        </div>

        <div className="space-y-3">
          {sessions.map((sess) => (
            <div
              key={sess.id}
              className={`flex items-center justify-between rounded-xl px-4 py-3 border ${
                sess.current
                  ? darkMode
                    ? "border-orange-500/20 bg-orange-500/5"
                    : "border-orange-200 bg-orange-50"
                  : darkMode
                  ? "border-slate-800 bg-slate-900/40"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <div>
                <p className={`text-xs font-semibold ${darkMode ? "text-slate-200" : "text-slate-800"}`}>
                  {sess.device}
                  {sess.current && (
                    <span className="ml-2 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                      This Device
                    </span>
                  )}
                </p>
                <p className={`text-[11px] mt-0.5 ${darkMode ? "text-slate-500" : "text-slate-400"}`}>
                  {sess.location} · {sess.time}
                </p>
              </div>
              {!sess.current && (
                <button
                  onClick={() => revokeSession(sess.id)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    darkMode
                      ? "text-red-400/60 hover:text-red-400 hover:bg-red-500/10"
                      : "text-red-400 hover:text-red-600 hover:bg-red-50"
                  }`}
                  title="Revoke session">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>

        {sessions.filter((s) => !s.current).length > 0 && (
          <button
            onClick={() => setSessions((s) => s.filter((sess) => sess.current))}
            className={`w-full mt-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
              darkMode
                ? "border-red-500/20 text-red-400/70 hover:text-red-400 hover:bg-red-500/10"
                : "border-red-200 text-red-400 hover:text-red-600 hover:bg-red-50"
            }`}
          >
            Revoke All Other Sessions
          </button>
        )}
      </Card>
    </div>
  );
}