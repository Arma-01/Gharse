import React from 'react';
import { useRider } from '../context/RiderContext';
import { DollarSign, TrendingUp, Award, Gift, ArrowUpRight } from 'lucide-react';

export default function RiderEarningsPage() {
  const { earnings } = useRider();

  const safeEarnings = earnings || {
    today: 0,
    todayDeliveries: 0,
    thisWeek: 0,
    thisMonth: 0,
    baseEarnings: 0,
    bonuses: 0,
    tips: 0,
    weeklyChart: [
      { day: 'Mon', amount: 0 },
      { day: 'Tue', amount: 0 },
      { day: 'Wed', amount: 0 },
      { day: 'Thu', amount: 0 },
      { day: 'Fri', amount: 0 },
      { day: 'Sat', amount: 0 },
      { day: 'Sun', amount: 0 }
    ]
  };

  const weeklyList = Array.isArray(safeEarnings.weeklyChart) ? safeEarnings.weeklyChart : [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      
      <div className="border-b border-stone-200 pb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-2">
          <DollarSign className="w-4 h-4 text-emerald-600" />
          <span>PAYOUT & EARNINGS</span>
        </div>
        <h1 className="font-display text-3xl font-extrabold text-stone-900 tracking-tight">
          Partner Earnings Overview
        </h1>
        <p className="text-stone-500 text-sm mt-1">
          Track daily payouts, peak surge bonuses, and customer tips
        </p>
      </div>

      {/* HIGHLIGHT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-[#0E382B] to-[#134E3A] text-white p-6 rounded-3xl shadow-md space-y-2">
          <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-300 block">Today's Total</span>
          <p className="font-display font-black text-3xl text-white">₹{safeEarnings.today}</p>
          <span className="text-xs text-emerald-200/80 font-semibold flex items-center gap-1">
            <ArrowUpRight className="w-4 h-4 text-emerald-400" /> {safeEarnings.todayDeliveries} deliveries completed
          </span>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-xs space-y-2">
          <span className="text-xs font-extrabold uppercase tracking-wider text-stone-400 block">This Week</span>
          <p className="font-display font-black text-3xl text-stone-900">₹{safeEarnings.thisWeek}</p>
          <span className="text-xs text-stone-500 font-semibold">Weekly payout on Monday</span>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-xs space-y-2">
          <span className="text-xs font-extrabold uppercase tracking-wider text-stone-400 block">This Month</span>
          <p className="font-display font-black text-3xl text-emerald-950">₹{safeEarnings.thisMonth}</p>
          <span className="text-xs text-stone-500 font-semibold">Monthly total</span>
        </div>
      </div>

      {/* EARNINGS BREAKDOWN */}
      <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs space-y-4">
        <h3 className="font-display font-extrabold text-lg text-stone-900 border-b border-stone-100 pb-3">
          Today's Earnings Breakdown
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-semibold">
          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-1">
            <span className="text-stone-400 uppercase font-extrabold text-[10px] block">Base Delivery Pay</span>
            <p className="font-black text-lg text-stone-900">₹{safeEarnings.baseEarnings}</p>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-1">
            <span className="text-amber-800 uppercase font-extrabold text-[10px] block">Surge & Peak Bonuses</span>
            <p className="font-black text-lg text-amber-950">₹{safeEarnings.bonuses}</p>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1">
            <span className="text-emerald-800 uppercase font-extrabold text-[10px] block">Customer Tips</span>
            <p className="font-black text-lg text-emerald-950">₹{safeEarnings.tips}</p>
          </div>
        </div>
      </div>

      {/* WEEKLY CHART */}
      <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs space-y-4">
        <h3 className="font-display font-extrabold text-lg text-stone-900 border-b border-stone-100 pb-3">
          Weekly Earnings Trend
        </h3>

        <div className="flex items-end justify-between gap-2 h-44 pt-4">
          {weeklyList.map(item => (
            <div key={item.day} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
              <span className="text-[10px] font-black text-stone-700">₹{item.amount || 0}</span>
              <div 
                style={{ height: `${Math.min(100, Math.max(8, ((item.amount || 0) / 1000) * 100))}%` }}
                className="w-full max-w-[36px] bg-emerald-800 rounded-t-xl transition-all"
              />
              <span className="text-[11px] font-bold text-stone-500 uppercase">{item.day}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}