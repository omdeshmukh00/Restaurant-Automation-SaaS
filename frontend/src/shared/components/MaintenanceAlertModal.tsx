import { useState, useEffect } from "react";
import { AlertTriangle, Lock, ShieldAlert, X } from "lucide-react";

interface MaintenanceAlertModalProps {
  isOpen: boolean;
  onClose?: () => void;
  title?: string;
  message?: string;
  type?: "maintenance" | "registration_blocked";
  darkMode?: boolean;
}

export default function MaintenanceAlertModal({
  isOpen,
  onClose,
  title,
  message,
  type = "maintenance",
  darkMode,
}: MaintenanceAlertModalProps) {
  // Theme auto-detection fallback if darkMode prop is not explicitly passed
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (darkMode !== undefined) return darkMode;
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("theme");
      if (savedTheme) return savedTheme === "dark";
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });

  useEffect(() => {
    if (darkMode !== undefined) {
      setIsDark(darkMode);
    }
  }, [darkMode]);

  if (!isOpen) return null;

  const isRegistrationBlocked = type === "registration_blocked";
  const defaultTitle = isRegistrationBlocked
    ? "Registration Currently Blocked"
    : "Platform Under Temporary Maintenance";

  const defaultMessage = isRegistrationBlocked
    ? "Due to a temporary issue, new restaurant registration is currently blocked. Please try again later or contact support."
    : "Due to a temporary maintenance issue, this platform service is currently disabled. Please try again later.";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-fadeIn">
      {/* Backdrop */}
      <div
        className={`fixed inset-0 backdrop-blur-md z-0 transition-opacity ${
          isDark ? "bg-slate-950/85" : "bg-slate-900/40"
        }`}
      />

      {/* Modal Card */}
      <div
        className={`relative w-full max-w-md rounded-2xl border p-6 shadow-2xl z-10 text-center animate-scaleUp transition-colors ${
          isDark
            ? "bg-slate-950 border-slate-800 text-white shadow-black"
            : "bg-white border-slate-200 text-slate-900 shadow-slate-300/40"
        }`}
      >
        {onClose && (
          <button
            onClick={onClose}
            className={`absolute right-4 top-4 p-1.5 rounded-lg border transition-all ${
              isDark
                ? "border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900"
                : "border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <X size={15} />
          </button>
        )}

        <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mb-4 shadow-lg shadow-amber-500/10">
          {isRegistrationBlocked ? <Lock size={26} /> : <ShieldAlert size={26} />}
        </div>

        <h3 className={`text-lg font-black tracking-tight mb-2 ${isDark ? "text-white" : "text-slate-900"}`}>
          {title || defaultTitle}
        </h3>

        <p className={`text-xs leading-relaxed mb-6 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
          {message || defaultMessage}
        </p>

        <div
          className={`flex items-center justify-center gap-2 text-[11px] font-semibold py-2.5 px-4 rounded-xl border ${
            isDark
              ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
              : "bg-amber-500/10 border-amber-500/30 text-amber-700"
          }`}
        >
          <AlertTriangle size={14} className="shrink-0 text-amber-500" />
          <span>Wait for activation, of the panel.</span>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className={`w-full mt-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${
              isDark
                ? "bg-slate-900 hover:bg-slate-800 text-white border-slate-800"
                : "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200"
            }`}
          >
            Understood
          </button>
        )}
      </div>
    </div>
  );
}
