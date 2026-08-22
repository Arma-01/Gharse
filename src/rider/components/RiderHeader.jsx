import React, { useState } from 'react';
import { useRider } from '../context/RiderContext';
import { Bike, Bell, LogOut, Power } from 'lucide-react';

export default function RiderHeader() {
  const { isOnline, toggleAvailability, profile, notifications, logoutRider } = useRider();
  const [showNotifications, setShowNotifications] = useState(false);

  const notifList = Array.isArray(notifications) ? notifications : [];
  const unreadCount = notifList.filter(n => n && !n.read).length;

  return (
    <header className="sticky top-0 z-30 bg-[#0E382B] text-white px-4 sm:px-6 py-3 shadow-md border-b border-emerald-900/60">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        
        {/* LEFT: BRAND & RIDER BADGE */}
        <div className="flex items-center gap-3">
          <img 
            src="/ur-grozy-logo.png" 
            alt="UR GROZY" 
            className="h-8 sm:h-9 w-auto object-contain"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = '/logo.png';
            }}
          />
          <span className="bg-emerald-500/30 text-emerald-300 text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider hidden xs:inline-block">
            DELIVERY PARTNER
          </span>
          <p className="text-[11px] text-emerald-200/80 font-medium hidden sm:block">⭐ {profile?.rating || 5.0}</p>
        </div>

        {/* RIGHT: ONLINE/OFFLINE TOGGLE & NOTIFICATIONS & LOGOUT */}
        <div className="flex items-center gap-3">
          
          {/* ONLINE / OFFLINE TOGGLE BUTTON */}
          <button
            onClick={toggleAvailability}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl font-black text-xs transition-all shadow-md ${
              isOnline
                ? 'bg-emerald-500 text-emerald-950 hover:bg-emerald-400'
                : 'bg-rose-600 text-white hover:bg-rose-700'
            }`}
          >
            <Power className="w-4 h-4 stroke-[2.5]" />
            <span>{isOnline ? '🟢 ONLINE' : '🔴 OFFLINE'}</span>
          </button>

          {/* NOTIFICATIONS */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2.5 rounded-2xl bg-emerald-900/60 text-emerald-200 hover:bg-emerald-800 transition-colors"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-amber-400 text-emerald-950 text-[10px] font-black rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white text-stone-900 border border-stone-200 rounded-3xl shadow-2xl z-50 p-4 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                  <span className="font-display font-extrabold text-xs text-stone-900 uppercase tracking-wider">Rider Alerts</span>
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                    {notifications.length} alerts
                  </span>
                </div>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {notifications.map(n => (
                    <div key={n.id} className="p-3 rounded-2xl bg-stone-50 border border-stone-100 space-y-0.5 text-xs">
                      <div className="flex justify-between font-extrabold">
                        <span>{n.title}</span>
                        <span className="text-[10px] text-stone-400">{n.time}</span>
                      </div>
                      <p className="text-stone-600 text-[11px] leading-tight">{n.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* LOGOUT BUTTON */}
          <button
            onClick={logoutRider}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 font-extrabold text-xs transition-colors"
            title="Log out of Rider App"
          >
            <LogOut className="w-3.5 h-3.5 text-emerald-300" />
            <span className="hidden sm:inline">Logout</span>
          </button>

        </div>

      </div>
    </header>
  );
}