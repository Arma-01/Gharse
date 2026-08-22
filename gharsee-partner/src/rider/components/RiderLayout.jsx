import React, { Component } from 'react';
import { useRider } from '../context/RiderContext';
import RiderLogin from './RiderLogin';
import RiderHeader from './RiderHeader';
import RiderSidebar from './RiderSidebar';
import RiderBottomNav from './RiderBottomNav';
import RiderDashboard from './RiderDashboard';
import RiderDeliveriesPage from './RiderDeliveriesPage';
import RiderEarningsPage from './RiderEarningsPage';
import RiderHistoryPage from './RiderHistoryPage';
import RiderProfilePage from './RiderProfilePage';
import RiderSettingsPage from './RiderSettingsPage';
import RiderToastContainer from './RiderToastContainer';
import RiderIncomingRequestModal from './RiderIncomingRequestModal';
import RiderPendingApprovalView from './RiderPendingApprovalView';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';

class RiderErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Rider App Layout Crash Caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FBF9F5] flex flex-col items-center justify-center p-6 text-center space-y-4 font-sans">
          <div className="w-16 h-16 rounded-3xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto shadow-inner">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h2 className="font-display font-extrabold text-2xl text-stone-900">UR GROZY Delivery Partner App</h2>
            <p className="text-stone-500 text-xs sm:text-sm max-w-md mx-auto">
              Connecting to Rider operations network. Click below to refresh your rider session.
            </p>
          </div>
          <button
            onClick={() => {
              try {
                localStorage.removeItem('gharsee_rider_logged_in');
                localStorage.removeItem('gharsee_rider_profile');
              } catch {}
              window.location.href = '/rider';
            }}
            className="py-3 px-6 bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-xs rounded-2xl shadow-lg transition-all flex items-center gap-2 mx-auto cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>RELOAD RIDER APP</span>
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function RiderLayoutInner() {
  const { 
    authUser,
    isLoggedIn, 
    isCheckingAuth,
    profile,
    activeRiderTab, 
    incomingNotification, 
    acceptIncomingNotification, 
    declineIncomingNotification,
    logoutRider
  } = useRider();

  // 1. Loading state while verifying Supabase authentication & rider profile
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#FBF9F5] flex flex-col items-center justify-center space-y-4 font-sans">
        <Loader2 className="w-12 h-12 text-emerald-700 animate-spin" />
        <div className="text-center space-y-1">
          <h3 className="font-display font-extrabold text-stone-900 text-lg">Connecting to Rider Network</h3>
          <p className="text-stone-500 text-xs">Checking authorization & delivery profile...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <RiderLogin />;
  }

  // Role segregation check
  const userRole = authUser?.user_metadata?.role || authUser?.role;
  if (userRole === 'shopkeeper') {
    return (
      <div className="min-h-screen bg-[#FBF9F5] flex flex-col items-center justify-center p-6 text-center space-y-4 font-sans">
        <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto shadow-inner">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div className="space-y-1 max-w-md">
          <h2 className="font-display font-extrabold text-2xl text-stone-900">Store Partner Account Detected</h2>
          <p className="text-stone-600 text-xs sm:text-sm">
            You are currently signed in with a <b>Store Partner (Shopkeeper)</b> account. To access the Delivery Partner App, please switch to a rider account.
          </p>
        </div>
        <div className="flex gap-3 pt-2">
          <button
            onClick={logoutRider}
            className="py-3 px-6 bg-stone-200 hover:bg-stone-300 text-stone-800 font-extrabold text-xs rounded-2xl transition-all cursor-pointer"
          >
            Switch Account
          </button>
          <a
            href="/shopkeeper"
            className="py-3 px-6 bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-xs rounded-2xl shadow-lg transition-all"
          >
            Open Store Portal
          </a>
        </div>
      </div>
    );
  }

  // Strict Rider Verification Gate: Rider MUST be explicitly approved by Admin to enter dashboard
  const isApproved = Boolean(
    profile &&
    (profile.is_approved === true || profile.isApproved === true || profile.status === 'approved' || profile.status === 'active') &&
    !profile.isPending &&
    profile.status !== 'pending_approval' &&
    profile.status !== 'pending' &&
    profile.status !== 'rejected'
  );

  if (!isApproved) {
    return <RiderPendingApprovalView onLogout={logoutRider} />;
  }

  return (
    <div className="min-h-screen bg-[#FBF9F5] flex text-stone-900 font-sans pb-16 md:pb-0 relative">
      
      {/* REALTIME INCOMING DELIVERY REQUEST POPUP OVERLAY */}
      {incomingNotification && (
        <RiderIncomingRequestModal
          notification={incomingNotification}
          onAccept={acceptIncomingNotification}
          onDecline={declineIncomingNotification}
        />
      )}

      {/* DESKTOP SIDEBAR */}
      <RiderSidebar />

      {/* MAIN VIEWPORT CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* TOP HEADER */}
        <RiderHeader />

        {/* TAB ROUTED MAIN CONTENT */}
        <main className="flex-1">
          {activeRiderTab === 'dashboard' && <RiderDashboard />}
          {activeRiderTab === 'deliveries' && <RiderDeliveriesPage />}
          {activeRiderTab === 'earnings' && <RiderEarningsPage />}
          {activeRiderTab === 'history' && <RiderHistoryPage />}
          {activeRiderTab === 'profile' && <RiderProfilePage />}
          {activeRiderTab === 'settings' && <RiderSettingsPage />}
        </main>

        {/* MOBILE BOTTOM NAVIGATION BAR */}
        <RiderBottomNav />

        {/* RIDER TOASTS */}
        <RiderToastContainer />

      </div>

    </div>
  );
}

export default function RiderLayout() {
  return (
    <RiderErrorBoundary>
      <RiderLayoutInner />
    </RiderErrorBoundary>
  );
}