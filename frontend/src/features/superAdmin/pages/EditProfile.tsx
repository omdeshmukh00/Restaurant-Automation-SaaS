import { useState, useRef, useEffect } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  Camera,
  Save,
  Shield,
  Mail,
  Phone,
  MapPin,
  User,
  Lock,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Building2,
  Globe,
  Pencil,
  X,
} from "lucide-react";
import ImageCropperModal from "../../customer/components/dashboard/ImageCropperModal";
import { useAuth } from "../../../auth/AuthProvider";
import { setStoredUser } from "../../../auth/tokenStore";
import { apiClient } from "../../../shared/services/apiClient";
import { usePlatformSettingsGuard } from "../../../shared/hooks/usePlatformSettingsGuard";

interface OutletContext {
  darkMode: boolean;
}

interface FieldProps {
  label: string;
  icon: React.ElementType;
  darkMode: boolean;
  children: React.ReactNode;
  hint?: string;
}

function Field({ label, icon: Icon, darkMode, children, hint }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <div
        className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider ${
          darkMode ? "text-slate-400" : "text-slate-500"
        }`}
      >
        <Icon size={11} className="text-orange-400" />
        {label}
      </div>
      {children}
      {hint && (
        <p
          className={`text-[11px] ${
            darkMode ? "text-slate-600" : "text-slate-400"
          }`}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  darkMode: boolean;
}

function Input({ darkMode, className = "", ...props }: InputProps) {
  return (
    <input
      {...props}
      className={`w-full h-10 px-3.5 rounded-xl text-xs font-medium outline-none border transition-all duration-200 ${
        darkMode
          ? "bg-slate-900 border-slate-800 text-slate-100 focus:border-orange-500/60 placeholder:text-slate-600"
          : "bg-slate-50 border-slate-200 text-slate-800 focus:border-orange-400 focus:bg-white placeholder:text-slate-400"
      } ${className}`}
    />
  );
}

interface EditPersonalInfoModalProps {
  initialName: string;
  initialBio: string;
  darkMode: boolean;
  onClose: () => void;
  onSave: (name: string, bio: string) => void;
}

function EditPersonalInfoModal({
  initialName,
  initialBio,
  darkMode,
  onClose,
  onSave,
}: EditPersonalInfoModalProps) {
  const [name, setName] = useState(initialName);
  const [bio, setBio] = useState(initialBio);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 sm:pt-12 pb-6 px-4 overflow-y-auto bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div
        className={`w-full max-w-md max-h-[88vh] overflow-y-auto rounded-2xl border p-6 shadow-2xl space-y-5 ${
          darkMode ? "bg-slate-950 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">Edit Personal Information</h3>
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg text-slate-400 hover:text-slate-200 transition-colors ${
              darkMode ? "hover:bg-slate-800" : "hover:bg-slate-100"
            }`}
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <Field label="Name" icon={User} darkMode={darkMode} hint="Shown in the navbar and profile card.">
            <Input
              darkMode={darkMode}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your Name"
            />
          </Field>

          <Field label="Bio" icon={User} darkMode={darkMode}>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="A short description about yourself..."
              className={`w-full p-3 rounded-xl text-xs font-medium outline-none border transition-all duration-200 resize-none ${
                darkMode
                  ? "bg-slate-950 border-slate-800 text-slate-100 focus:border-orange-500/60 placeholder:text-slate-600"
                  : "bg-slate-50 border-slate-200 text-slate-800 focus:border-orange-400 focus:bg-white placeholder:text-slate-400"
              }`}
            />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-colors ${
              darkMode
                ? "border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(name, bio)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white transition-colors shadow-md shadow-orange-500/20"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

interface VerifyOtpModalProps {
  isOpen: boolean;
  darkMode: boolean;
  title: string;
  email: string;
  isLoading: boolean;
  error?: string;
  onClose: () => void;
  onVerify: (otp: string) => void;
  onResendOtp: () => void;
}

function VerifyOtpModal({
  isOpen,
  darkMode,
  title,
  email,
  isLoading,
  error,
  onClose,
  onVerify,
  onResendOtp,
}: VerifyOtpModalProps) {
  const [otp, setOtp] = useState("");
  const [timer, setTimer] = useState(60);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setOtp("");
    setTimer(60);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || timer <= 0) return;
    const interval = setInterval(() => {
      setTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, timer]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.trim()) {
      onVerify(otp.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 sm:pt-12 pb-6 px-4 overflow-y-auto bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div
        className={`w-full max-w-md max-h-[88vh] overflow-y-auto rounded-2xl border p-6 shadow-2xl space-y-5 ${
          darkMode ? "bg-slate-950 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold">{title}</h3>
            <p className={`text-xs mt-0.5 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
              Enter the OTP sent to <span className="font-semibold text-orange-400">{email}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg text-slate-400 hover:text-slate-200 transition-colors ${
              darkMode ? "hover:bg-slate-800" : "hover:bg-slate-100"
            }`}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <input
              ref={inputRef}
              type="text"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="Enter 6-digit OTP"
              className={`w-full h-12 px-4 rounded-xl text-center text-lg font-bold tracking-[0.3em] outline-none border transition-all duration-200 ${
                darkMode
                  ? "bg-slate-950 border-slate-800 text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 placeholder:text-slate-600 placeholder:tracking-normal placeholder:font-normal placeholder:text-sm"
                  : "bg-slate-50 border-slate-200 text-slate-900 focus:border-orange-500 focus:bg-white focus:ring-1 focus:ring-orange-500 placeholder:text-slate-400 placeholder:tracking-normal placeholder:font-normal placeholder:text-sm"
              }`}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
              <AlertCircle size={14} className="shrink-0" />
              {error}
            </div>
          )}

          <div className="flex items-center justify-between text-xs">
            <span className={darkMode ? "text-slate-400" : "text-slate-500"}>
              Didn't receive OTP?
            </span>
            {timer > 0 ? (
              <span className="text-orange-400 font-medium font-mono">Resend in {timer}s</span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setTimer(60);
                  onResendOtp();
                }}
                className="text-orange-500 hover:underline font-semibold"
              >
                Resend OTP
              </button>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
                darkMode
                  ? "border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !otp}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white transition-colors shadow-md shadow-orange-500/20 flex items-center gap-2"
            >
              {isLoading ? "Verifying..." : "Verify & Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function EditProfile() {
  const { darkMode } = useOutletContext<OutletContext>();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const { user, setUser, signOut } = useAuth();
  const [isEditInfoModalOpen, setIsEditInfoModalOpen] = useState(false);

  const { settings, refetch: refetchSettings } = usePlatformSettingsGuard();
  const platformName = settings?.platformName || "HQ Terminal";

  const [platformIdentity, setPlatformIdentity] = useState({
    platformName: "",
    supportEmail: "",
  });
  const [hasInitializedSettings, setHasInitializedSettings] = useState(false);

  useEffect(() => {
    if (settings && !hasInitializedSettings) {
      setPlatformIdentity({
        platformName: settings.platformName || "HQ Terminal",
        supportEmail: settings.supportEmail || "support@hqterminal.io",
      });
      setHasInitializedSettings(true);
    }
  }, [settings, hasInitializedSettings]);

  const savePlatformIdentityField = async (field: "platformName" | "supportEmail", value: string) => {
    try {
      await apiClient.patch("/superadmin/platform-settings", { [field]: value });
      refetchSettings();
    } catch (err) {
      console.error("Failed to update platform identity:", err);
    }
  };

  const [form, setForm] = useState(() => ({
    name: user?.name || "Platform Owner",
    email: user?.email || "adminsuper22@gmail.com",
    phone: user?.mobile || "4444444444",
    location: user?.location || "Kolkata, WB",
    bio: user?.bio || "Super Administrator managing the HQ Terminal platform.",
  }));

  const [passwords, setPasswords] = useState({
    current: "",
    next: "",
    confirm: "",
  });

  const [showPw, setShowPw] = useState({
    current: false,
    next: false,
    confirm: false,
  });

  const [avatarUrl, setAvatarUrl] = useState(() => user?.avatar || "");

  useEffect(() => {
    if (user) {
      setForm((prev) => ({
        ...prev,
        name: user.name || prev.name,
        email: user.email || prev.email,
        phone: user.mobile || prev.phone,
        location: user.location || prev.location,
        bio: user.bio || prev.bio,
      }));
      setAvatarUrl(user.avatar || "");
    }
  }, [user]);

  const [cropperOpen, setCropperOpen] = useState(false);
  const [tempImageSrc, setTempImageSrc] = useState("");

  const [saved, setSaved] = useState(false);
  const [pwError, setPwError] = useState("");

  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpActionType, setOtpActionType] = useState<"contact" | "password">("contact");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [contactSuccessMessage, setContactSuccessMessage] = useState("");
  const [contactError, setContactError] = useState("");

  const handleInitiateContactUpdate = async () => {
    try {
      setContactError("");
      setContactSuccessMessage("");
      setOtpError("");
      setOtpActionType("contact");

      await apiClient.post("/users/me/request-otp");
      setOtpModalOpen(true);
    } catch (err: any) {
      console.error("Failed to request OTP for contact update", err);
      setContactError(
        err.response?.data?.error?.message ||
          err.response?.data?.message ||
          "Failed to send OTP to registered email."
      );
    }
  };

  const handleInitiatePasswordUpdate = async () => {
    setPwError("");
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

    try {
      setOtpError("");
      setOtpActionType("password");

      await apiClient.post("/users/me/request-otp");
      setOtpModalOpen(true);
    } catch (err: any) {
      console.error("Failed to request OTP for password update", err);
      setPwError(
        err.response?.data?.error?.message ||
          err.response?.data?.message ||
          "Failed to send OTP to registered email."
      );
    }
  };

  const handleResendOtp = async () => {
    try {
      setOtpError("");
      await apiClient.post("/users/me/request-otp");
    } catch (err: any) {
      setOtpError("Failed to resend OTP. Please try again.");
    }
  };

  const handleVerifyOtpSubmit = async (otpCode: string) => {
    setOtpLoading(true);
    setOtpError("");

    try {
      if (otpActionType === "contact") {
        const payload = {
          email: form.email,
          mobile: form.phone,
          location: form.location,
          otp: otpCode,
        };

        const response = await apiClient.patch("/users/me", payload);

        if (response.data?.success || response.data) {
          const updatedUser = response.data.data?.user || response.data.user;
          const nextUser = {
            id: updatedUser._id || updatedUser.id,
            name: updatedUser.name,
            role: user?.role || "super-admin",
            panel: "superadmin" as const,
            email: updatedUser.email,
            mobile: updatedUser.mobile,
            avatar: updatedUser.avatar,
            location: updatedUser.location,
            bio: updatedUser.bio,
            restaurantName: user?.restaurantName || "Graphura Cloud",
          };

          setStoredUser("superadmin", nextUser);
          if (setUser) {
            setUser(nextUser);
          }

          setContactSuccessMessage("Contact information updated successfully!");
          setOtpModalOpen(false);
          setTimeout(() => setContactSuccessMessage(""), 3000);
        }
      } else if (otpActionType === "password") {
        await apiClient.patch("/users/me/password", {
          currentPassword: passwords.current,
          newPassword: passwords.next,
          otp: otpCode,
        });

        setOtpModalOpen(false);
        signOut();
        navigate("/auth/superadmin");
      }
    } catch (err: any) {
      console.error("Failed to verify OTP", err);
      setOtpError(
        err.response?.data?.error?.message ||
          err.response?.data?.message ||
          "Invalid or expired OTP. Please check and try again."
      );
    } finally {
      setOtpLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (avatarUrl.startsWith("blob:")) {
        URL.revokeObjectURL(avatarUrl);
      }
    };
  }, [avatarUrl]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Url = reader.result as string;
        setTempImageSrc(base64Url);
        setCropperOpen(true);
        e.target.value = "";
      };
      reader.readAsDataURL(file);
    }
  };

  const saveField = async (updatedFields: {
    name?: string;
    email?: string;
    phone?: string;
    location?: string;
    avatar?: string;
    bio?: string;
  }) => {
    try {
      setPwError("");
      
      const payload: Record<string, any> = {};
      if (updatedFields.name !== undefined) payload.name = updatedFields.name;
      if (updatedFields.email !== undefined) payload.email = updatedFields.email;
      if (updatedFields.phone !== undefined) payload.mobile = updatedFields.phone;
      if (updatedFields.avatar !== undefined) payload.avatar = updatedFields.avatar;
      if (updatedFields.location !== undefined) payload.location = updatedFields.location;
      if (updatedFields.bio !== undefined) payload.bio = updatedFields.bio;

      const response = await apiClient.patch('/users/me', payload);

      if (response.data?.success || response.data) {
        const updatedUser = response.data.data?.user || response.data.user;
        const nextUser = {
          id: updatedUser._id || updatedUser.id,
          name: updatedUser.name,
          role: user?.role || "super-admin",
          panel: "superadmin" as const,
          email: updatedUser.email,
          mobile: updatedUser.mobile,
          avatar: updatedUser.avatar,
          location: updatedUser.location,
          bio: updatedUser.bio,
          restaurantName: user?.restaurantName || "Graphura Cloud",
        };

        setStoredUser("superadmin", nextUser);
        if (setUser) {
          setUser(nextUser);
        }

        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err: any) {
      console.error("Failed to auto-save profile", err);
      setPwError(err.response?.data?.error?.message || err.response?.data?.message || "Failed to auto-save changes.");
    }
  };

  const handleCropConfirm = (croppedBase64: string) => {
    if (avatarUrl.startsWith("blob:")) {
      URL.revokeObjectURL(avatarUrl);
    }
    setAvatarUrl(croppedBase64);
    setCropperOpen(false);
    setTempImageSrc("");
    saveField({ avatar: croppedBase64 });
  };

  const handlePasswordUpdate = async () => {
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

    try {
      setPwError("");
      await apiClient.patch('/users/me/password', {
        currentPassword: passwords.current,
        newPassword: passwords.next,
      });
      signOut();
      navigate("/auth/superadmin");
    } catch (err: any) {
      console.error("Failed to update password", err);
      setPwError(err.response?.data?.error?.message || err.response?.data?.message || "Failed to update password.");
    }
  };

  const card = `rounded-2xl border p-5 sm:p-6 space-y-5 ${
    darkMode ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"
  }`;

  const sectionTitle = `text-xs font-bold uppercase tracking-wider mb-4 ${
    darkMode ? "text-slate-400" : "text-slate-500"
  }`;

  return (
    <div
      className={`min-h-full font-sans antialiased transition-colors duration-300 ${
        darkMode ? "text-slate-50" : "text-slate-900"
      }`}
    >
      <form
        onSubmit={(e) => e.preventDefault()}
        className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Profile
          </h1>
          <p
            className={`text-xs sm:text-sm mt-1 font-medium ${
              darkMode ? "text-slate-400" : "text-slate-600"
            }`}
          >
            Manage your personal information and account settings
          </p>
        </div>

        <div className={card}>
          <p className={sectionTitle}>Profile Photo</p>
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            <div className="relative shrink-0">
              <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-orange-500/20 bg-orange-500 flex items-center justify-center text-white font-bold text-3xl shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  (form.name || "A").charAt(0).toUpperCase()
                )}
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center shadow-md transition-colors border-2 border-white dark:border-slate-950"
                aria-label="Change photo"
              >
                <Camera size={14} />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            <div className="text-center sm:text-left flex-1 min-w-0">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <p className="font-bold text-base text-slate-900 dark:text-slate-100 truncate">
                  {form.name}
                </p>
                <button
                  type="button"
                  onClick={() => setIsEditInfoModalOpen(true)}
                  className={`p-1.5 rounded-lg border transition-colors shrink-0 ${
                    darkMode
                      ? "bg-slate-900 border-slate-800 text-slate-400 hover:text-orange-400 hover:border-orange-500/40"
                      : "bg-slate-100 border-slate-200 text-slate-600 hover:text-orange-600 hover:border-orange-300"
                  }`}
                  title="Edit Personal Information"
                >
                  <Pencil size={13} />
                </button>
              </div>

              <div
                className={`inline-flex items-center gap-1.5 mt-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                  darkMode
                    ? "bg-orange-500/10 text-orange-400"
                    : "bg-orange-50 text-orange-600"
                }`}
              >
                <Shield size={10} />
                Global Admin · {platformName}
              </div>

              {/* Bio displayed directly below name and role badge */}
              <p
                className={`mt-2 text-xs font-normal leading-relaxed max-w-xl ${
                  darkMode ? "text-slate-300" : "text-slate-600"
                }`}
              >
                {form.bio}
              </p>

              <p
                className={`mt-2.5 text-[11px] max-w-xs ${
                  darkMode ? "text-slate-500" : "text-slate-400"
                }`}
              >
                JPG, PNG or WEBP. Max size 2 MB. Square crop works best.
              </p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={`mt-3 text-xs font-semibold px-4 py-2 rounded-xl transition-colors ${
                  darkMode
                    ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Upload New Photo
              </button>
            </div>
          </div>
        </div>
        
        {/* Platform Identity Card */}
        <div className={card}>
          <p className={sectionTitle}>Platform Identity</p>
          <Field
            label="Platform Name"
            icon={Building2}
            darkMode={darkMode}
            hint="Shown in the browser tab, navbar, emails, and notifications."
          >
            <Input
              darkMode={darkMode}
              value={platformIdentity.platformName}
              onChange={(e) => setPlatformIdentity((prev) => ({ ...prev, platformName: e.target.value }))}
              onBlur={() => savePlatformIdentityField("platformName", platformIdentity.platformName)}
              placeholder="e.g. HQ Terminal"
            />
          </Field>
          <Field
            label="Support Email"
            icon={Globe}
            darkMode={darkMode}
            hint="Customers and users receive auto-generated emails from this address."
          >
            <Input
              darkMode={darkMode}
              type="email"
              value={platformIdentity.supportEmail}
              onChange={(e) => setPlatformIdentity((prev) => ({ ...prev, supportEmail: e.target.value }))}
              onBlur={() => savePlatformIdentityField("supportEmail", platformIdentity.supportEmail)}
              placeholder="support@yourplatform.io"
            />
          </Field>
        </div>



        <div className={card}>
          <p className={sectionTitle}>Contact Information</p>
          <Field
            label="Email Address"
            icon={Mail}
            darkMode={darkMode}
            hint="Used for system notifications and account recovery."
          >
            <Input
              darkMode={darkMode}
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Phone Number" icon={Phone} darkMode={darkMode}>
              <Input
                darkMode={darkMode}
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+91 XXXXX XXXXX"
              />
            </Field>
            <Field label="Location" icon={MapPin} darkMode={darkMode}>
              <Input
                darkMode={darkMode}
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="City, State"
              />
            </Field>
          </div>
          {contactSuccessMessage && (
            <div className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Check size={14} className="shrink-0" />
              {contactSuccessMessage}
            </div>
          )}
          {contactError && (
            <div className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
              <AlertCircle size={13} className="shrink-0" />
              {contactError}
            </div>
          )}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleInitiateContactUpdate}
              className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors shadow-md shadow-orange-500/10"
            >
              Update Contact Info
            </button>
          </div>
        </div>

        <div className={card}>
          <p className={sectionTitle}>Change Password</p>
          <p
            className={`text-[11px] -mt-3 ${
              darkMode ? "text-slate-500" : "text-slate-400"
            }`}
          >
            Leave these fields empty if you do not want to change your password.
          </p>
          <Field label="Current Password" icon={Lock} darkMode={darkMode}>
            <div className="relative">
              <Input
                darkMode={darkMode}
                type={showPw.current ? "text" : "password"}
                value={passwords.current}
                onChange={(e) =>
                  setPasswords({ ...passwords, current: e.target.value })
                }
                placeholder="Enter current password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() =>
                  setShowPw((p) => ({ ...p, current: !p.current }))
                }
                className={`absolute right-3 top-1/2 -translate-y-1/2 ${
                  darkMode
                    ? "text-slate-500 hover:text-slate-300"
                    : "text-slate-400 hover:text-slate-600"
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
                  onChange={(e) =>
                    setPasswords({ ...passwords, next: e.target.value })
                  }
                  placeholder="Min 8 characters"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((p) => ({ ...p, next: !p.next }))}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 ${
                    darkMode
                      ? "text-slate-500 hover:text-slate-300"
                      : "text-slate-400 hover:text-slate-600"
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
                  onChange={(e) =>
                    setPasswords({ ...passwords, confirm: e.target.value })
                  }
                  placeholder="Repeat new password"
                  className="pr-10"
                  onPaste={(e) => e.preventDefault()}
                  onDrop={(e) => e.preventDefault()}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowPw((p) => ({ ...p, confirm: !p.confirm }))
                  }
                  className={`absolute right-3 top-1/2 -translate-y-1/2 ${
                    darkMode
                      ? "text-slate-500 hover:text-slate-300"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {showPw.confirm ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <p className={`text-[10px] mt-1 ${darkMode ? "text-slate-500" : "text-slate-400"}`}>Please re-enter your password manually.</p>
            </Field>
          </div>
          {passwords.next && (
            <div className="space-y-1.5">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((level: number) => {
                  const strength =
                    passwords.next.length >= 12
                      ? 4
                      : passwords.next.length >= 10
                      ? 3
                      : passwords.next.length >= 8
                      ? 2
                      : 1;
                  return (
                    <div
                      key={level}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        level <= strength
                          ? strength === 4
                            ? "bg-emerald-500"
                            : strength === 3
                            ? "bg-orange-400"
                            : strength === 2
                            ? "bg-amber-400"
                            : "bg-red-400"
                          : darkMode
                          ? "bg-slate-800"
                          : "bg-slate-200"
                      }`}
                    />
                  );
                })}
              </div>
              <p
                className={`text-[10px] font-medium ${
                  passwords.next.length >= 12
                    ? "text-emerald-500"
                    : "text-amber-500"
                }`}
              >
                {passwords.next.length >= 12
                  ? "Strong password"
                  : passwords.next.length >= 8
                  ? "Moderate — consider making it longer"
                  : "Too short"}
              </p>
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
              onClick={handleInitiatePasswordUpdate}
              className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors shadow-md shadow-orange-500/10"
            >
              Update Password
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pb-4">
          <div className="text-xs font-medium">
            {saved ? (
              <span className="flex items-center gap-1.5 text-emerald-500">
                <Check size={14} /> Saved automatically!
              </span>
            ) : (
              <span className={darkMode ? "text-slate-500" : "text-slate-400"}>
                Changes are saved automatically when you finish typing.
              </span>
            )}
          </div>

        </div>
      </form>
      <ImageCropperModal
        isOpen={cropperOpen}
        imageSrc={tempImageSrc}
        onClose={() => {
          setCropperOpen(false);
          setTempImageSrc("");
        }}
        onConfirm={handleCropConfirm}
      />
      {isEditInfoModalOpen && (
        <EditPersonalInfoModal
          initialName={form.name}
          initialBio={form.bio}
          darkMode={darkMode}
          onClose={() => setIsEditInfoModalOpen(false)}
          onSave={(newName, newBio) => {
            setForm((prev) => ({ ...prev, name: newName, bio: newBio }));
            saveField({ name: newName, bio: newBio });
            setIsEditInfoModalOpen(false);
          }}
        />
      )}
      <VerifyOtpModal
        isOpen={otpModalOpen}
        darkMode={darkMode}
        title={otpActionType === "contact" ? "Verify Contact Information Update" : "Verify Password Update"}
        email={user?.email || form.email}
        isLoading={otpLoading}
        error={otpError}
        onClose={() => setOtpModalOpen(false)}
        onVerify={handleVerifyOtpSubmit}
        onResendOtp={handleResendOtp}
      />
    </div>
  );
}