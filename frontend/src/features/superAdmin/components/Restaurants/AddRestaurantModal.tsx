// components/AddRestaurantModal.tsx

import { useState, useEffect, useRef } from "react";
import { X, MapPin, RefreshCw, Camera } from "lucide-react";
// Fixed relative import path to point to the local folder types directly
import type { NewRestaurantForm } from "./Restauranttypes";

interface AddRestaurantModalProps {
  darkMode: boolean;
  formData: NewRestaurantForm;
  plans: any[];
  onChange: (data: Partial<NewRestaurantForm>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  onClear?: () => void;
}

export default function AddRestaurantModal({
  darkMode,
  formData,
  plans,
  onChange,
  onSubmit,
  onClose,
  onClear,
}: AddRestaurantModalProps) {
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [phonePrefix, setPhonePrefix] = useState("+91");
  const [phoneVal, setPhoneVal] = useState("");
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(formData.coverImage || null);
  const coverImageRef = useRef<HTMLInputElement>(null);

  const handleCoverImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 2 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setCoverImagePreview(result);
      onChange({ coverImage: result });
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (formData.phone) {
      const match = formData.phone.match(/^(\+\d+)\s(.*)$/);
      if (match) {
        setPhonePrefix(match[1]);
        setPhoneVal(match[2]);
      } else {
        setPhoneVal(formData.phone);
      }
    } else {
      setPhoneVal("");
    }
  }, [formData.phone]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fullPhone = `${phonePrefix} ${phoneVal.trim()}`.trim();
    onChange({ phone: fullPhone });
    setTimeout(() => {
      onSubmit(e);
    }, 10);
  };

  const inputClass = `w-full h-10 px-3 rounded-xl text-sm border outline-none transition-all ${
    darkMode
      ? "bg-slate-900/50 border-slate-800 text-white focus:border-orange-500 placeholder:text-slate-600"
      : "bg-slate-50 border-slate-200 focus:border-orange-500 placeholder:text-slate-400"
  }`;

  const textareaClass = `w-full min-h-[80px] p-3 rounded-xl text-sm border outline-none transition-all resize-none ${
    darkMode
      ? "bg-slate-900/50 border-slate-800 text-white focus:border-orange-500 placeholder:text-slate-600"
      : "bg-slate-50 border-slate-200 focus:border-orange-500 placeholder:text-slate-400"
  }`;

  const labelClass = `block text-xs font-semibold uppercase mb-1.5 ${
    darkMode ? "text-slate-400" : "text-slate-500"
  }`;

  const selectClass = `w-full h-10 px-2 rounded-xl text-sm border outline-none transition-all ${
    darkMode
      ? "bg-slate-950 border-slate-800 text-white focus:border-orange-500 text-slate-100"
      : "bg-slate-50 border-slate-200 focus:border-orange-500 text-slate-800"
  }`;

  const optionClass = darkMode ? "bg-slate-950 text-slate-100" : "bg-white text-slate-800";

  const handleGetLocation = () => {
    setLoadingLocation(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.");
      setLoadingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        onChange({ latitude, longitude });
        setLoadingLocation(false);
      },
      (err) => {
        console.error("Geolocation error:", err);
        let msg = "Unable to retrieve location.";
        if (err.code === err.PERMISSION_DENIED) {
          msg = "Permission denied. Paste Google Maps link instead.";
        }
        setLocationError(msg);
        setLoadingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleUrlChange = (val: string) => {
    onChange({ googleMapsUrl: val });

    const atRegex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
    const qRegex = /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/;
    
    let match = val.match(atRegex);
    if (!match) match = val.match(qRegex);
    
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        onChange({ latitude: lat, longitude: lng });
        setLocationError(null);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/40 animate-fade-in">
      {/* Backdrop listener to close modal */}
      <button 
        type="button"
        onClick={onClose}
        className="absolute inset-0 w-full h-full cursor-default bg-transparent border-none outline-none"
        aria-label="Close dialog overlay"
      />

      <div className={`relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border p-6 shadow-2xl transition-all ${
        darkMode ? "bg-slate-950 border-slate-800" : "bg-white border-slate-100"
      }`}>
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 p-1.5 rounded-xl transition-colors ${
            darkMode ? "hover:bg-slate-900 text-slate-400" : "hover:bg-slate-100 text-slate-500"
          }`}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex justify-between items-start mb-6 pr-8">
          <div>
            <h3 className={`text-lg font-bold mb-1 ${darkMode ? "text-white" : "text-slate-900"}`}>
              Register New Restaurant
            </h3>
            <p className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
              Provide all details to directly register and onboard a partner restaurant.
            </p>
          </div>
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                darkMode
                  ? "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white"
                  : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Empty Fields
            </button>
          )}
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-6">
          {/* Section 1: Basic Info */}
          <div className="space-y-4">
            <h4 className={`text-xs font-bold uppercase tracking-wider ${darkMode ? "text-orange-400" : "text-orange-600"}`}>
              Basic Information
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="restaurant-name" className={labelClass}>Restaurant Name *</label>
                <input
                  id="restaurant-name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => onChange({ name: e.target.value })}
                  placeholder="e.g. Pizza Palace"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="owner-name" className={labelClass}>Owner Full Name *</label>
                <input
                  id="owner-name"
                  type="text"
                  required
                  value={formData.owner}
                  onChange={(e) => onChange({ owner: e.target.value })}
                  placeholder="e.g. John Doe"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="cuisine" className={labelClass}>Cuisine Type *</label>
                <input
                  id="cuisine"
                  type="text"
                  required
                  value={formData.cuisine || ""}
                  onChange={(e) => onChange({ cuisine: e.target.value })}
                  placeholder="e.g. Italian, Fast Food"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="isVeg" className={labelClass}>Vegetarian Type *</label>
                <select
                  id="isVeg"
                  value={formData.isVeg || "both"}
                  onChange={(e) => onChange({ isVeg: e.target.value })}
                  className={selectClass}
                >
                  <option value="both" className={optionClass}>Veg & Non-Veg</option>
                  <option value="veg" className={optionClass}>Pure Veg</option>
                  <option value="non-veg" className={optionClass}>Non-Veg Only</option>
                </select>
              </div>
              <div>
                <label htmlFor="branches" className={labelClass}>Number of Branches *</label>
                <input
                  id="branches"
                  type="number"
                  required
                  min={1}
                  value={formData.branches}
                  onChange={(e) => onChange({ branches: parseInt(e.target.value) || 1 })}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="expected-orders" className={labelClass}>Expected Monthly Orders *</label>
                <input
                  id="expected-orders"
                  type="number"
                  required
                  min={0}
                  value={formData.expectedMonthlyOrders || 0}
                  onChange={(e) => onChange({ expectedMonthlyOrders: parseInt(e.target.value) || 0 })}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Cover Image Upload */}
          <div className="space-y-3">
            <h4 className={`text-xs font-bold uppercase tracking-wider ${darkMode ? "text-orange-400" : "text-orange-600"}`}>
              Restaurant Cover Image *
            </h4>
            <div className="flex items-center gap-4">
              {coverImagePreview ? (
                <div className="relative group w-28 h-20 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 flex-shrink-0">
                  <img src={coverImagePreview} alt="Cover" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => coverImageRef.current?.click()}
                      className="p-1.5 bg-white/90 rounded-full text-slate-700 hover:bg-white mr-1"
                    >
                      <Camera className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCoverImagePreview(null); onChange({ coverImage: undefined }); if (coverImageRef.current) coverImageRef.current.value = ''; }}
                      className="p-1.5 bg-white/90 rounded-full text-red-600 hover:bg-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => coverImageRef.current?.click()}
                  className={`w-28 h-20 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer flex-shrink-0 ${
                    darkMode
                      ? 'border-slate-700 hover:border-orange-500 bg-slate-900/50 hover:bg-orange-950/30'
                      : 'border-slate-300 hover:border-orange-400 bg-slate-50 hover:bg-orange-50'
                  }`}
                >
                  <Camera className={`w-5 h-5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                  <span className={`text-[9px] font-semibold ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Add Photo</span>
                </button>
              )}
              <p className={`text-[11px] leading-relaxed ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                Upload a cover image for the restaurant listing. Max 2MB. JPG, PNG, or WebP.
              </p>
            </div>
            <input ref={coverImageRef} type="file" accept="image/*" className="hidden" onChange={handleCoverImageSelect} />
          </div>

          {/* Section 2: Contact Info */}
          <div className="space-y-4">
            <h4 className={`text-xs font-bold uppercase tracking-wider ${darkMode ? "text-orange-400" : "text-orange-600"}`}>
              Contact Information
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="email" className={labelClass}>Business Email *</label>
                <input
                  id="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => onChange({ email: e.target.value })}
                  placeholder="owner@example.com"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="phone" className={labelClass}>Mobile Number *</label>
                <div className="flex gap-2">
                  <select
                    value={phonePrefix}
                    onChange={(e) => setPhonePrefix(e.target.value)}
                    className={`w-24 h-10 px-2 rounded-xl text-sm border outline-none transition-all cursor-pointer ${
                      darkMode
                        ? "bg-slate-900/50 border-slate-800 text-white focus:border-orange-500"
                        : "bg-slate-50 border-slate-200 focus:border-orange-500 text-slate-800"
                    }`}
                  >
                    <option value="+91" className={optionClass}>+91 (IN)</option>
                    <option value="+1" className={optionClass}>+1 (US)</option>
                    <option value="+44" className={optionClass}>+44 (UK)</option>
                    <option value="+971" className={optionClass}>+971 (AE)</option>
                  </select>
                  <input
                    id="phone"
                    type="text"
                    required
                    value={phoneVal}
                    onChange={(e) => {
                      setPhoneVal(e.target.value);
                      onChange({ phone: e.target.value });
                    }}
                    placeholder="98765 43210"
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Address & Taxes */}
          <div className="space-y-4">
            <h4 className={`text-xs font-bold uppercase tracking-wider ${darkMode ? "text-orange-400" : "text-orange-600"}`}>
              Address & Verification
            </h4>
            <div className="space-y-4">
              <div>
                <label htmlFor="address" className={labelClass}>Restaurant Address *</label>
                <input
                  id="address"
                  type="text"
                  required
                  value={formData.address || ""}
                  onChange={(e) => onChange({ address: e.target.value })}
                  placeholder="Enter full address"
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="col-span-2 md:col-span-1">
                  <label htmlFor="city" className={labelClass}>City *</label>
                  <input
                    id="city"
                    type="text"
                    required
                    value={formData.city || ""}
                    onChange={(e) => onChange({ city: e.target.value })}
                    placeholder="City"
                    className={inputClass}
                  />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label htmlFor="state" className={labelClass}>State *</label>
                  <input
                    id="state"
                    type="text"
                    required
                    value={formData.state || ""}
                    onChange={(e) => onChange({ state: e.target.value })}
                    placeholder="State"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="pincode" className={labelClass}>PIN Code *</label>
                  <input
                    id="pincode"
                    type="text"
                    required
                    value={formData.pinCode || ""}
                    onChange={(e) => onChange({ pinCode: e.target.value })}
                    placeholder="PIN Code"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="country" className={labelClass}>Country *</label>
                  <input
                    id="country"
                    type="text"
                    required
                    value={formData.country || "India"}
                    onChange={(e) => onChange({ country: e.target.value })}
                    placeholder="Country"
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="gstNumber" className={labelClass}>GST Number (Optional)</label>
                <input
                  id="gstNumber"
                  type="text"
                  value={formData.gstNumber || ""}
                  onChange={(e) => onChange({ gstNumber: e.target.value })}
                  placeholder="Enter GSTIN if available"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Section 4: Geolocation Mapping */}
          <div className="space-y-4">
            <h4 className={`text-xs font-bold uppercase tracking-wider ${darkMode ? "text-orange-400" : "text-orange-600"}`}>
              Location Mapping (Geolocation)
            </h4>
            <div className={`p-4 rounded-2xl border ${darkMode ? "bg-slate-900/30 border-slate-800" : "bg-slate-50 border-slate-100"} space-y-4`}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <p className={`text-[11px] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                  Paste a Google Maps link to automatically parse the coordinates, or request device location.
                </p>
                <button
                  type="button"
                  onClick={handleGetLocation}
                  disabled={loadingLocation}
                  className="flex items-center gap-1.5 py-2 px-4 rounded-xl border border-orange-500/20 hover:bg-orange-500/10 disabled:opacity-50 text-orange-500 text-[10px] font-bold transition-all duration-150 shrink-0"
                >
                  {loadingLocation ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
                  {loadingLocation ? "Detecting..." : "Use My Location"}
                </button>
              </div>

              {locationError && (
                <p className="text-xs text-red-500 font-semibold">{locationError}</p>
              )}

              <div>
                <label htmlFor="google-maps-url" className={labelClass}>Google Maps URL *</label>
                <input
                  id="google-maps-url"
                  type="url"
                  required
                  value={formData.googleMapsUrl || ""}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="https://maps.google.com/..."
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="latitude" className={labelClass}>Latitude (Optional)</label>
                  <input
                    id="latitude"
                    type="number"
                    step="any"
                    value={formData.latitude !== null && formData.latitude !== undefined ? formData.latitude : ""}
                    onChange={(e) => onChange({ latitude: e.target.value ? parseFloat(e.target.value) : null })}
                    placeholder="e.g. 21.16876"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="longitude" className={labelClass}>Longitude (Optional)</label>
                  <input
                    id="longitude"
                    type="number"
                    step="any"
                    value={formData.longitude !== null && formData.longitude !== undefined ? formData.longitude : ""}
                    onChange={(e) => onChange({ longitude: e.target.value ? parseFloat(e.target.value) : null })}
                    placeholder="e.g. 79.04105"
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 5: Additional Info */}
          <div className="space-y-4">
            <h4 className={`text-xs font-bold uppercase tracking-wider ${darkMode ? "text-orange-400" : "text-orange-600"}`}>
              Subscription & Onboarding Configuration
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="plan" className={labelClass}>Tier Bracket</label>
                <select
                  id="plan"
                  value={formData.plan}
                  onChange={(e) => onChange({ plan: e.target.value })}
                  className={selectClass}
                >
                  {plans && plans.length > 0 ? (
                    plans
                      .filter((p: any) => p.isActive !== false)
                      .map((p: any) => (
                        <option key={p._id || p.name} value={p.name} className={optionClass}>
                          {p.name}
                        </option>
                      ))
                  ) : (
                    <>
                      <option value="Basic" className={optionClass}>Basic Tier</option>
                      <option value="Standard" className={optionClass}>Standard Tier</option>
                      <option value="Premium" className={optionClass}>Premium Tier</option>
                    </>
                  )}
                </select>
              </div>
              <div>
                <label htmlFor="status" className={labelClass}>Initial Status</label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) => onChange({ status: e.target.value as NewRestaurantForm["status"] })}
                  className={selectClass}
                >
                  <option value="Trial" className={optionClass}>Trial</option>
                  <option value="Active" className={optionClass}>Active</option>
                  <option value="Inactive" className={optionClass}>Inactive</option>
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="message" className={labelClass}>Additional Onboarding Message (Optional)</label>
              <textarea
                id="message"
                value={formData.message || ""}
                onChange={(e) => onChange({ message: e.target.value })}
                placeholder="Optional notes or details..."
                className={textareaClass}
              />
            </div>
          </div>

          <div className="flex gap-4 pt-4 border-t border-slate-200/40 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 h-11 text-xs font-bold rounded-xl transition-colors border ${
                darkMode ? "border-slate-800 hover:bg-slate-900 text-slate-300" : "border-slate-200 hover:bg-slate-50 text-slate-600"
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 h-11 text-xs font-bold bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors shadow-md shadow-orange-500/10"
            >
              Register Restaurant
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}