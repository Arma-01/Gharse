import React, { useState } from 'react';
import { useAdmin } from '../context/AdminContext';
import { 
  Bike, Search, CheckCircle2, XCircle, Phone, 
  AlertTriangle, ShieldCheck, FileText, MapPin, 
  Eye, X, Calendar, Award, AlertOctagon, RotateCcw,
  Ban, Check, MessageSquare
} from 'lucide-react';

export default function AdminRidersTab() {
  const { riders, approveRider, rejectRider, suspendRider, reactivateRider } = useAdmin();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('pending'); // 'pending' | 'approved' | 'rejected' | 'suspended' | 'all'
  const [selectedRider, setSelectedRider] = useState(null);

  // Rejection / Suspension Modal State
  const [actionModal, setActionModal] = useState({
    isOpen: false,
    type: 'reject', // 'reject' | 'suspend'
    rider: null,
    reason: ''
  });

  const pendingList = riders.filter(r => r.approvalStatus === 'pending' || r.isPending);
  const approvedList = riders.filter(r => (r.approvalStatus === 'approved' || r.isApproved) && r.isActive !== false);
  const rejectedList = riders.filter(r => r.approvalStatus === 'rejected' || r.status === 'rejected');
  const suspendedList = riders.filter(r => r.approvalStatus === 'suspended' || r.status === 'suspended');

  const filteredRiders = riders.filter((r) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || (
      (r.fullName || '').toLowerCase().includes(q) ||
      (r.phone || '').includes(q) ||
      (r.vehicleNumber || '').toLowerCase().includes(q) ||
      (r.drivingLicense || '').toLowerCase().includes(q) ||
      (r.deliveryCity || '').toLowerCase().includes(q)
    );

    if (!matchesSearch) return false;

    if (filterStatus === 'pending') return r.approvalStatus === 'pending' || r.isPending;
    if (filterStatus === 'approved') return (r.approvalStatus === 'approved' || r.isApproved) && r.isActive !== false;
    if (filterStatus === 'rejected') return r.approvalStatus === 'rejected' || r.status === 'rejected';
    if (filterStatus === 'suspended') return r.approvalStatus === 'suspended' || r.status === 'suspended';
    return true;
  });

  const openActionModal = (type, rider) => {
    setActionModal({
      isOpen: true,
      type,
      rider,
      reason: type === 'reject' ? 'Incomplete or unverified documentation' : 'Temporary operational suspension'
    });
  };

  const handleConfirmAction = async () => {
    if (!actionModal.rider) return;
    const { type, rider, reason } = actionModal;
    setActionModal({ isOpen: false, type: 'reject', rider: null, reason: '' });

    if (type === 'reject') {
      await rejectRider(rider.id, rider.fullName, reason, rider);
    } else if (type === 'suspend') {
      await suspendRider(rider.id, rider.fullName, reason, rider);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* HEADER & CONTROLS */}
      <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-4">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-black text-stone-900 flex items-center gap-2">
              <Bike className="w-6 h-6 text-emerald-800" />
              <span>Rider Applications & Fleet Management</span>
            </h2>
            <p className="text-xs text-stone-500 font-medium mt-1">
              Verify driving licenses, vehicle registrations, and approve delivery partners before they can receive live customer orders.
            </p>
          </div>

          {pendingList.length > 0 && (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-xs font-black shrink-0">
              <AlertTriangle className="w-4 h-4 text-amber-700" />
              <span>{pendingList.length} Awaiting Verification</span>
            </div>
          )}
        </div>

        {/* SEARCH & SEGMENTED TABS */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          
          {/* SEARCH BAR */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search rider name, vehicle, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-stone-50 border border-stone-300 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-semibold text-stone-900 focus:outline-none focus:border-emerald-600 placeholder:text-stone-400"
            />
          </div>

          {/* STATUS TABS */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            <button
              onClick={() => setFilterStatus('pending')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                filterStatus === 'pending'
                  ? 'bg-amber-400 text-stone-950 font-black shadow-xs'
                  : 'bg-stone-100 text-amber-900 hover:bg-amber-50 border border-amber-200'
              }`}
            >
              <span>Pending Review ({pendingList.length})</span>
              {pendingList.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping" />
              )}
            </button>

            <button
              onClick={() => setFilterStatus('approved')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                filterStatus === 'approved'
                  ? 'bg-emerald-800 text-white font-extrabold shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:text-stone-900 border border-stone-200'
              }`}
            >
              Approved Fleet ({approvedList.length})
            </button>

            <button
              onClick={() => setFilterStatus('rejected')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                filterStatus === 'rejected'
                  ? 'bg-rose-700 text-white font-extrabold shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:text-stone-900 border border-stone-200'
              }`}
            >
              Rejected ({rejectedList.length})
            </button>

            <button
              onClick={() => setFilterStatus('suspended')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                filterStatus === 'suspended'
                  ? 'bg-stone-800 text-white font-extrabold shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:text-stone-900 border border-stone-200'
              }`}
            >
              Suspended ({suspendedList.length})
            </button>

            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                filterStatus === 'all'
                  ? 'bg-stone-900 text-white font-extrabold shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:text-stone-900 border border-stone-200'
              }`}
            >
              All ({riders.length})
            </button>
          </div>

        </div>
      </div>

      {/* RIDERS GRID */}
      {filteredRiders.length === 0 ? (
        <div className="bg-white rounded-3xl border border-stone-200 p-12 text-center space-y-2 shadow-xs">
          <Bike className="w-10 h-10 text-stone-400 mx-auto" />
          <p className="text-sm font-bold text-stone-800">No Riders Found in this Section</p>
          <p className="text-xs text-stone-500">
            {filterStatus === 'pending' 
              ? 'All rider onboarding applications have been processed!' 
              : 'Try changing your search query or switching filters.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRiders.map((rider) => {
            const isPending = rider.approvalStatus === 'pending' || rider.isPending;
            const isApproved = (rider.approvalStatus === 'approved' || rider.isApproved) && rider.isActive !== false;
            const isRejected = rider.approvalStatus === 'rejected';
            const isSuspended = rider.approvalStatus === 'suspended';

            return (
              <div 
                key={rider.id || rider.phone}
                className={`bg-white rounded-3xl border p-5 transition-all flex flex-col justify-between space-y-4 shadow-xs hover:shadow-md ${
                  isPending
                    ? 'border-amber-300 ring-2 ring-amber-200/60'
                    : isRejected
                    ? 'border-rose-200 bg-rose-50/20'
                    : isSuspended
                    ? 'border-stone-300 bg-stone-50/50'
                    : 'border-stone-200 hover:border-emerald-300'
                }`}
              >
                
                <div className="space-y-3">
                  {/* RIDER HEADER */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-display font-black text-stone-900 text-base truncate">{rider.fullName}</h3>
                        
                        {isPending && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 shrink-0 flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            PENDING
                          </span>
                        )}

                        {isApproved && (
                          rider.isOnline ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300 shrink-0">
                              🟢 ONLINE
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 shrink-0">
                              OFFLINE
                            </span>
                          )
                        )}

                        {isRejected && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300 shrink-0">
                            REJECTED
                          </span>
                        )}

                        {isSuspended && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-stone-200 text-stone-800 border border-stone-400 shrink-0">
                            SUSPENDED
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-stone-500 flex items-center gap-1 mt-1 font-medium">
                        <Phone className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <span>{rider.phone || 'No phone'}</span>
                      </p>
                    </div>

                    <span className="text-xs font-black text-stone-900 bg-stone-50 px-2.5 py-1 rounded-xl border border-stone-200 shrink-0">
                      ⭐ {rider.rating || 5.0}
                    </span>
                  </div>

                  {/* VEHICLE & LICENSE DETAILS */}
                  <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200/80 text-xs space-y-2 text-stone-700">
                    <div className="flex items-center justify-between">
                      <span className="text-stone-500 font-medium">Vehicle:</span>
                      <span className="font-extrabold uppercase text-emerald-800">{rider.vehicleType}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-stone-500 font-medium">Reg Plate:</span>
                      <span className="font-mono font-bold text-stone-900 uppercase">{rider.vehicleNumber}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-stone-500 font-medium flex items-center gap-1">
                        <FileText className="w-3 h-3 text-stone-400" />
                        <span>License ID:</span>
                      </span>
                      <span className="font-mono font-semibold text-stone-800 uppercase">{rider.drivingLicense}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-stone-500 font-medium flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-stone-400" />
                        <span>City:</span>
                      </span>
                      <span className="font-bold text-stone-800 truncate max-w-[140px]">{rider.deliveryCity}</span>
                    </div>

                    {(isRejected || isSuspended) && rider.rejectionReason && (
                      <div className="pt-1 border-t border-stone-200 text-[11px] text-rose-800 font-medium">
                        <span className="font-bold">Reason:</span> {rider.rejectionReason}
                      </div>
                    )}
                  </div>
                </div>

                {/* ACTION BUTTONS */}
                <div className="space-y-2 pt-2 border-t border-stone-100">
                  
                  {/* VIEW DETAILS BUTTON */}
                  <button
                    onClick={() => setSelectedRider(rider)}
                    className="w-full py-2 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-stone-600" />
                    <span>View Inspection Sheet</span>
                  </button>

                  {/* PENDING ACTIONS */}
                  {isPending && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => openActionModal('reject', rider)}
                        className="py-2 px-3 rounded-xl bg-white hover:bg-rose-50 text-stone-700 hover:text-rose-700 border border-stone-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <XCircle className="w-4 h-4 text-rose-500" />
                        <span>Reject</span>
                      </button>

                      <button
                        onClick={() => approveRider(rider.id, rider.fullName, rider)}
                        className="py-2 px-3 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Approve & Activate</span>
                      </button>
                    </div>
                  )}

                  {/* APPROVED FLEET ACTIONS */}
                  {isApproved && (
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => openActionModal('suspend', rider)}
                        className="flex-1 py-1.5 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Suspend</span>
                      </button>

                      <button
                        onClick={() => openActionModal('reject', rider)}
                        className="py-1.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Revoke</span>
                      </button>
                    </div>
                  )}

                  {/* REJECTED ACTIONS */}
                  {isRejected && (
                    <button
                      onClick={() => approveRider(rider.id, rider.fullName, rider)}
                      className="w-full py-2 px-3 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Re-evaluate & Approve</span>
                    </button>
                  )}

                  {/* SUSPENDED ACTIONS */}
                  {isSuspended && (
                    <button
                      onClick={() => reactivateRider(rider.id, rider.fullName, rider)}
                      className="w-full py-2 px-3 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Reactivate & Restore</span>
                    </button>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* INSPECTION SHEET MODAL */}
      {selectedRider && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* MODAL HEADER */}
            <div className="p-6 bg-gradient-to-r from-emerald-900 to-stone-900 text-white flex items-center justify-between relative">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-emerald-400">
                  <Bike className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-display font-black text-xl leading-tight">{selectedRider.fullName}</h3>
                  <p className="text-emerald-300 text-xs font-semibold">Delivery Partner Dossier</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRider(null)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* MODAL BODY */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              
              {/* STATUS BANNER */}
              <div className={`p-3 rounded-2xl border flex items-center justify-between text-xs font-bold ${
                selectedRider.approvalStatus === 'pending' || selectedRider.isPending
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : selectedRider.approvalStatus === 'approved' || selectedRider.isApproved
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : selectedRider.approvalStatus === 'suspended'
                  ? 'bg-stone-100 border-stone-300 text-stone-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span>
                    {selectedRider.approvalStatus === 'pending' || selectedRider.isPending
                      ? '⏳ PENDING ADMIN VERIFICATION'
                      : selectedRider.approvalStatus === 'approved' || selectedRider.isApproved
                      ? '✅ VERIFIED & ACTIVE RIDER'
                      : selectedRider.approvalStatus === 'suspended'
                      ? '⏸️ ACCOUNT SUSPENDED'
                      : '❌ APPLICATION REJECTED'}
                  </span>
                </div>
                <span className="text-stone-700">⭐ {selectedRider.rating || 5.0} Rating</span>
              </div>

              {/* RIDER PROFILE DATA SHEET */}
              <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200 space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                  <span className="text-stone-500 font-medium">Full Name:</span>
                  <span className="font-black text-stone-900 text-sm">{selectedRider.fullName}</span>
                </div>

                <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                  <span className="text-stone-500 font-medium">Contact Phone:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-stone-900">{selectedRider.phone}</span>
                    <a
                      href={`tel:${selectedRider.phone}`}
                      className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 font-bold hover:bg-emerald-200 transition-colors flex items-center gap-1"
                    >
                      <Phone className="w-3 h-3" />
                      <span>Call</span>
                    </a>
                  </div>
                </div>

                <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                  <span className="text-stone-500 font-medium">Vehicle Type:</span>
                  <span className="font-extrabold uppercase text-emerald-800">{selectedRider.vehicleType}</span>
                </div>

                <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                  <span className="text-stone-500 font-medium">Vehicle Registration Plate:</span>
                  <span className="font-mono font-black px-2 py-0.5 rounded-md bg-stone-900 text-amber-400 uppercase tracking-wide">
                    {selectedRider.vehicleNumber}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                  <span className="text-stone-500 font-medium flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-stone-400" />
                    <span>Driving License Number:</span>
                  </span>
                  <span className="font-mono font-bold px-2 py-0.5 rounded-md bg-stone-200 text-stone-900 uppercase">
                    {selectedRider.drivingLicense}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                  <span className="text-stone-500 font-medium flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-stone-400" />
                    <span>Operating City:</span>
                  </span>
                  <span className="font-bold text-stone-800">{selectedRider.deliveryCity}</span>
                </div>

                <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                  <span className="text-stone-500 font-medium flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-stone-400" />
                    <span>Total Deliveries Completed:</span>
                  </span>
                  <span className="font-bold text-stone-900">{selectedRider.totalDeliveries || 0} Orders</span>
                </div>

                {selectedRider.rejectionReason && (
                  <div className="flex items-start justify-between border-b border-stone-200 pb-2 text-rose-800">
                    <span className="font-bold">Remarks / Reason:</span>
                    <span className="font-semibold text-right max-w-[200px]">{selectedRider.rejectionReason}</span>
                  </div>
                )}

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
                {selectedRider.approvalStatus === 'pending' || selectedRider.isPending ? (
                  <>
                    <button
                      onClick={() => {
                        const r = selectedRider;
                        setSelectedRider(null);
                        openActionModal('reject', r);
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
                      <span>Approve & Activate Rider</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={async () => {
                      const r = selectedRider;
                      setSelectedRider(null);
                      openActionModal('reject', r);
                    }}
                    className="py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Revoke Verification</span>
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* REJECTION / SUSPENSION REASON MODAL */}
      {actionModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-stone-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                {actionModal.type === 'reject' ? (
                  <AlertOctagon className="w-5 h-5 text-rose-600" />
                ) : (
                  <Ban className="w-5 h-5 text-amber-600" />
                )}
                <h3 className="font-display font-black text-lg text-stone-900">
                  {actionModal.type === 'reject' ? 'Reject Rider Application' : 'Suspend Rider Account'}
                </h3>
              </div>
              <button
                onClick={() => setActionModal({ isOpen: false, type: 'reject', rider: null, reason: '' })}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-stone-600">
              Please enter the reason for {actionModal.type === 'reject' ? 'rejecting' : 'suspending'}{' '}
              <strong>{actionModal.rider?.fullName || 'this rider'}</strong>. This will be visible in their rider portal.
            </p>

            <div>
              <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                Reason / Remarks
              </label>
              <textarea
                rows={3}
                value={actionModal.reason}
                onChange={(e) => setActionModal(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="E.g., Invalid vehicle registration number, expired license..."
                className="w-full bg-stone-50 border border-stone-300 rounded-2xl p-3 text-xs font-semibold text-stone-900 focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActionModal({ isOpen: false, type: 'reject', rider: null, reason: '' })}
                className="py-2.5 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                className={`py-2.5 px-5 rounded-xl text-white font-extrabold text-xs shadow-md transition-all cursor-pointer ${
                  actionModal.type === 'reject' 
                    ? 'bg-rose-600 hover:bg-rose-700' 
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                Confirm {actionModal.type === 'reject' ? 'Rejection' : 'Suspension'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}