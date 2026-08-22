import React, { useState, useEffect } from 'react';
import { useRider } from '../context/RiderContext';
import { 
  Bike, Clock, AlertTriangle, RefreshCw, ShieldCheck, 
  Phone, LogOut, FileText, MapPin 
} from 'lucide-react';

export default function RiderPendingApprovalView({ onLogout }) {
  const { profile, riderProfile, refreshRiderProfile, addRiderToast } = useRider();
  const [isChecking, setIsChecking] = useState(false);
  const currentRider = riderProfile || profile || {};

  // Auto-poll approval status every 3 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      if (refreshRiderProfile) {
        refreshRiderProfile().catch(() => {});
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [refreshRiderProfile]);

  const handleCheckStatus = async () => {
    setIsChecking(true);
    addRiderToast('Checking verification status with UR GROZY Admin...', 'info');

    try {
      if (refreshRiderProfile) {
        await refreshRiderProfile();
      }
    } catch (err) {
      console.error('Error refreshing rider profile:', err);
    } finally {
      setTimeout(() => {
        setIsChecking(false);
      }, 1000);
    }
  };

  return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center p-4 selection:bg-emerald-500 selection:text-white font-sans">
      <div className="w-full max-w-lg bg-stone-950/90 border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center backdrop-blur-xl relative overflow-hidden">
        
        {/* BACKGROUND GLOW */}
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* STATUS ICON */}
        <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/20 animate-pulse">
          <Bike className="w-8 h-8 stroke-[2.3]" />
        </div>

        {/* HEADINGS */}
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-black uppercase tracking-wider">
            <AlertTriangle className="w-3.5 h-3.5" />
            RIDER APPLICATION UNDER VERIFICATION
          </span>
          <h2 className="text-2xl font-black text-white tracking-tight">
            Welcome, {currentRider?.fullName || currentRider?.name || 'Delivery Partner'}!
          </h2>
          <p className="text-stone-400 text-xs sm:text-sm leading-relaxed">
            Your rider onboarding request has been submitted to the <strong>UR GROZY Admin Operations Team</strong>.
          </p>
        </div>

        {/* DETAILS SUMMARY CARD */}
        <div className="p-4 bg-stone-900/90 rounded-2xl border border-stone-800 text-left text-xs space-y-2.5">
          <div className="flex items-center justify-between border-b border-stone-800 pb-2">
            <span className="text-stone-400 font-bold">Rider Name:</span>
            <span className="text-white font-extrabold">{currentRider?.fullName || currentRider?.name || 'Delivery Partner'}</span>
          </div>

          <div className="flex items-center justify-between border-b border-stone-800 pb-2">
            <span className="text-stone-400 font-bold">Registered Phone:</span>
            <span className="text-stone-200 font-bold flex items-center gap-1">
              <Phone className="w-3 h-3 text-stone-400" />
              {currentRider?.phone || 'Registered Phone'}
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-stone-800 pb-2">
            <span className="text-stone-400 font-bold">Vehicle Number:</span>
            <span className="font-mono text-emerald-400 font-bold uppercase">
              {currentRider?.vehicleNumber || 'Not specified'} ({currentRider?.vehicleType || 'Scooter'})
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-stone-800 pb-2">
            <span className="text-stone-400 font-bold flex items-center gap-1">
              <FileText className="w-3 h-3 text-stone-500" />
              <span>License ID:</span>
            </span>
            <span className="font-mono text-stone-300 uppercase">{currentRider?.drivingLicense || 'Under Verification'}</span>
          </div>

          <div className="flex items-center justify-between border-b border-stone-800 pb-2">
            <span className="text-stone-400 font-bold flex items-center gap-1">
              <MapPin className="w-3 h-3 text-stone-500" />
              <span>City / Region:</span>
            </span>
            <span className="text-stone-300 font-semibold">{currentRider?.deliveryCity || currentRider?.city || 'Chikkamagaluru, Karnataka'}</span>
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <span className="text-stone-400 font-bold">Verification Status:</span>
            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase tracking-wider">
              ⏳ Pending Admin Approval
            </span>
          </div>
        </div>

        {/* INFORMATIONAL CALLOUT */}
        <div className="p-3.5 bg-emerald-950/40 border border-emerald-800/40 rounded-2xl text-left flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-emerald-200/90 leading-snug">
            Once UR GROZY Admin reviews and approves your documents, your account will be activated immediately and you will receive live delivery requests.
          </p>
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleCheckStatus}
            disabled={isChecking}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
            <span>{isChecking ? 'Checking Status...' : 'Check Verification Status'}</span>
          </button>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="w-full sm:w-auto py-3 px-4 bg-stone-900 hover:bg-rose-950 text-stone-300 hover:text-rose-300 border border-stone-800 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
}