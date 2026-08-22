import React from 'react';
import { useRider } from '../context/RiderContext';
import { User, Star, Bike, ShieldCheck, MapPin, Phone, Mail, Award } from 'lucide-react';

export default function RiderProfilePage() {
  const { profile } = useRider();
  const safeProfile = profile || {};
  const displayName = safeProfile.fullName || safeProfile.name || 'Delivery Partner';

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
      
      <div className="border-b border-stone-200 pb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-2">
          <User className="w-4 h-4 text-emerald-600" />
          <span>PARTNER PROFILE</span>
        </div>
        <h1 className="font-display text-3xl font-extrabold text-stone-900 tracking-tight">
          Delivery Partner Profile
        </h1>
        <p className="text-stone-500 text-sm mt-1">
          View your vehicle registration details and partner performance rating
        </p>
      </div>

      {/* PROFILE HEADER CARD */}
      <div className="bg-white rounded-3xl border border-stone-200 p-6 sm:p-8 space-y-6 shadow-xs">
        
        <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
          <div className="w-20 h-20 rounded-3xl bg-emerald-800 text-white flex items-center justify-center font-display font-black text-3xl shadow-lg shadow-emerald-950/20">
            {displayName.charAt(0) || 'D'}
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <h2 className="font-display font-black text-2xl text-stone-900">{displayName}</h2>
              <span className="bg-emerald-100 text-emerald-800 text-xs font-extrabold px-2.5 py-0.5 rounded-md uppercase">
                VERIFIED RIDER
              </span>
            </div>
            <p className="text-stone-500 text-xs font-medium">{safeProfile.phone || 'Registered Phone'} • {safeProfile.email || 'partner@urgrozy.app'}</p>
            <p className="text-stone-400 text-xs font-semibold">Member since {safeProfile.memberSince || 'Recently Joined'} • {safeProfile.city || safeProfile.deliveryCity || 'Chikkamagaluru, Karnataka'}</p>
          </div>
        </div>

        {/* METRICS ROW */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 text-center text-xs">
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-1">
            <span className="text-amber-800 font-extrabold uppercase text-[10px] block">Partner Rating</span>
            <p className="font-display font-black text-2xl text-amber-950 flex items-center justify-center gap-1">
              ⭐ {safeProfile.rating || 5.0}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1">
            <span className="text-emerald-800 font-extrabold uppercase text-[10px] block">Total Deliveries</span>
            <p className="font-display font-black text-2xl text-emerald-950">{safeProfile.totalDeliveries || 0}</p>
          </div>

          <div className="col-span-2 sm:col-span-1 p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-1">
            <span className="text-stone-500 font-extrabold uppercase text-[10px] block">Fulfillment Rate</span>
            <p className="font-display font-black text-2xl text-stone-900">99.4%</p>
          </div>
        </div>

        {/* VEHICLE INFO */}
        <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200 space-y-3 text-xs">
          <h4 className="font-extrabold text-stone-900 uppercase tracking-wider text-[11px] flex items-center gap-2">
            <Bike className="w-4 h-4 text-emerald-700" /> Registered Vehicle Information
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-semibold text-stone-700">
            <div>
              <span className="text-[10px] text-stone-400 uppercase font-bold block">Vehicle Type</span>
              <p className="font-extrabold text-stone-900">{safeProfile.vehicleType || 'Scooter'}</p>
            </div>

            <div>
              <span className="text-[10px] text-stone-400 uppercase font-bold block">Registration Number</span>
              <p className="font-extrabold text-stone-900">{safeProfile.vehicleNumber || 'KA-14-EA-2024'}</p>
            </div>

            <div>
              <span className="text-[10px] text-stone-400 uppercase font-bold block">Driving License</span>
              <p className="font-extrabold text-stone-900">{safeProfile.drivingLicense || 'KA1420240098765'}</p>
            </div>

            <div>
              <span className="text-[10px] text-stone-400 uppercase font-bold block">Verification Status</span>
              <p className="font-extrabold text-emerald-700">Approved & Active ✓</p>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}