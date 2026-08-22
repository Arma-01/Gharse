import React, { useState } from 'react';
import { useRider } from '../context/RiderContext';
import { History, CheckCircle2, Search, SlidersHorizontal } from 'lucide-react';

export default function RiderHistoryPage() {
  const { history } = useRider();
  const [filterPeriod, setFilterPeriod] = useState('ALL');

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      
      <div className="border-b border-stone-200 pb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-2">
          <History className="w-4 h-4 text-emerald-600" />
          <span>COMPLETED ORDERS</span>
        </div>
        <h1 className="font-display text-3xl font-extrabold text-stone-900 tracking-tight">
          Delivery History
        </h1>
        <p className="text-stone-500 text-sm mt-1">
          Review completed grocery delivery orders and payout records
        </p>
      </div>

      {/* FILTER TABS */}
      <div className="flex items-center gap-2">
        {['ALL', 'TODAY', 'THIS WEEK', 'THIS MONTH'].map(tab => (
          <button
            key={tab}
            onClick={() => setFilterPeriod(tab)}
            className={`px-4 py-2 rounded-2xl text-xs font-extrabold transition-all ${
              filterPeriod === tab
                ? 'bg-emerald-800 text-white shadow-md'
                : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-100'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* HISTORY CARDS LIST */}
      <div className="space-y-3">
        {Array.isArray(history) && history.length > 0 ? (
          history.map(item => (
            <div key={item.id} className="bg-white rounded-3xl border border-stone-200 p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-display font-black text-base text-stone-900">ORDER #{item.id}</span>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-md uppercase">
                    ✓ DELIVERED
                  </span>
                </div>

                <span className="text-xs text-stone-400 font-semibold">{item.completedAt || 'Recently'}</span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-semibold">
                <div>
                  <p className="text-stone-900 font-extrabold">{item.storeName || 'Grocery Store'} ➔ {item.customerName || 'Customer'}</p>
                  <p className="text-stone-400 font-normal text-[11px]">{item.deliveryAddress || 'Delivery Address'}</p>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-black text-base text-emerald-950 block">+₹{item.earnings || 65}</span>
                  <span className="text-[10px] text-stone-400 font-bold">{item.distance || '2.5 km'} • {item.paymentType || 'Online'}</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="py-12 text-center bg-white rounded-3xl border border-stone-200 p-6 space-y-2">
            <History className="w-10 h-10 text-stone-300 mx-auto" />
            <h4 className="font-display font-black text-base text-stone-800">No Delivery History Yet</h4>
            <p className="text-xs text-stone-500">Your completed delivery orders will appear here.</p>
          </div>
        )}
      </div>

    </div>
  );
}