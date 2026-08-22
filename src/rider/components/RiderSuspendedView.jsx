import React, { useState } from 'react';
import { useRider } from '../context/RiderContext';
import { 
  Ban, AlertTriangle, RefreshCw, 
  Phone, LogOut, FileText, MapPin, HelpCircle 
} from 'lucide-react';

export default function RiderSuspendedView({ onLogout }) {
  const { profile, riderProfile, refreshRiderProfile, addRiderToast } = useRider();
  const [isChecking, setIsChecking] = useState(false);
  const currentRider = riderProfile || profile || {};

  const handleCheckStatus = async () => {
    setIsChecking(true);
    addRiderToast('Checking account status with UR GROZY Admin...', 'info');

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
    <div className="min-h-screen bg-stone-900 flex items-center justify-center p-4 selection:bg-amber-500 selection:text-white font-sans">
      <div className="w-full max-w-lg bg-stone-950/90 border border-stone-700 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center backdrop-blur-xl relative overflow-hidden">
        
        {/* STATUS ICON */}
        <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/20">
          <Ban className="w-8 h-8 stroke-[2.3]" />
        </div>

        {/* HEADINGS */}
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-800 border border-stone-700 text-stone-300 text-xs font-black uppercase tracking-wider">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            ACCOUNT TEMPORARILY SUSPENDED
          </span>
          <h2 className="text-2xl font-black text-white tracking-tight">
            Delivery Access Paused
          </h2>
          <p className="text-stone-400 text-xs sm:text-sm leading-relaxed">
            Dear <strong>{currentRider?.fullName || currentRider?.name || 'Partner'}</strong>, your rider account is temporarily suspended by UR GROZY Admin operations.
          </p>
        </div>

        {/* REASON CALLOUT */}
        {currentRider?.rejectionReason && (
          <div className="p-4 bg-stone-900 border border-stone-800 rounded-2xl text-left space-y-1">
            <div className="text-amber-300 font-bold text-xs">
              Reason:
            </div>
            <p className="text-xs text-stone-300 font-medium">
              {currentRider.rejectionReason}
            </p>
          </div>
        )}

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
            <span className="text-stone-400 font-bold">Vehicle:</span>
            <span className="font-mono text-stone-300 font-bold uppercase">
              {currentRider?.vehicleNumber || 'Not specified'} ({currentRider?.vehicleType || 'Scooter'})
            </span>
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <span className="text-stone-400 font-bold flex items-center gap-1">
              <MapPin className="w-3 h-3 text-stone-500" />
              <span>City / Region:</span>
            </span>
            <span className="text-stone-300 font-semibold">{currentRider?.deliveryCity || currentRider?.city || 'Chikkamagaluru, Karnataka'}</span>
          </div>
        </div>

        {/* SUPPORT HELP CALLOUT */}
        <div className="p-3.5 bg-stone-900 border border-stone-800 rounded-2xl text-left flex items-start gap-2.5">
          <HelpCircle className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-stone-400 leading-snug">
            To appeal this suspension or reactivate your delivery partner account, please contact UR GROZY Operations at <strong className="text-stone-200">+91 81238 21300</strong>.
          </p>
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleCheckStatus}
            disabled={isChecking}
            className="w-full py-3 px-4 bg-stone-800 hover:bg-stone-700 active:bg-stone-900 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
            <span>{isChecking ? 'Checking...' : 'Check Status Again'}</span>
          </button>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="w-full sm:w-auto py-3 px-4 bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
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
