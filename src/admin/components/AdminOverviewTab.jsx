import React, { useState } from 'react';
import { useAdmin } from '../context/AdminContext';
import { 
  Store, Bike, Users, IndianRupee, Package,
  AlertTriangle, ShieldCheck, Eye, X, Phone, FileText,
  MapPin, CheckCircle2, XCircle, Award, Calendar
} from 'lucide-react';

export default function AdminOverviewTab() {
  const { 
    stats, 
    shops, 
    riders, 
    setActiveTab, 
    approveShop, 
    rejectShop, 
    approveRider, 
    rejectRider 
  } = useAdmin();

  const [selectedRider, setSelectedRider] = useState(null);

  const pendingShops = shops.filter(s => s.isPending);
  const pendingRiders = riders.filter(r => r.approvalStatus === 'pending' || r.isPending);

  return (
    <div className="space-y-8 font-sans">
      
      {/* WELCOME BANNER & ACTION CALLOUT */}
      <div className="relative rounded-3xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 text-white p-6 sm:p-8 shadow-xl overflow-hidden">
        {/* BACKGROUND GLOW ACCENTS */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-emerald-200 text-xs font-black uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              <span>UR GROZY Master Control</span>
            </div>
            <h2 className="font-display text-2xl sm:text-4xl font-black text-white tracking-tight">
              Network Operations Overview
            </h2>
            <p className="text-emerald-100/80 text-xs sm:text-sm max-w-2xl font-medium leading-relaxed">
              Review and approve pending darkstore registrations, verify new delivery partners, and manage live catalogs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {stats.pendingShopsCount > 0 && (
              <button
                onClick={() => setActiveTab('shops')}
                className="py-3 px-4.5 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-stone-950 font-black text-xs rounded-2xl shadow-lg transition-all flex items-center gap-2 cursor-pointer"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>{stats.pendingShopsCount} Store(s) Awaiting Review</span>
              </button>
            )}

            {stats.pendingRidersCount > 0 && (
              <button
                onClick={() => setActiveTab('riders')}
                className="py-3 px-4.5 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-stone-950 font-black text-xs rounded-2xl shadow-lg transition-all flex items-center gap-2 cursor-pointer"
              >
                <Bike className="w-4 h-4" />
                <span>{stats.pendingRidersCount} Rider(s) Awaiting Review</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('global-catalog')}
              className="py-3 px-4.5 bg-emerald-950/80 hover:bg-emerald-950 text-emerald-200 border border-emerald-700/60 font-black text-xs rounded-2xl shadow-lg transition-all flex items-center gap-2 cursor-pointer"
            >
              <Package className="w-4 h-4 text-emerald-400" />
              <span>Manage Global Catalog</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI METRICS GRID (6 CARDS) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        
        {/* PENDING SHOPS */}
        <div 
          onClick={() => setActiveTab('shops')}
          className={`p-5 rounded-3xl border transition-all cursor-pointer ${
            stats.pendingShopsCount > 0
              ? 'bg-amber-50/80 border-amber-300 hover:bg-amber-100/80 shadow-xs'
              : 'bg-white border-stone-200 hover:border-emerald-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-stone-500">
              Pending Stores
            </span>
            <Store className={`w-4 h-4 ${stats.pendingShopsCount > 0 ? 'text-amber-700' : 'text-stone-400'}`} />
          </div>
          <p className="font-display text-3xl font-black text-stone-900 mt-2">
            {stats.pendingShopsCount}
          </p>
          <p className="text-[11px] text-amber-700 font-bold mt-1">
            {stats.pendingShopsCount > 0 ? 'Action required' : 'Queue cleared'}
          </p>
        </div>

        {/* ACTIVE SHOPS */}
        <div 
          onClick={() => setActiveTab('shops')}
          className="p-5 rounded-3xl bg-white border border-stone-200 hover:border-emerald-300 transition-all cursor-pointer shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-stone-500">
              Active Stores
            </span>
            <Store className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="font-display text-3xl font-black text-stone-900 mt-2">
            {stats.approvedShopsCount}
          </p>
          <p className="text-[11px] text-stone-500 font-semibold mt-1">
            {stats.totalShopsCount} total registered
          </p>
        </div>

        {/* GLOBAL CATALOG */}
        <div 
          onClick={() => setActiveTab('global-catalog')}
          className="p-5 rounded-3xl bg-white border border-stone-200 hover:border-emerald-400 transition-all cursor-pointer shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-stone-500">
              Global Catalog
            </span>
            <Package className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="font-display text-3xl font-black text-emerald-800 mt-2">
            {stats.totalGlobalProductsCount}
          </p>
          <p className="text-[11px] text-emerald-700 font-semibold mt-1">
            Universal products
          </p>
        </div>

        {/* ACTIVE RIDERS */}
        <div 
          onClick={() => setActiveTab('riders')}
          className="p-5 rounded-3xl bg-white border border-stone-200 hover:border-emerald-300 transition-all cursor-pointer shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-stone-500">
              Active Riders
            </span>
            <Bike className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="font-display text-3xl font-black text-stone-900 mt-2">
            {stats.activeRidersCount}
          </p>
          <p className="text-[11px] text-stone-500 font-semibold mt-1">
            {stats.pendingRidersCount > 0 ? `${stats.pendingRidersCount} pending` : 'Fleet online'}
          </p>
        </div>

        {/* CUSTOMERS */}
        <div 
          onClick={() => setActiveTab('customers')}
          className="p-5 rounded-3xl bg-white border border-stone-200 hover:border-emerald-300 transition-all cursor-pointer shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-stone-500">
              Registered Users
            </span>
            <Users className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="font-display text-3xl font-black text-stone-900 mt-2">
            {stats.totalCustomersCount}
          </p>
          <p className="font-11px] text-stone-500 font-semibold mt-1">
            Chikkamagaluru base
          </p>
        </div>

        {/* REVENUE */}
        <div 
          onClick={() => setActiveTab('orders')}
          className="p-5 rounded-3xl bg-white border border-stone-200 hover:border-emerald-300 transition-all cursor-pointer shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-stone-500">
              Network GMV
            </span>
            <IndianRupee className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="font-display text-3xl font-black text-emerald-800 mt-2">
            ₹{stats.totalGmvRevenue.toLocaleString()}
          </p>
          <p className="text-[11px] text-stone-500 font-semibold mt-1">
            {stats.totalOrdersCount} orders placed
          </p>
        </div>

      </div>

      {/* PENDING APPROVALS QUEUE SECTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* PENDING SHOPS QUEUE */}
        <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-amber-600" />
              <h3 className="font-display font-black text-lg text-stone-900">
                Pending Store Registrations ({pendingShops.length})
              </h3>
            </div>
            <button
              onClick={() => setActiveTab('shops')}
              className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
            >
              View All Stores →
            </button>
          </div>

          {pendingShops.length === 0 ? (
            <div className="py-8 text-center text-stone-400 text-xs font-bold">
              ✓ All store registrations have been reviewed and approved.
            </div>
          ) : (
            <div className="space-y-3">
              {pendingShops.slice(0, 4).map(shop => (
                <div key={shop.id} className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 flex items-center justify-between gap-3">
                  <div>
                    <h5 className="font-black text-sm text-stone-900">{shop.name}</h5>
                    <p className="text-xs text-stone-500">{shop.locality || shop.city} • {shop.phone}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => approveShop(shop.id, shop.name)}
                      className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => rejectShop(shop.id, shop.name)}
                      className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* PENDING RIDERS QUEUE */}
        <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2">
              <Bike className="w-5 h-5 text-amber-600" />
              <h3 className="font-display font-black text-lg text-stone-900">
                Pending Rider Applications ({pendingRiders.length})
              </h3>
            </div>
            <button
              onClick={() => setActiveTab('riders')}
              className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
            >
              View All Riders →
            </button>
          </div>

          {pendingRiders.length === 0 ? (
            <div className="py-8 text-center text-stone-400 text-xs font-bold">
              ✓ All rider partner applications have been processed.
            </div>
          ) : (
            <div className="space-y-3">
              {pendingRiders.slice(0, 4).map(rider => (
                <div key={rider.id} className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 flex items-center justify-between gap-3">
                  <div>
                    <h5 className="font-black text-sm text-stone-900">{rider.fullName}</h5>
                    <p className="text-xs text-stone-500 font-medium">
                      <span className="font-bold text-emerald-800 uppercase">{rider.vehicleType}</span> ({rider.vehicleNumber}) • {rider.phone}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setSelectedRider(rider)}
                      className="px-2.5 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Info</span>
                    </button>
                    <button
                      onClick={() => approveRider(rider.id, rider.fullName, rider)}
                      className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                    >
                      Verify
                    </button>
                    <button
                      onClick={() => rejectRider(rider.id, rider.fullName, rider)}
                      className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* DETAILED RIDER INFO INSPECTION MODAL */}
      {selectedRider && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* MODAL HEADER */}
            <div className="p-6 bg-gradient-to-r from-emerald-900 to-stone-900 text-white flex items-center justify-between relative">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
                  <Bike className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-display font-black text-xl text-white">{selectedRider.fullName}</h3>
                  <p className="text-emerald-200 text-xs font-semibold flex items-center gap-1">
                    <span>Delivery Partner Application</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedRider(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* MODAL BODY */}
            <div className="p-6 overflow-y-auto space-y-4 text-stone-800 text-xs">
              
              {/* STATUS BANNER */}
              <div className={`p-3.5 rounded-2xl flex items-center justify-between ${
                selectedRider.isPending 
                  ? 'bg-amber-50 border border-amber-200 text-amber-900' 
                  : selectedRider.status === 'rejected'
                  ? 'bg-rose-50 border border-rose-200 text-rose-900'
                  : 'bg-emerald-50 border border-emerald-200 text-emerald-900'
              }`}>
                <div className="flex items-center gap-2">
                  {selectedRider.isPending ? (
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  )}
                  <span className="font-black uppercase">
                    {selectedRider.isPending 
                      ? '⏳ Pending Admin Verification' 
                      : selectedRider.status === 'rejected'
                      ? '🔴 Application Rejected'
                      : '🟢 Verified & Approved Delivery Partner'}
                  </span>
                </div>
                <span className="font-mono text-[11px] font-bold">
                  ⭐ {selectedRider.rating || 'N/A'} Rating
                </span>
              </div>

              {/* RIDER INFORMATION TABLE */}
              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-2.5">
                <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                  <span className="text-stone-500 font-medium">Full Name:</span>
                  <span className="font-bold text-stone-900 text-sm">{selectedRider.fullName}</span>
                </div>

                <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                  <span className="text-stone-500 font-medium">Contact Phone:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-stone-900">{selectedRider.phone}</span>
                    {selectedRider.phone && (
                      <a
                        href={`tel:${selectedRider.phone}`}
                        className="px-2 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-bold text-[10px] flex items-center gap-1"
                      >
                        <Phone className="w-2.5 h-2.5" /> Call
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                  <span className="text-stone-500 font-medium">Vehicle Type:</span>
                  <span className="font-extrabold uppercase text-emerald-800">{selectedRider.vehicleType}</span>
                </div>

                <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                  <span className="text-stone-500 font-medium">Vehicle Registration Plate:</span>
                  <span className="font-mono font-black text-xs px-2.5 py-0.5 rounded bg-stone-900 text-amber-300 border border-stone-800 uppercase tracking-wider">
                    {selectedRider.vehicleNumber}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                  <span className="text-stone-500 font-medium flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-stone-400" />
                    <span>Driving License Number:</span>
                  </span>
                  <span className="font-mono font-bold text-stone-900 uppercase bg-stone-200/80 px-2 py-0.5 rounded">
                    {selectedRider.drivingLicense}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                  <span className="text-stone-500 font-medium flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-stone-400" />
                    <span>Operating City:</span>
                  </span>
                  <span className="font-bold text-stone-900">{selectedRider.deliveryCity}</span>
                </div>

                <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                  <span className="text-stone-500 font-medium flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-stone-400" />
                    <span>Total Deliveries Completed:</span>
                  </span>
                  <span className="font-bold text-stone-900">{selectedRider.totalDeliveries || 0} Orders</span>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-stone-500 font-medium flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-stone-400" />
                    <span>Application Date:</span>
                  </span>
                  <span className="font-medium text-stone-600">
                    {new Date(selectedRider.createdAt).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })}
                  </span>
                </div>
              </div>

            </div>

            {/* MODAL FOOTER ACTIONS */}
            <div className="p-5 bg-stone-50 border-t border-stone-200 flex items-center justify-between gap-3">
              <button
                onClick={() => setSelectedRider(null)}
                className="py-2.5 px-4 rounded-xl bg-white border border-stone-300 hover:bg-stone-100 text-stone-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    await rejectRider(selectedRider.id, selectedRider.fullName, selectedRider);
                    setSelectedRider(null);
                  }}
                  className="py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Reject Application</span>
                </button>

                <button
                  onClick={async () => {
                    await approveRider(selectedRider.id, selectedRider.fullName, selectedRider);
                    setSelectedRider(null);
                  }}
                  className="py-2.5 px-5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Approve & Activate</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}