import React, { useState } from 'react';
import { Building2, AlertCircle, CheckCircle, RefreshCw, ShieldAlert, Layout } from 'lucide-react';
import PlanSelector, {  } from './PlanSelector';
import LocationPicker from './LocationPicker';
import PaymentDialog from './PaymentDialog';
import { apiClient } from '../../shared/services/apiClient';

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
};

export default function PartnerForm() {
  const [formData, setFormData] = useState<FormData>(() => {
    const saved = sessionStorage.getItem('partner_form_data');
    return saved ? JSON.parse(saved) : initialFormData;
  });
  const [phonePrefix, setPhonePrefix] = useState(() => {
    return sessionStorage.getItem('partner_phone_prefix') || '+91';
  });
  const [selectedPlan, setSelectedPlan] = useState<string>(() => {
    return sessionStorage.getItem('partner_selected_plan') || 'Free';
  });
  const [latitude, setLatitude] = useState<number | null>(() => {
    const saved = sessionStorage.getItem('partner_latitude');
    return saved ? parseFloat(saved) : null;
  });
  const [longitude, setLongitude] = useState<number | null>(() => {
    const saved = sessionStorage.getItem('partner_longitude');
    return saved ? parseFloat(saved) : null;
  });

  const [plans, setPlans] = useState<any[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);

  React.useEffect(() => {
    apiClient.get('/public/plans')
      .then((res) => {
        const list = res.data?.data?.plans || [];
        setPlans(list);
        
        // Auto-select first active plan if current selection is invalid
        if (list.length > 0 && !list.some((p: any) => p.name === selectedPlan)) {
          const defaultPlan = list.find((p: any) => p.name.toLowerCase() === 'free' || p.name.toLowerCase() === 'basic') || list[0];
          setSelectedPlan(defaultPlan.name);
        }
      })
      .catch((err) => console.error('Failed to load plans', err))
      .finally(() => setPlansLoading(false));
  }, []);

  React.useEffect(() => {
    sessionStorage.setItem('partner_form_data', JSON.stringify(formData));
  }, [formData]);

  React.useEffect(() => {
    sessionStorage.setItem('partner_phone_prefix', phonePrefix);
  }, [phonePrefix]);

  React.useEffect(() => {
    sessionStorage.setItem('partner_selected_plan', selectedPlan);
  }, [selectedPlan]);

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

  // Validation States
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (formError) {
      const timer = setTimeout(() => {
        setFormError(null);
      }, 300000); // 5 minutes
      return () => clearTimeout(timer);
    }
  }, [formError]);

  // Payment Dialog State
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);

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
    if (formData.branches <= 0) tempErrors.branches = 'Must have at least 1 branch';
    if (formData.expectedMonthlyOrders < 0) tempErrors.expectedMonthlyOrders = 'Cannot be negative';

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
      } else {
        // All required fields are filled, submit the form!
        handleSubmit(e);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const isValid = validateForm();
    if (!isValid) {
      setFormError('Please resolve all validation errors before submitting.');
      return;
    }

    const currentPlan = plans.find((p) => p.name === selectedPlan);
    const isFree = currentPlan ? currentPlan.priceMonthly === 0 : true;

    if (isFree) {
      // Free plan submits directly
      await submitApplication();
    } else {
      // Paid plan requires checkout popup first
      setIsPaymentOpen(true);
    }
  };

  const submitApplication = async (paymentDetails?: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => {
    setSubmitting(true);
    setFormError(null);

    try {
      // Use phonePrefix combined with raw phone number for DB storage
      const fullPhoneNumber = `${phonePrefix} ${formData.phone.trim()}`;

      // Use apiClient to handle correct endpoint base mapping
      const response = await apiClient.post('/public/partner-request', {
        ...formData,
        phone: fullPhoneNumber,
        selectedPlan,
        latitude,
        longitude,
        ...paymentDetails,
      });

      setSubmitSuccess(response.data.data?.message || 'Application submitted successfully.');
      setIsPaymentOpen(false);
      setFormData(initialFormData);
      setLatitude(null);
      setLongitude(null);
      setPhonePrefix('+91');
      setSelectedPlan('Free');
      sessionStorage.removeItem('partner_form_data');
      sessionStorage.removeItem('partner_phone_prefix');
      sessionStorage.removeItem('partner_selected_plan');
      sessionStorage.removeItem('partner_latitude');
      sessionStorage.removeItem('partner_longitude');
    } catch (err: any) {
      console.error('Submission error:', err);
      const msg = err.response?.data?.error?.message || err.response?.data?.message || err.message || 'An error occurred during submission.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaymentSuccess = (response: any) => {
    submitApplication(response);
  };

  const handlePaymentFailure = (errorMsg: string) => {
    setIsPaymentOpen(false);
    setFormError(errorMsg);
  };

  if (submitSuccess) {
    return (
      <div className="bg-white border border-slate-100 rounded-3xl p-8 max-w-2xl mx-auto text-center space-y-6 shadow-sm animate-in fade-in zoom-in duration-300">
        <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
          <CheckCircle className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-bold text-slate-800">Application Received!</h3>
          <p className="text-sm text-slate-500">
            Thank you for applying to partner with RestoHub. We have sent a confirmation email to <span className="text-orange-500 font-semibold">{formData.email}</span>.
          </p>
        </div>
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 text-left space-y-3">
          <p className="text-xs text-slate-500 leading-relaxed">
            Our super administrators will review your application details, verify the geolocation, and validate payment records. 
          </p>
          <p className="text-xs text-slate-500 leading-relaxed">
            Upon approval, you will receive an automatic welcome email containing your **temporary admin credentials** and your secure dashboard link.
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
    <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_0.9fr] gap-8 items-start">
      {/* Left Column: Form Info */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <form
        onSubmit={handleSubmit}
        onKeyDown={handleKeyDown}
        noValidate
        className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6"
      >
        
        {formError && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-600">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
            <span>{formError}</span>
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
            <Building2 className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-800">Restaurant & Owner Information</h3>
            <p className="text-[11px] text-slate-500">Provide your details and select the plan that best suits your business needs.</p>
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

          {/* Row 6: Cuisine, Number of Branches, Expected Orders */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Cuisine / Cuisine Type <span className="text-orange-500">*</span>
              </label>
              <select
                name="cuisine"
                value={formData.cuisine}
                onChange={handleInputChange}
                required
                className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-orange-500"
              >
                <option value="">Select cuisine type</option>
                <option value="Fast Food">Fast Food</option>
                <option value="Fine Dining">Fine Dining</option>
                <option value="Cafe & Bakery">Cafe & Bakery</option>
                <option value="Casual Dining">Casual Dining</option>
                <option value="Multi-Cuisine">Multi-Cuisine</option>
                <option value="Pizzeria">Pizzeria</option>
                <option value="Other">Other</option>
              </select>
              {errors.cuisine && <p className="text-[10px] text-red-500 mt-1">{errors.cuisine}</p>}
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Number of Branches <span className="text-orange-500">*</span>
              </label>
              <select
                name="branches"
                value={formData.branches}
                onChange={handleInputChange}
                className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-orange-500"
              >
                <option value="1">1</option>
                <option value="3">2 - 5</option>
                <option value="8">6 - 10</option>
                <option value="15">10+</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Expected Monthly Orders <span className="text-orange-500">*</span>
              </label>
              <select
                name="expectedMonthlyOrders"
                value={formData.expectedMonthlyOrders}
                onChange={handleInputChange}
                className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-orange-500"
              >
                <option value="500">Under 500</option>
                <option value="2000">500 - 2,000</option>
                <option value="5000">2,000 - 5,000</option>
                <option value="10000">5,000+</option>
              </select>
            </div>
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

      {/* Right Column: Plans */}
      <div className="space-y-6">
        <PlanSelector selectedPlan={selectedPlan} onChange={setSelectedPlan} />
      </div>

      {/* Payment Dialog Modal */}
      {(() => {
        const currentPlan = plans.find((p) => p.name === selectedPlan);
        const isFree = currentPlan ? currentPlan.priceMonthly === 0 : true;
        return !isFree && (
          <PaymentDialog
            isOpen={isPaymentOpen}
            onClose={() => setIsPaymentOpen(false)}
            plan={selectedPlan}
            amount={currentPlan?.priceMonthly || 0}
            ownerName={formData.ownerName}
            email={formData.email}
            phone={formData.phone}
            onPaymentSuccess={handlePaymentSuccess}
            onPaymentFailure={handlePaymentFailure}
          />
        );
      })()}
    </div>
  );
}
