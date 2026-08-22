import React, { useState } from 'react';
import { useRider } from '../context/RiderContext';
import { 
  XCircle, AlertOctagon, RefreshCw, 
  Phone, LogOut, FileText, MapPin, MessageSquare, HelpCircle 
} from 'lucide-react';

export default function RiderRejectedView({ onLogout }) {
  const { profile, riderProfile, refreshRiderProfile, addRiderToast } = useRider();
  const [isChecking, setIsChecking] = useState(false);
  const currentRider = riderProfile || profile || {};

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
    <div className="min-h-screen bg-stone-900 flex items-center justify-center p-4 selection:bg-rose-500 selection:text-white font-sans">
      <div className="w-full max-w-lg bg-stone-950/90 border border-rose-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center backdrop-blur-xl relative overflow-hidden">
        
        {/* BACKGROUND GLOW */}
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* STATUS ICON */}
        <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto shadow-lg shadow-rose-500/20">
          <XCircle className="w-8 h-8 stroke-[2.3]" />
        </div>

        {/* HEADINGS */}
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-black uppercase tracking-wider">
            <AlertOctagon className="w-3.5 h-3.5" />
            APPLICATION NOT APPROVED
          </span>
          <h2 className="text-2xl font-black text-white tracking-tight">
            Application Status: Rejected
          </h2>
          <p className="text-stone-400 text-xs sm:text-sm leading-relaxed">
            Dear <strong>{currentRider?.fullName || currentRider?.name || 'Partner'}</strong>, your delivery partner onboarding application was reviewed and could not be approved at this time.
          </p>
        </div>

        {/* REASON CALLOUT */}
        <div className="p-4 bg-rose-950/40 border border-rose-800/50 rounded-2xl text-left space-y-1">
          <div className="text-rose-300 font-bold text-xs flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Admin Remarks / Reason:</span>
          </div>
          <p className="text-xs text-rose-200/90 font-medium">
            {currentRider?.rejectionReason || currentRider?.rejection_reason || 'Vehicle documents or license details could not be verified by Admin operations.'}
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
            <span className="text-stone-400 font-bold">Vehicle:</span>
            <span className="font-mono text-stone-300 font-bold uppercase">
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
            Need clarification or want to re-submit updated documents? Contact UR GROZY Partner Support at <strong className="text-stone-200">+91 81238 21300</strong> or email <strong className="text-stone-200">support@urgrozy.in</strong>.
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
              className="w-full sm:w-auto py-3 px-4 bg-rose-950/60 hover:bg-rose-900 text-rose-200 border border-rose-800 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
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
