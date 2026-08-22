import React from 'react';
import { useRider } from '../context/RiderContext';
import AvailabilityToggle from './AvailabilityToggle';
import CurrentDeliveryCard from './CurrentDeliveryCard';
import DeliveryRequestCard from './DeliveryRequestCard';
import { Bike, DollarSign, Star, ShieldCheck, MapPin, Clock, ArrowRight } from 'lucide-react';

export default function RiderDashboard() {
  const { profile, earnings, isOnline, activeDelivery, incomingRequest, setActiveRiderTab } = useRider();

  const safeProfile = profile || {};
  const safeEarnings = earnings || { today: 0, todayDeliveries: 0, todayDistanceKm: '0.0', thisWeek: 0, thisMonth: 0, baseEarnings: 0, bonuses: 0, tips: 0 };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      
      {/* HEADER GREETING */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-3xl p-6 border border-stone-200 shadow-xs">
        <div>
          <h1 className="font-display font-black text-2xl sm:text-3xl text-stone-900">
            Good morning, {safeProfile.fullName || safeProfile.name || 'Delivery Partner'} 👋
          </h1>
          <p className="text-stone-500 text-xs sm:text-sm mt-0.5">
            Ready for your next grocery delivery?
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-amber-100 text-amber-900 px-3 py-1.5 rounded-2xl border border-amber-200 text-xs font-black flex items-center gap-1.5">
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            <span>{safeProfile.rating || 5.0} Rating</span>
          </div>

          <button
            onClick={() => setActiveRiderTab && setActiveRiderTab('earnings')}
            className="py-2.5 px-4 bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-xs rounded-xl shadow-md transition-colors flex items-center gap-1 cursor-pointer"
          >
            <span>₹{safeEarnings.today} Today</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ONLINE / OFFLINE AVAILABILITY TOGGLE */}
      <AvailabilityToggle />

      {/* ACTIVE DELIVERY SPOTLIGHT */}
      {activeDelivery && (
        <div className="space-y-3">
          <h3 className="font-display font-extrabold text-xl text-stone-900">
            Current Active Delivery
          </h3>
          <CurrentDeliveryCard delivery={activeDelivery} />
        </div>
      )}

      {/* INCOMING DELIVERY REQUEST */}
      {isOnline && !activeDelivery && incomingRequest && (
        <div className="space-y-3">
          <h3 className="font-display font-extrabold text-xl text-stone-900">
            Incoming Delivery Request
          </h3>
          <DeliveryRequestCard request={incomingRequest} />
        </div>
      )}

      {/* SUMMARY STATS GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        
        <div className="bg-white p-4 rounded-2xl border border-stone-200 space-y-1 shadow-2xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400">Deliveries Today</span>
          <p className="font-display font-black text-2xl text-stone-900">{safeEarnings.todayDeliveries}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200 space-y-1 shadow-2xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400">Today's Earnings</span>
          <p className="font-display font-black text-2xl text-emerald-950">₹{safeEarnings.today}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200 space-y-1 shadow-2xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400">Distance Covered</span>
          <p className="font-display font-black text-xl text-stone-900">{safeEarnings.todayDistanceKm} km</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200 space-y-1 shadow-2xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400">Partner Rating</span>
          <p className="font-display font-black text-xl text-amber-600 flex items-center gap-1">
            ⭐ {safeProfile.rating || 5.0}
          </p>
        </div>

      </div>

    </div>
  );
}