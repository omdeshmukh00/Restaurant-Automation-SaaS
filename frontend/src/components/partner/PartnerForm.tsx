import React, { useState, useRef } from 'react';
import { Building2, AlertCircle, CheckCircle, RefreshCw, ShieldAlert, Layout, CreditCard, X, Camera, ImageIcon } from 'lucide-react';
import LocationPicker from './LocationPicker';
import PaymentDialog from './PaymentDialog';
import { apiClient } from '../../shared/services/apiClient';
import MaintenanceAlertModal from '../../shared/components/MaintenanceAlertModal';

interface FormData {
  restaurantName: string;
  ownerName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  pinCode: string;
  gstNumber: string;
  googleMapsUrl: string;
  cuisine: string;
  branches: number;
  expectedMonthlyOrders: number;
  message: string;
  isVeg: string;
}

const initialFormData: FormData = {
  restaurantName: '',
  ownerName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  country: 'India',
  pinCode: '',
  gstNumber: '',
  googleMapsUrl: '',
  cuisine: '',
  branches: 1,
  expectedMonthlyOrders: 500,
  message: '',
  isVeg: '',
};

interface PlatformSettings {
  platformName: string;
  applicationFeeEnabled: boolean;
  applicationFeeAmount: number;
  currency: string;
  refundPolicy: string;
  enablePartnerRegistration?: boolean;
}

interface PartnerFormProps {
  platformName?: string;
}

export default function PartnerForm({ platformName: propPlatformName }: PartnerFormProps = {}) {
  const [formData, setFormData] = useState<FormData>(() => {
    const saved = sessionStorage.getItem('partner_form_data');
    return saved ? JSON.parse(saved) : initialFormData;
  });
  const [phonePrefix, setPhonePrefix] = useState(() => {
    return sessionStorage.getItem('partner_phone_prefix') || '+91';
  });
  const [latitude, setLatitude] = useState<number | null>(() => {
    const saved = sessionStorage.getItem('partner_latitude');
    return saved ? parseFloat(saved) : null;
  });
  const [longitude, setLongitude] = useState<number | null>(() => {
    const saved = sessionStorage.getItem('partner_longitude');
    return saved ? parseFloat(saved) : null;
  });

  const [settings, setSettings] = useState<PlatformSettings>({
    platformName: propPlatformName || 'RestoHub',
    applicationFeeEnabled: false,
    applicationFeeAmount: 0,
    currency: 'INR',
    refundPolicy: 'refundable',
    enablePartnerRegistration: true,
  });
  const [settingsLoading, setSettingsLoading] = useState(true);

  React.useEffect(() => {
    apiClient.get('/public/platform-settings')
      .then((res) => {
        const data = res.data?.data || res.data;
        if (data) {
          setSettings({
            platformName: data.platformName || propPlatformName || 'RestoHub',
            applicationFeeEnabled: !!data.applicationFeeEnabled,
            applicationFeeAmount: data.applicationFeeAmount !== undefined ? Number(data.applicationFeeAmount) : 0,
            currency: data.currency || 'INR',
            refundPolicy: data.refundPolicy || 'refundable',
            enablePartnerRegistration: data.enablePartnerRegistration !== undefined ? !!data.enablePartnerRegistration : true,
          });
        }
      })
      .catch((err) => console.error('Failed to load platform settings', err))
      .finally(() => setSettingsLoading(false));
  }, [propPlatformName]);

  React.useEffect(() => {
    sessionStorage.setItem('partner_form_data', JSON.stringify(formData));
  }, [formData]);

  React.useEffect(() => {
    sessionStorage.setItem('partner_phone_prefix', phonePrefix);
  }, [phonePrefix]);

  React.useEffect(() => {
    if (latitude !== null) {
      sessionStorage.setItem('partner_latitude', latitude.toString());
    } else {
      sessionStorage.removeItem('partner_latitude');
    }
  }, [latitude]);

  React.useEffect(() => {
    if (longitude !== null) {
      sessionStorage.setItem('partner_longitude', longitude.toString());
    } else {
      sessionStorage.removeItem('partner_longitude');
    }
  }, [longitude]);

  // Cover Image State
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(() => {
    return sessionStorage.getItem('partner_cover_image') || null;
  });
  const coverImageRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (coverImagePreview) {
      sessionStorage.setItem('partner_cover_image', coverImagePreview);
    } else {
      sessionStorage.removeItem('partner_cover_image');
    }
  }, [coverImagePreview]);

  const handleCoverImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 2 * 1024 * 1024) {
      setFormError('Image must be under 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCoverImagePreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Validation States
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Payment States
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState<{
    orderId: string;
    amount: number;
    currency: string;
    requestId: string;
  } | null>(null);

  React.useEffect(() => {
    if (formError) {
      const timer = setTimeout(() => {
        setFormError(null);
      }, 5000); // 5 seconds as requested
      return () => clearTimeout(timer);
    }
  }, [formError]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'branches' || name === 'expectedMonthlyOrders' ? (parseInt(value) || 0) : value,
    }));
    // Clear validation error on change
    if (errors[name]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }
  };

  const handleLocationChange = (lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
    if (errors.location) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy.location;
        return copy;
      });
    }
  };

  const handleUrlChange = (url: string) => {
    setFormData((prev) => ({ ...prev, googleMapsUrl: url }));
  };

  const validateForm = (): boolean => {
    const tempErrors: Record<string, string> = {};

    if (!formData.restaurantName.trim()) tempErrors.restaurantName = 'Restaurant name is required';
    if (!formData.ownerName.trim()) tempErrors.ownerName = 'Owner name is required';
    
    // Email regex
    if (!formData.email.trim()) {
      tempErrors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      tempErrors.email = 'Please enter a valid email address';
    }

    // Phone regex (at least 10 digits)
    if (!formData.phone.trim()) {
      tempErrors.phone = 'Mobile number is required';
    } else if (!/^\d{10,12}$/.test(formData.phone.replace(/[\s-+]/g, ''))) {
      tempErrors.phone = 'Please enter a valid 10-12 digit mobile number';
    }

    if (!formData.address.trim()) tempErrors.address = 'Address is required';
    if (!formData.city.trim()) tempErrors.city = 'City is required';
    if (!formData.state.trim()) tempErrors.state = 'State is required';
    if (!formData.country.trim()) tempErrors.country = 'Country is required';
    if (!formData.pinCode.trim()) {
      tempErrors.pinCode = 'Pin code is required';
    } else if (formData.pinCode.length < 6) {
      tempErrors.pinCode = 'Must be at least 6 characters';
    }

    if (!formData.cuisine.trim()) tempErrors.cuisine = 'Cuisine type is required';
    if (!formData.isVeg) tempErrors.isVeg = 'Vegetarian type is required';
    if (formData.branches <= 0) tempErrors.branches = 'Must have at least 1 branch';
    if (formData.expectedMonthlyOrders < 0) tempErrors.expectedMonthlyOrders = 'Cannot be negative';

    if (!coverImagePreview) {
      tempErrors.coverImage = 'Restaurant cover image is required';
    }

    if (latitude === null || longitude === null) {
      tempErrors.location = 'Geolocation coordinates are required.';
    }

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter') {
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA') {
        return; // Allow newlines in textareas
      }

      e.preventDefault();

      const form = e.currentTarget;
      const elements = Array.from(
        form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
          'input:not([type="submit"]):not([type="button"]):not([disabled]), select:not([disabled]), textarea:not([disabled])'
        )
      );

      const currentIndex = elements.indexOf(target as any);

      // Helper to check if a required element is empty
      const isRequiredAndEmpty = (el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) => {
        return el.required && !el.value.trim();
      };

      // Search for the next required empty element after current index
      let nextEmpty = elements.slice(currentIndex + 1).find(isRequiredAndEmpty);

      // If not found, wrap around to search from the beginning
      if (!nextEmpty && currentIndex > 0) {
        nextEmpty = elements.slice(0, currentIndex).find(isRequiredAndEmpty);
      }

      if (nextEmpty) {
        nextEmpty.focus();
      }
    }
  };

  const showError = (msg: string) => {
    setFormError(msg);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const isValid = validateForm();
    if (!isValid) {
      showError('Please resolve all validation errors before submitting.');
      return;
    }

    setSubmitting(true);

    try {
      const fullPhoneNumber = `${phonePrefix} ${formData.phone.trim()}`;

      // Submit application
      const response = await apiClient.post('/public/partner-request', {
        ...formData,
        phone: fullPhoneNumber,
        latitude,
        longitude,
        coverImage: coverImagePreview || undefined,
      });

      const data = response.data?.data;

      if (data?.requiresFee) {
        // Platform requires processing fee
        setPaymentOrder({
          orderId: data.orderId,
          amount: data.amount,
          currency: data.currency,
          requestId: data.requestId,
        });
        setIsPaymentOpen(true);
      } else {
        // Direct submission success
        setSubmitSuccess(data?.message || 'Application submitted successfully.');
        clearSessionStorage();
      }
    } catch (err: any) {
      console.error('Submission error:', err);
      const msg = err.response?.data?.error?.message || err.response?.data?.message || err.message || 'An error occurred during submission.';
      showError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const clearSessionStorage = () => {
    setFormData(initialFormData);
    setLatitude(null);
    setLongitude(null);
    setPhonePrefix('+91');
    sessionStorage.removeItem('partner_form_data');
    sessionStorage.removeItem('partner_phone_prefix');
    sessionStorage.removeItem('partner_latitude');
    sessionStorage.removeItem('partner_longitude');
  };

  const handlePaymentSuccess = (verifyResponse: any) => {
    setSubmitSuccess(verifyResponse.data?.message || 'Payment verified and application submitted successfully.');
    setIsPaymentOpen(false);
    clearSessionStorage();
  };

  const handlePaymentFailure = (errorMsg: string) => {
    setIsPaymentOpen(false);
    showError(errorMsg);
  };

  if (submitSuccess) {
    return (
      <div className="bg-white border border-slate-100 rounded-3xl p-8 max-w-2xl mx-auto text-center space-y-6 shadow-sm animate-in fade-in zoom-in duration-300">
        <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
          <CheckCircle className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-bold text-slate-800">Application Received!</h3>
          <p className="text-sm text-slate-500 font-sans">
            Thank you for applying to partner with {settings.platformName || propPlatformName || 'RestoHub'}. We have sent a confirmation email to <span className="text-orange-500 font-semibold">{formData.email}</span>.
          </p>
        </div>
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 text-left space-y-3">
          <p className="text-xs text-slate-500 leading-relaxed">
            Our super administrators will review your application details and verify the details submitted.
          </p>
          <p className="text-xs text-slate-500 leading-relaxed">
            Upon approval, you will receive an automatic welcome email containing your <strong>temporary admin credentials</strong> and your secure dashboard link.
          </p>
        </div>
        <div>
          <button
            onClick={() => window.location.href = '/'}
            className="py-3 px-6 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold shadow-md shadow-orange-500/10 transition-all duration-200"
          >
            Back to Homepage
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {formError && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white px-6 py-4 shadow-xl border-b border-red-700 flex items-center justify-between animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3 max-w-6xl mx-auto w-full">
            <AlertCircle className="w-5 h-5 shrink-0 text-white" />
            <span className="text-sm font-semibold tracking-wide">{formError}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setFormError(null)}
            className="text-white hover:text-red-200 transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_0.9fr] gap-8 items-start">
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
        <form
          onSubmit={handleSubmit}
          onKeyDown={handleKeyDown}
          noValidate
          className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
              <Building2 className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-800 font-sans">Restaurant &amp; Owner Information</h3>
              <p className="text-[11px] text-slate-500 font-sans">Provide your details to submit your partner verification application.</p>
            </div>
          </div>

        <div className="space-y-4">
          {/* Row 1: Restaurant Name & Owner Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Restaurant Name <span className="text-orange-500">*</span>
              </label>
              <input
                type="text"
                name="restaurantName"
                value={formData.restaurantName}
                onChange={handleInputChange}
                placeholder="Enter restaurant name"
                required
                className={`w-full bg-white border ${
                  errors.restaurantName ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500/20' : 'border-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20'
                } rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all`}
              />
              {errors.restaurantName && <p className="text-[10px] text-red-500 mt-1">{errors.restaurantName}</p>}
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Owner Name <span className="text-orange-500">*</span>
              </label>
              <input
                type="text"
                name="ownerName"
                value={formData.ownerName}
                onChange={handleInputChange}
                placeholder="Enter owner full name"
                required
                className={`w-full bg-white border ${
                  errors.ownerName ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500/20' : 'border-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20'
                } rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all`}
              />
              {errors.ownerName && <p className="text-[10px] text-red-500 mt-1">{errors.ownerName}</p>}
            </div>
          </div>

          {/* Row 2: Email & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Business Email <span className="text-orange-500">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Enter business email"
                required
                className={`w-full bg-white border ${
                  errors.email ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500/20' : 'border-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20'
                } rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all`}
              />
              {errors.email && <p className="text-[10px] text-red-500 mt-1">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Mobile Number <span className="text-orange-500">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={phonePrefix}
                  onChange={(e) => setPhonePrefix(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-orange-500 transition-colors"
                >
                  <option value="+91">+91</option>
                  <option value="+1">+1</option>
                  <option value="+44">+44</option>
                  <option value="+971">+971</option>
                </select>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="98765 43210"
                  required
                  className={`w-full bg-white border ${
                    errors.phone ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500/20' : 'border-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20'
                  } rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all`}
                />
              </div>
              {errors.phone && <p className="text-[10px] text-red-500 mt-1">{errors.phone}</p>}
            </div>
          </div>

          {/* Row 3: Street Address */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Restaurant Address <span className="text-orange-500">*</span>
              </label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              placeholder="Enter full address"
              required
              className={`w-full bg-white border ${
                errors.address ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500/20' : 'border-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20'
              } rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all`}
            />
            {errors.address && <p className="text-[10px] text-red-500 mt-1">{errors.address}</p>}
          </div>

          {/* Row 4: City, State, Country, PIN Code */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                City <span className="text-orange-500">*</span>
              </label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleInputChange}
                placeholder="Enter city"
                required
                className={`w-full bg-white border ${
                  errors.city ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500/20' : 'border-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20'
                } rounded-xl px-3 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all`}
              />
              {errors.city && <p className="text-[10px] text-red-500 mt-1">{errors.city}</p>}
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                State <span className="text-orange-500">*</span>
              </label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleInputChange}
                placeholder="Enter state"
                required
                className={`w-full bg-white border ${
                  errors.state ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500/20' : 'border-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20'
                } rounded-xl px-3 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all`}
              />
              {errors.state && <p className="text-[10px] text-red-500 mt-1">{errors.state}</p>}
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Country <span className="text-orange-500">*</span>
              </label>
              <select
                name="country"
                value={formData.country}
                onChange={handleInputChange}
                className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2.5 text-xs text-slate-850 focus:outline-none focus:border-orange-500"
              >
                <option value="India">India</option>
                <option value="United States">United States</option>
                <option value="United Kingdom">United Kingdom</option>
                <option value="United Arab Emirates">United Arab Emirates</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                PIN Code <span className="text-orange-500">*</span>
              </label>
              <input
                type="text"
                name="pinCode"
                value={formData.pinCode}
                onChange={handleInputChange}
                placeholder="Enter PIN code"
                required
                className={`w-full bg-white border ${
                  errors.pinCode ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500/20' : 'border-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20'
                } rounded-xl px-3 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all`}
              />
              {errors.pinCode && <p className="text-[10px] text-red-500 mt-1">{errors.pinCode}</p>}
            </div>
          </div>

          {/* Row 5: GST Number */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              GST Number <span className="text-slate-400">(Optional)</span>
            </label>
            <input
              type="text"
              name="gstNumber"
              value={formData.gstNumber}
              onChange={handleInputChange}
              placeholder="Enter GST number"
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>

          {/* Row 6: Cuisine, Vegetarian Type, Number of Branches, Expected Orders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex flex-col justify-between">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 min-h-[28px] flex items-start">
                <span>Cuisine / Cuisine Type <span className="text-orange-500">*</span></span>
              </label>
              <input
                type="text"
                name="cuisine"
                value={formData.cuisine}
                onChange={handleInputChange}
                required
                placeholder="e.g. Multi-Cuisine, Italian, Cafe"
                className={`w-full h-10 bg-white border ${
                  errors.cuisine ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-orange-500'
                } rounded-xl px-4 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none transition-colors`}
              />
              {errors.cuisine && <p className="text-[10px] text-red-500 mt-1">{errors.cuisine}</p>}
            </div>

            <div className="flex flex-col justify-between">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 min-h-[28px] flex items-start">
                <span>Vegetarian Type <span className="text-orange-500">*</span></span>
              </label>
              <select
                name="isVeg"
                value={formData.isVeg}
                onChange={handleInputChange}
                className={`w-full h-10 bg-white border ${
                  errors.isVeg ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-orange-500'
                } rounded-xl px-2.5 py-2 text-xs ${
                  formData.isVeg ? 'text-slate-800' : 'text-slate-400'
                } focus:outline-none cursor-pointer`}
              >
                <option value="" disabled hidden>Select Mode</option>
                <option value="both" className="text-slate-800">Veg &amp; Non-Veg</option>
                <option value="veg" className="text-slate-800">Pure Veg</option>
                <option value="non-veg" className="text-slate-800">Non-Veg Only</option>
              </select>
              {errors.isVeg && <p className="text-[10px] text-red-500 mt-1">{errors.isVeg}</p>}
            </div>

            <div className="flex flex-col justify-between">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 min-h-[28px] flex items-start">
                <span>Number of Branches <span className="text-orange-500">*</span></span>
              </label>
              <select
                name="branches"
                value={formData.branches}
                onChange={handleInputChange}
                className="w-full h-10 bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-orange-500 cursor-pointer"
              >
                <option value="1">1</option>
                <option value="3">2 - 5</option>
                <option value="8">6 - 10</option>
                <option value="15">10+</option>
              </select>
            </div>

            <div className="flex flex-col justify-between">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 min-h-[28px] flex items-start">
                <span>Expected Monthly Orders <span className="text-orange-500">*</span></span>
              </label>
              <select
                name="expectedMonthlyOrders"
                value={formData.expectedMonthlyOrders}
                onChange={handleInputChange}
                className="w-full h-10 bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-orange-500 cursor-pointer"
              >
                <option value="500">Under 500</option>
                <option value="2000">500 - 2,000</option>
                <option value="5000">2,000 - 5,000</option>
                <option value="10000">5,000+</option>
              </select>
            </div>
          </div>

          {/* Row 6.5: Restaurant Cover Image (Mandatory) */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-sans">
              Restaurant Cover Image <span className="text-orange-500">*</span>
            </label>
            <div className="flex items-center gap-4">
              {coverImagePreview ? (
                <div className="relative group w-24 h-16 rounded-xl overflow-hidden border border-slate-200 flex-shrink-0">
                  <img src={coverImagePreview} alt="Cover" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => coverImageRef.current?.click()}
                      className="p-1 bg-white/90 rounded-full text-slate-700 hover:bg-white mr-1"
                    >
                      <Camera className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCoverImagePreview(null); if (coverImageRef.current) coverImageRef.current.value = ''; }}
                      className="p-1 bg-white/90 rounded-full text-red-600 hover:bg-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => coverImageRef.current?.click()}
                  className={`w-24 h-16 rounded-xl border-2 border-dashed ${
                    errors.coverImage ? 'border-red-400 bg-red-50' : 'border-slate-300 hover:border-orange-400 bg-slate-50 hover:bg-orange-50'
                  } flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer flex-shrink-0`}
                >
                  <Camera className="w-4 h-4 text-slate-400" />
                  <span className="text-[8px] font-semibold text-slate-400">Add Photo</span>
                </button>
              )}
              <p className="text-[10px] text-slate-400 leading-relaxed font-sans">Upload a cover image for your restaurant. Max 2MB. JPG, PNG, or WebP.</p>
            </div>
            {errors.coverImage && <p className="text-[10px] text-red-500 mt-1 font-medium">{errors.coverImage}</p>}
            <input ref={coverImageRef} type="file" accept="image/*" className="hidden" onChange={handleCoverImageSelect} />
          </div>

          {/* Row 7: Geolocation details */}
          <div className="pt-2">
            <LocationPicker
              latitude={latitude}
              longitude={longitude}
              googleMapsUrl={formData.googleMapsUrl}
              onLocationChange={handleLocationChange}
              onUrlChange={handleUrlChange}
            />
            {errors.location && <p className="text-[10px] text-red-500 mt-2 font-medium">{errors.location}</p>}
          </div>

          {/* Row 8: Message */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Additional Message <span className="text-slate-400">(Optional)</span>
            </label>
            <div className="relative">
              <textarea
                name="message"
                maxLength={500}
                rows={4}
                value={formData.message}
                onChange={handleInputChange}
                placeholder="Tell us more about your restaurant and requirements..."
                className="w-full bg-white border border-slate-200 focus:border-orange-500 rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none transition-colors resize-none"
              />
              <span className="absolute bottom-3 right-3 text-[10px] text-slate-400">
                {formData.message.length}/500
              </span>
            </div>
          </div>

          {/* Row 9: Submit Button and Security Notice */}
          <div className="space-y-4 pt-3">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-6 rounded-2xl bg-[#FF6B1A] hover:bg-orange-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold text-xs shadow-md shadow-orange-500/10 flex items-center justify-center gap-2 transition-all duration-250"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Submitting Application...
                </>
              ) : settings.applicationFeeEnabled ? (
                <>
                  <CreditCard className="w-3.5 h-3.5" />
                  Pay ₹{settings.applicationFeeAmount} & Submit Application
                </>
              ) : (
                <>
                  <Layout className="w-3.5 h-3.5" />
                  Submit Application
                </>
              )}
            </button>
            
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
              <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
              <span>Your information is secure and will only be used to contact you.</span>
            </div>
          </div>
        </div>
      </form>

      {/* Right Column: Platform Summary & Process Fee Detail */}
      <div className="space-y-6">
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-sm font-extrabold text-slate-800 font-sans">Application Summary</h3>
            <p className="text-[11px] text-slate-400 font-sans">Review onboarding stages and settings</p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Onboarding Process:</span>
              <span className="font-bold text-slate-800">Two-Stage Verification</span>
            </div>
            
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Stage 1:</span>
              <span className="text-slate-700 font-bold text-right">Submit details & verify location</span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Stage 2:</span>
              <span className="text-slate-700 font-bold text-right">Super Admin review & approval</span>
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-4">
              {settingsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <RefreshCw className="w-5 h-5 text-orange-500 animate-spin" />
                </div>
              ) : settings.applicationFeeEnabled ? (
                <div className="bg-orange-50/50 border border-orange-100 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-orange-850 font-bold">Onboarding Fee</span>
                    <span className="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded-md font-bold capitalize">
                      {settings.refundPolicy}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-550 leading-relaxed">
                    This platform requires a processing fee to verify your restaurant details and physical location coordinates.
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-extrabold text-orange-500 font-sans">₹{settings.applicationFeeAmount}</span>
                    <span className="text-[10px] text-slate-400 font-medium">one-time payment</span>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 space-y-2">
                  <span className="text-xs text-emerald-850 font-bold">Free Application Review</span>
                  <div className="text-[11px] text-slate-550 leading-relaxed">
                    There are no upfront charges to submit your restaurant details for review.
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 pt-4">
              <div className="bg-slate-50 rounded-2xl p-4 text-[11px] text-slate-500 leading-relaxed space-y-2">
                <p className="font-semibold text-slate-700">Please Note:</p>
                <p>Subscription plans (Monthly/Yearly) and pricing details will be selected and purchased directly from your {settings.platformName || propPlatformName || 'RestoHub'} Admin Panel after your account is approved.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Dialog Modal */}
      {paymentOrder && (
        <PaymentDialog
          isOpen={isPaymentOpen}
          onClose={() => setIsPaymentOpen(false)}
          orderId={paymentOrder.orderId}
          amount={paymentOrder.amount}
          currency={paymentOrder.currency}
          requestId={paymentOrder.requestId}
          ownerName={formData.ownerName}
          email={formData.email}
          phone={`${phonePrefix} ${formData.phone.trim()}`}
          refundPolicy={settings.refundPolicy}
          onPaymentSuccess={handlePaymentSuccess}
          onPaymentFailure={handlePaymentFailure}
        />
      )}

      {/* Registration Blocked Alert Modal */}
      <MaintenanceAlertModal
        isOpen={settings.enablePartnerRegistration === false}
        type="registration_blocked"
        message="Due to a temporary issue, new restaurant registration is currently blocked. Please check back later."
      />
      </div>
    </div>
  );
}
