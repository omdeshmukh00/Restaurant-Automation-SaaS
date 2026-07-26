import React, { useState } from 'react';
import { MapPin, Map, ExternalLink, RefreshCw } from 'lucide-react';

interface LocationPickerProps {
  latitude: number | null;
  longitude: number | null;
  googleMapsUrl: string;
  onLocationChange: (lat: number, lng: number) => void;
  onUrlChange: (url: string) => void;
}

export default function LocationPicker({
  latitude,
  longitude,
  googleMapsUrl,
  onLocationChange,
  onUrlChange,
}: LocationPickerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGetLocation = () => {
    setLoading(true);
    setError(null);

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        onLocationChange(lat, lng);
        setLoading(false);
      },
      (err) => {
        console.error('Geolocation error:', err);
        let msg = 'Unable to retrieve your location.';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Location access denied. Please grant permissions in your browser or enter coordinates manually.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = 'Location information is unavailable. Please enter coordinates manually.';
        } else if (err.code === err.TIMEOUT) {
          msg = 'Request to get user location timed out. Please try again.';
        }
        setError(msg);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onUrlChange(val);

    const atRegex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
    const qRegex = /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/;
    
    let match = val.match(atRegex);
    if (!match) match = val.match(qRegex);
    
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        onLocationChange(lat, lng);
        setError(null);
      }
    }
  };

  const previewMapsUrl = latitude && longitude
    ? `https://www.google.com/maps?q=${latitude},${longitude}&z=17`
    : null;

  return (
    <div className="bg-slate-50 dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 rounded-2xl p-5 space-y-4 text-slate-800 dark:text-neutral-100 font-sans transition-colors duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-0.5">
          <h4 className="text-xs font-extrabold text-slate-800 dark:text-white flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-orange-500" />
            Restaurant Location (Geolocation) <span className="text-orange-500">*</span>
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-neutral-400">
            Search your restaurant location or allow us to detect it automatically.
          </p>
        </div>

        <button
          type="button"
          onClick={handleGetLocation}
          disabled={loading}
          className="flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900/50 hover:bg-orange-100 dark:hover:bg-orange-900/60 disabled:bg-slate-100 text-[#FF6B1A] text-[10px] font-bold shadow-sm transition-all duration-150"
        >
          {loading ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <MapPin className="w-3.5 h-3.5" />
          )}
          {loading ? 'Detecting...' : 'Use My Location'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl text-[11px] text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Inputs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[9px] font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
            LATITUDE <span className="text-orange-500">*</span>
          </label>
          <input
            type="number"
            step="any"
            value={latitude || ''}
            onChange={(e) => onLocationChange(parseFloat(e.target.value) || 0, longitude || 0)}
            placeholder="e.g. 21.16876"
            required
            className="w-full bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-neutral-100 placeholder:text-slate-400 dark:placeholder:text-neutral-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition-colors"
          />
        </div>

        <div>
          <label className="block text-[9px] font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
            LONGITUDE <span className="text-orange-500">*</span>
          </label>
          <input
            type="number"
            step="any"
            value={longitude || ''}
            onChange={(e) => onLocationChange(latitude || 0, parseFloat(e.target.value) || 0)}
            placeholder="e.g. 79.04105"
            required
            className="w-full bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-neutral-100 placeholder:text-slate-400 dark:placeholder:text-neutral-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition-colors"
          />
        </div>
      </div>

      {/* Google Maps URL Field */}
      <div>
        <label className="block text-[9px] font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
          Google Map Link <span className="text-slate-400 dark:text-neutral-500 font-medium">(Optional - Auto-fills coordinates)</span>
        </label>
        <input
          type="url"
          value={googleMapsUrl}
          onChange={handleUrlChange}
          placeholder="e.g. https://maps.app.goo.gl/... or paste map link"
          className="w-full bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-neutral-100 placeholder:text-slate-400 dark:placeholder:text-neutral-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition-colors"
        />
      </div>

      {latitude && longitude && previewMapsUrl && (
        <div className="flex items-center justify-between p-3 bg-white dark:bg-neutral-900 rounded-xl border border-slate-200/60 dark:border-neutral-800">
          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-neutral-400">
            <Map className="w-3.5 h-3.5 text-slate-400 dark:text-neutral-500" />
            <span>Location captured: <strong className="text-slate-800 dark:text-neutral-200">{latitude.toFixed(5)}, {longitude.toFixed(5)}</strong></span>
          </div>
          
          <a
            href={previewMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-bold text-orange-650 hover:text-orange-550 flex items-center gap-1 hover:underline transition-colors"
          >
            Open in Google Maps
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
      
      <p className="text-[10px] text-slate-400 dark:text-neutral-500 mt-1">
        This helps us verify your service area and provide better support.
      </p>
    </div>
  );
}
