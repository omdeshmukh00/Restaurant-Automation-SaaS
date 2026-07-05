import React from 'react';
import { ArrowLeft } from 'lucide-react';
import PartnerForm from '../../components/partner/PartnerForm';

export default function PartnerWithUs() {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans antialiased overflow-x-hidden relative flex flex-col justify-between">
      
      {/* Header / Navbar */}
      <header className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 relative z-10">
        <div className="flex items-center">
          <a
            href="/"
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-orange-500" />
            Back to Home
          </a>
        </div>
      </header>

      {/* Main Title & Subtitle Area */}
      <section className="max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-4 pb-6 text-center space-y-3 relative z-10">
        <div className="inline-flex items-center gap-1.5 bg-orange-50 border border-orange-200/60 px-3 py-1 rounded-full text-[10px] font-extrabold tracking-wider text-[#FF6B1A] uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B1A] animate-pulse" />
          Partner With Us
        </div>
        
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
          Join <span className="text-[#FF6B1A]">RestoHub</span> as Our Partner
        </h1>
        
        <p className="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto leading-relaxed">
          Fill in the details below and our team will get in touch with you to help you get started.
        </p>
      </section>

      {/* Form Container */}
      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 relative z-10 flex-grow">
        <PartnerForm />
      </main>

      {/* Footer disclaimer */}
      <footer className="w-full py-8 text-center text-xs text-slate-400 relative z-10 space-y-1 mt-6">
        <p className="text-[10px] font-bold text-slate-400/80">
          No commitment. You can change your plan anytime later.
        </p>
        <p className="text-[9px] text-slate-400/50">
          &copy; {new Date().getFullYear()} RestoHub Technologies Private Limited. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
