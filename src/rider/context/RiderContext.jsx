import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { 
  fetchRiderDeliveries, 
  updateOrderStatusInSupabase, 
  assignStoreToAnyStoreOrder, 
  claimRiderOrderInSupabase 
} from '../../services/orderService';
import { get10DigitPhone } from '../../services/authService';
import { 
  updateRiderOnlineStatusInSupabase, 
  fetchRiderProfileFromSupabase, 
  normalizeRiderProfile 
} from '../../services/riderService';
import { 
  subscribeToRiderNotifications, 
  fetchPendingRiderNotification, 
  respondToRiderNotification 
} from '../services/notificationService';
import { 
  playIncomingPing, 
  playAcceptChime, 
  playDeclineThud 
} from '../utils/notificationSound';
import { INITIAL_RIDER_EARNINGS } from '../data/earnings';
import { INITIAL_RIDER_PROFILE } from '../data/profile';
import { INITIAL_RIDER_NOTIFICATIONS } from '../data/notifications';

export const RiderContext = createContext();

export const RiderProvider = ({ children }) => {
  const [authUser, setAuthUser] = useState(() => {
    try {
      const saved = localStorage.getItem('gharsee_rider_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    try {
      const savedUser = localStorage.getItem('gharsee_rider_user');
      return Boolean(savedUser && localStorage.getItem('gharsee_rider_logged_in') === 'true');
    } catch {
      return false;
    }
  });

  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [incomingRequest, setIncomingRequest] = useState(null);
  const [incomingNotification, setIncomingNotification] = useState(null);
  const [activeDelivery, setActiveDelivery] = useState(null);
  const [history, setHistory] = useState([]);

  // Live Rider Earnings initialized from localStorage or INITIAL_RIDER_EARNINGS (Zeroed defaults)
  const [earnings, setEarnings] = useState(() => {
    try {
      const saved = localStorage.getItem('gharsee_rider_earnings');
      return saved ? JSON.parse(saved) : INITIAL_RIDER_EARNINGS;
    } catch {
      return INITIAL_RIDER_EARNINGS;
    }
  });
  
  // Persist rider profile state from Supabase or localStorage
  const [profile, setProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('gharsee_rider_profile');
      return saved ? JSON.parse(saved) : INITIAL_RIDER_PROFILE;
    } catch {
      return INITIAL_RIDER_PROFILE;
    }
  });

  const [notifications, setNotifications] = useState(INITIAL_RIDER_NOTIFICATIONS);
  const [activeRiderTab, setActiveRiderTab] = useState('dashboard');
  const [toasts, setToasts] = useState([]);

  const addRiderToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  }, []);

  const removeRiderToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Derive live earnings from real completed deliveries in Supabase
  const calculateLiveEarningsFromHistory = (historyList) => {
    if (!historyList || historyList.length === 0) {
      return INITIAL_RIDER_EARNINGS;
    }

    const todayCount = historyList.length;
    const totalEarnings = historyList.reduce((sum, h) => sum + (h.earnings || h.estimatedEarnings || 65), 0);
    const base = Math.round(totalEarnings * 0.85);
    const tips = Math.round(totalEarnings * 0.10);
    const bonuses = totalEarnings - base - tips;

    return {
      today: totalEarnings,
      todayDeliveries: todayCount,
      todayDistanceKm: (todayCount * 3.8).toFixed(1),
      thisWeek: totalEarnings,
      thisMonth: totalEarnings,
      baseEarnings: base,
      bonuses: bonuses,
      tips: tips,
      weeklyChart: [
        { day: 'Mon', amount: 0 },
        { day: 'Tue', amount: 0 },
        { day: 'Wed', amount: 0 },
        { day: 'Thu', amount: 0 },
        { day: 'Fri', amount: 0 },
        { day: 'Sat', amount: 0 },
        { day: 'Sun', amount: totalEarnings }
      ]
    };
  };

  // Load Authoritative Rider Profile directly from Supabase
  const loadRiderProfileFromSupabase = async (userId, userPhone) => {
    const liveProfile = await fetchRiderProfileFromSupabase(userId, userPhone);
    if (liveProfile) {
      setProfile(liveProfile);
      setIsOnline(liveProfile.isOnline);
      try {
        localStorage.setItem('gharsee_rider_profile', JSON.stringify(liveProfile));
      } catch {}
      return liveProfile;
    }
    return null;
  };

  const refreshRiderProfile = async () => {
    const userId = authUser?.id;
    const userPhone = authUser?.phone || authUser?.user_metadata?.phone || profile?.phone;
    return await loadRiderProfileFromSupabase(userId, userPhone);
  };

  // Check Supabase Authentication session for Rider
  useEffect(() => {
    async function checkRiderAuth() {
      setIsCheckingAuth(true);

      const savedLoggedIn = localStorage.getItem('gharsee_rider_logged_in') === 'true';
      const savedUser = JSON.parse(localStorage.getItem('gharsee_rider_user') || 'null');
      const savedProfile = JSON.parse(localStorage.getItem('gharsee_rider_profile') || 'null');

      if (savedLoggedIn && savedUser) {
        setAuthUser(savedUser);
        setIsLoggedIn(true);
        if (savedProfile) {
          setProfile(savedProfile);
          setIsOnline(savedProfile.isOnline || false);
        }
      }

      try {
        if (isSupabaseConfigured) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            setAuthUser(session.user);
            setIsLoggedIn(true);
            try {
              localStorage.setItem('gharsee_rider_logged_in', 'true');
              localStorage.setItem('gharsee_rider_user', JSON.stringify(session.user));
            } catch {}
            await loadRiderProfileFromSupabase(session.user.id, session.user.phone || session.user.user_metadata?.phone);
          } else if (!savedLoggedIn) {
            setIsLoggedIn(false);
          }
        }
      } catch (err) {
        console.warn('Rider auth check non-fatal warning:', err);
        if (savedUser) {
          setAuthUser(savedUser);
          setIsLoggedIn(true);
          if (savedProfile) setProfile(savedProfile);
        }
      } finally {
        setIsCheckingAuth(false);
      }
    }

    checkRiderAuth();

    if (isSupabaseConfigured) {
      const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          setAuthUser(session.user);
          setIsLoggedIn(true);
          try { 
            localStorage.setItem('gharsee_rider_logged_in', 'true');
            localStorage.setItem('gharsee_rider_user', JSON.stringify(session.user));
          } catch {}
          await loadRiderProfileFromSupabase(session.user.id, session.user.phone || session.user.user_metadata?.phone);
        } else if (event === 'SIGNED_OUT') {
          setAuthUser(null);
          setIsLoggedIn(false);
          setProfile(INITIAL_RIDER_PROFILE);
          setEarnings(INITIAL_RIDER_EARNINGS);
          try {
            localStorage.removeItem('gharsee_rider_logged_in');
            localStorage.removeItem('gharsee_rider_user');
            localStorage.removeItem('gharsee_rider_profile');
            localStorage.removeItem('gharsee_rider_earnings');
          } catch {}
        }
      });

      return () => {
        authListener?.subscription?.unsubscribe();
      };
    }
  }, []);

  // Listen for external rider status change events (from Admin actions & BroadcastChannel)
  useEffect(() => {
    let riderBus = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        riderBus = new BroadcastChannel('gharsee_admin_rider_bus');
        riderBus.onmessage = (event) => {
          if (event.data?.type === 'RIDER_STATUS_UPDATE') {
            const data = event.data;
            const myPhone = get10DigitPhone(profile?.phone || authUser?.phone || authUser?.user_metadata?.phone);
            const targetPhone = get10DigitPhone(data.phone);

            if (
              data.riderId === profile?.id ||
              data.riderId === authUser?.id ||
              (data.userId && (data.userId === profile?.user_id || data.userId === authUser?.id)) ||
              (myPhone && targetPhone && myPhone === targetPhone)
            ) {
              if (data.isApproved) {
                setProfile(prev => ({
                  ...prev,
                  isApproved: true,
                  isPending: false,
                  status: data.status || 'approved',
                  is_approved: true
                }));
                addRiderToast('🎉 Your Rider account has been approved by Admin! Welcome to UR GROZY Delivery Partner!', 'success');
              } else if (data.status === 'rejected') {
                setProfile(prev => ({
                  ...prev,
                  isApproved: false,
                  isPending: false,
                  status: 'rejected',
                  is_approved: false,
                  isOnline: false
                }));
                setIsOnline(false);
              }
              refreshRiderProfile();
            }
          }
        };
      }
    } catch {}

    const handleStatusChange = () => {
      refreshRiderProfile();
    };

    window.addEventListener('gharsee_rider_status_changed', handleStatusChange);
    window.addEventListener('storage', handleStatusChange);

    return () => {
      if (riderBus) riderBus.close();
      window.removeEventListener('gharsee_rider_status_changed', handleStatusChange);
      window.removeEventListener('storage', handleStatusChange);
    };
  }, [authUser, profile?.id, profile?.phone, addRiderToast]);

  // Realtime Supabase listener on rider_profiles table for instant unlock when admin approves
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const channelName = 'public:rider_profiles:realtime_sync';
    const profileChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rider_profiles'
        },
        (payload) => {
          if (payload.new) {
            const cleanPhone = get10DigitPhone(profile?.phone || authUser?.phone || authUser?.user_metadata?.phone);
            const isMatch = 
              (profile?.id && (payload.new.id === profile.id || payload.new.user_id === profile.id)) ||
              (authUser?.id && (payload.new.user_id === authUser.id || payload.new.id === authUser.id)) ||
              (cleanPhone && get10DigitPhone(payload.new.phone) === cleanPhone);

            if (isMatch) {
              const updated = normalizeRiderProfile(payload.new, authUser?.id, profile?.phone);
              const wasApproved = profile?.approvalStatus === 'approved' || profile?.isApproved;
              const isNowApproved = updated.approvalStatus === 'approved' && updated.isActive;

              setProfile(updated);
              setIsOnline(updated.isOnline);
              try { localStorage.setItem('gharsee_rider_profile', JSON.stringify(updated)); } catch {}

              if (isNowApproved && !wasApproved) {
                addRiderToast('🎉 Your Rider account has been approved by Admin! Welcome to UR GROZY Delivery Partner!', 'success');
              } else if (updated.approvalStatus === 'rejected' && wasApproved) {
                addRiderToast('⚠️ Your Rider account verification was revoked by Admin.', 'error');
              } else if (updated.approvalStatus === 'suspended' && wasApproved) {
                addRiderToast('⚠️ Your Rider account has been suspended by Admin.', 'error');
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
    };
  }, [profile?.id, profile?.phone, profile?.approvalStatus, profile?.isApproved, authUser?.id, authUser?.phone, addRiderToast]);

  // Load live delivery tasks & calculate real earnings from Supabase (Strictly filtered by rider_id)
  useEffect(() => {
    async function loadLiveDeliveries() {
      if (isLoggedIn) {
        const res = await fetchRiderDeliveries(profile?.id);
        setIncomingRequest(res.incoming);
        setActiveDelivery(res.active);
        setHistory(res.history || []);

        if (res.history && res.history.length > 0) {
          const liveEarn = calculateLiveEarningsFromHistory(res.history);
          setEarnings(liveEarn);
          try {
            localStorage.setItem('gharsee_rider_earnings', JSON.stringify(liveEarn));
          } catch {}
        }
      }
    }
    loadLiveDeliveries();
  }, [isLoggedIn, isOnline, profile?.id]);

  // Realtime Rider Notification Subscription for Instant Blinkit-Style Popup on Customer Order
  useEffect(() => {
    let realtimeChannel = null;
    let ordersChannel = null;

    async function initRiderNotifications() {
      if (!isLoggedIn || !isOnline) return;

      // 1. Fetch any unexpired pending notification on mount
      if (profile?.id) {
        const pendingNotif = await fetchPendingRiderNotification(profile.id);
        if (pendingNotif && !activeDelivery) {
          setIncomingNotification(pendingNotif);
          playIncomingPing();
        }

        // 2. Subscribe to rider_notifications Realtime
        realtimeChannel = subscribeToRiderNotifications(profile.id, (notifRecord) => {
          if (notifRecord.status === 'pending' && !activeDelivery) {
            setIncomingNotification(notifRecord);
            playIncomingPing();
          } else if (notifRecord.status === 'cancelled' || notifRecord.status === 'expired') {
            setIncomingNotification((prev) => (prev?.id === notifRecord.id ? null : prev));
          }
        });
      }

      // 3. Direct Supabase Realtime Listener on orders table INSERT event
      if (isSupabaseConfigured) {
        ordersChannel = supabase
          .channel('rider-global-orders-live')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'orders'
            },
            async (payload) => {
              const newOrder = payload.new;
              if (!newOrder || !isOnline || activeDelivery) return;

              const isImageOrder = Boolean(
                newOrder.order_type === 'image' ||
                newOrder.isDirectImageOrder ||
                newOrder.image_url ||
                (Array.isArray(newOrder.items) && newOrder.items.some(i => i && (i.isDirectImageOrder || i.image_url || i.image)))
              );

              const isAnyStoreOrder = newOrder.fulfillment_mode === 'shop_any_store' || !newOrder.store_id;

              // Broadcast real-time notifications for Grocery Image Orders & Any-Store Orders
              if (isImageOrder || isAnyStoreOrder) {
                const imageUrl = newOrder.image_url ||
                  (Array.isArray(newOrder.items) && (newOrder.items[0]?.image_url || newOrder.items[0]?.image)) ||
                  null;

                const customerNote = (newOrder.notes || newOrder.note || (Array.isArray(newOrder.items) && newOrder.items[0]?.note) || '').trim();

                const parsedItems = Array.isArray(newOrder.items)
                  ? newOrder.items.map(i => typeof i === 'string' ? { name: i, quantity: 1, unit: '1 unit', price: 0 } : {
                      name: i.name || i.product_name || i.itemName,
                      quantity: i.quantity || i.qty || 1,
                      unit: i.unit || i.quantityUnit || (i.isDirectImageOrder ? 'image order' : '1 unit'),
                      price: i.price || 0,
                      isManual: i.isManual || !i.product_id,
                      isDirectImageOrder: Boolean(i.isDirectImageOrder || i.image_url),
                      image_url: i.image_url || i.image || null,
                      note: i.note || ''
                    })
                  : [];

                const itemsList = isImageOrder
                  ? [`📸 Customer Grocery Photo List (${parsedItems[0]?.quantity || 1} image)`]
                  : (parsedItems.length > 0
                      ? parsedItems.map(i => `${i.name} (Quantity: ${i.quantity}, Weight: ${i.unit})`)
                      : ['Grocery Items']);

                const notifObj = {
                  id: `order-notif-${newOrder.id}`,
                  order_id: newOrder.id,
                  payload: {
                    orderId: newOrder.id,
                    order_type: isImageOrder ? 'image' : (newOrder.order_type || 'standard'),
                    isDirectImageOrder: isImageOrder,
                    isImageOrder: isImageOrder,
                    image_url: imageUrl,
                    image: imageUrl,
                    note: customerNote,
                    notes: customerNote,
                    storeName: isAnyStoreOrder ? 'Shop From Any Store (Rider Choice)' : (newOrder.store_name || 'Local Grocery Store'),
                    storePhone: '+91 81238 21300',
                    storeAddress: 'Market Road, Chikkamagaluru',
                    customerName: newOrder.customer_name || 'Customer',
                    customerPhone: newOrder.customer_phone || 'Phone not provided',
                    deliveryAddress: newOrder.delivery_address || 'Chikkamagaluru, Karnataka',
                    itemCount: itemsList.length,
                    items: itemsList,
                    parsedItems: parsedItems,
                    fulfillment_mode: isAnyStoreOrder ? 'shop_any_store' : 'store_selected',
                    isAnyStore: isAnyStoreOrder,
                    totalAmount: newOrder.total_amount || 0,
                    paymentStatus: newOrder.payment_method || 'Cash on Delivery',
                    estimatedEarnings: isAnyStoreOrder ? 85 : 65,
                    distance: 'Local Delivery',
                    estimatedTime: 'Delivery after 4:00 PM'
                  }
                };

                setIncomingNotification(notifObj);
                playIncomingPing();
              }
            }
          )
          .subscribe();
      }
    }

    initRiderNotifications();

    return () => {
      if (realtimeChannel) supabase.removeChannel(realtimeChannel);
      if (ordersChannel) supabase.removeChannel(ordersChannel);
    };
  }, [isLoggedIn, isOnline, profile?.id, !!activeDelivery]);


  // Toggle Rider Availability (UPDATES is_online COLUMN IN SUPABASE rider_profiles TABLE!)
  const toggleAvailability = async () => {
    const isApprovedAndActive = (profile?.approvalStatus === 'approved' || profile?.isApproved) && profile?.isActive !== false;
    if (!isApprovedAndActive) {
      addRiderToast('⚠️ Only approved and active delivery partners can go online.', 'error');
      return;
    }

    const nextState = !isOnline;
    setIsOnline(nextState);

    setProfile(prev => {
      const updated = { ...prev, isOnline: nextState };
      try {
        localStorage.setItem('gharsee_rider_profile', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    addRiderToast(`You are now ${nextState ? '🟢 ONLINE & Available' : '🔴 OFFLINE'}`, 'info');

    const riderPhone = profile?.phone || authUser?.phone || authUser?.user_metadata?.phone;
    if (riderPhone) {
      await updateRiderOnlineStatusInSupabase(riderPhone, nextState, authUser?.id || profile?.id);
    }
  };

  // Workflow: ACCEPT REALTIME NOTIFICATION POPUP (FIRST-ACCEPT-WINS IN SUPABASE)
  const acceptIncomingNotification = async (notificationObj) => {
    const payload = notificationObj.payload || {};
    const orderId = payload.orderId || notificationObj.order_id;

    // 1. Atomic first-accept-wins claim in Supabase
    const claimRes = await claimRiderOrderInSupabase(orderId, profile?.id, profile?.name);
    if (!claimRes.success && claimRes.reason === 'ALREADY_CLAIMED') {
      playDeclineThud();
      setIncomingNotification(null);
      setIncomingRequest(null);
      addRiderToast('⚠️ This delivery was already accepted by another partner.', 'error');
      return;
    }

    playAcceptChime();

    // 2. Update rider_notifications row to accepted if DB notification ID exists
    if (notificationObj.id && !notificationObj.id.startsWith('order-notif-')) {
      await respondToRiderNotification(notificationObj.id, 'accepted');
    }

    // 3. Set Active Delivery State with full Supabase details
    const activeObj = {
      id: orderId,
      store_id: payload.storeId || payload.store_id,
      storeName: payload.storeName || 'Local Grocery Store',
      storePhone: payload.storePhone || '+91 81238 21300',
      storeAddress: payload.storeAddress || 'Market Road, Chikkamagaluru',
      customerName: payload.customerName || 'Customer',
      customerPhone: payload.customerPhone || 'Phone not provided',
      deliveryAddress: payload.deliveryAddress || 'Chikkamagaluru, Karnataka',
      distance: payload.distance || 'Local Delivery',
      estimatedTime: payload.estimatedTime || 'Delivery after 4:00 PM',
      items: payload.items || ['Grocery Items'],
      parsedItems: payload.parsedItems || [],
      itemCount: payload.itemCount || (payload.items ? payload.items.length : 1),
      estimatedEarnings: payload.estimatedEarnings || (payload.isAnyStore ? 85 : 65),
      paymentStatus: payload.paymentStatus || 'Cash on Delivery',
      fulfillment_mode: payload.fulfillment_mode || (payload.isAnyStore ? 'shop_any_store' : 'store_selected'),
      isAnyStore: payload.isAnyStore || payload.fulfillment_mode === 'shop_any_store',
      status: 'accepted'
    };

    setActiveDelivery(activeObj);
    setIncomingNotification(null);
    setIncomingRequest(null);
    addRiderToast(`🎉 Order #${orderId} claimed! Product list loaded for store pickup.`, 'success');
  };

  // Workflow: DECLINE REALTIME NOTIFICATION POPUP
  const declineIncomingNotification = async (notificationId, reason = 'Declined by rider') => {
    playDeclineThud();
    setIncomingNotification(null);
    if (notificationId && !notificationId.startsWith('order-notif-')) {
      await respondToRiderNotification(notificationId, 'declined');
    }
    addRiderToast(`Delivery request declined (${reason}).`, 'info');
  };

  // Workflow: ACCEPT DELIVERY (Legacy)
  const acceptDelivery = async (deliveryObj) => {
    const claimRes = await claimRiderOrderInSupabase(deliveryObj.id, profile?.id, profile?.name);
    if (!claimRes.success && claimRes.reason === 'ALREADY_CLAIMED') {
      playDeclineThud();
      setIncomingRequest(null);
      addRiderToast('⚠️ This delivery was already accepted by another partner.', 'error');
      return;
    }

    playAcceptChime();
    const active = { ...deliveryObj, status: 'accepted' };
    setActiveDelivery(active);
    setIncomingRequest(null);
    addRiderToast(`Delivery #${deliveryObj.id} accepted! Product list ready for pickup.`, 'success');
  };

  // Workflow: DECLINE DELIVERY (Legacy)
  const declineDelivery = (deliveryId, reason) => {
    playDeclineThud();
    setIncomingRequest(null);
    addRiderToast(`Delivery request declined (${reason}).`, 'info');
  };

  // Workflow: RIDER SELECTS STORE FOR "SHOP FROM ANY STORE" ORDER
  const selectStoreForOrder = async (orderId, shopId, shopName) => {
    if (activeDelivery && activeDelivery.id === orderId) {
      setActiveDelivery(prev => ({
        ...prev,
        storeName: shopName,
        status: 'SHOPPING'
      }));
    }
    await assignStoreToAnyStoreOrder(orderId, shopId);
    addRiderToast(`Store selected: ${shopName}. Ready to purchase items!`, 'success');
  };

  // Workflow: CONFIRM PICKUP
  const confirmPickup = async () => {
    if (!activeDelivery) return;
    setActiveDelivery(prev => ({ ...prev, status: 'picked_up' }));
    await updateOrderStatusInSupabase(activeDelivery.id, 'picked_up');
    addRiderToast('Order pickup confirmed! Ready to start delivery.', 'success');
  };

  // Workflow: START DELIVERY
  const startDelivery = async () => {
    if (!activeDelivery) return;
    setActiveDelivery(prev => ({ ...prev, status: 'out_for_delivery' }));
    await updateOrderStatusInSupabase(activeDelivery.id, 'out_for_delivery');
    addRiderToast('Started delivery! Head to customer address.', 'success');
  };

  // Workflow: CONFIRM DELIVERY (Updates live rider earnings!)
  const confirmDeliveryWithOTP = async (otpInput) => {
    if (!activeDelivery) return false;

    const taskEarn = activeDelivery.estimatedEarnings || 65;

    const completedRecord = {
      id: activeDelivery.id,
      completedAt: 'Just now',
      storeName: activeDelivery.storeName,
      customerName: activeDelivery.customerName,
      deliveryAddress: activeDelivery.deliveryAddress,
      distance: activeDelivery.distance,
      earnings: taskEarn,
      paymentType: activeDelivery.paymentStatus,
      status: 'delivered'
    };

    const newHistory = [completedRecord, ...history];
    setHistory(newHistory);

    const updatedEarnings = {
      ...earnings,
      today: earnings.today + taskEarn,
      todayDeliveries: earnings.todayDeliveries + 1,
      todayDistanceKm: (parseFloat(earnings.todayDistanceKm || 0) + 4.2).toFixed(1),
      thisWeek: earnings.thisWeek + taskEarn,
      thisMonth: earnings.thisMonth + taskEarn,
      baseEarnings: earnings.baseEarnings + Math.round(taskEarn * 0.85),
      tips: earnings.tips + Math.round(taskEarn * 0.10)
    };

    setEarnings(updatedEarnings);
    try {
      localStorage.setItem('gharsee_rider_earnings', JSON.stringify(updatedEarnings));
    } catch {}

    await updateOrderStatusInSupabase(activeDelivery.id, 'delivered');
    addRiderToast(`🎉 Delivery Completed! +₹${taskEarn} added to earnings.`, 'success');
    setActiveDelivery(null);
    return true;
  };

  const loginRider = async (userObj) => {
    const liveProfile = normalizeRiderProfile(userObj, userObj?.id || userObj?.user_id, userObj?.phone);
    setAuthUser(userObj);
    setIsLoggedIn(true);
    setProfile(liveProfile);
    setIsOnline(liveProfile.isOnline);
    try {
      localStorage.setItem('gharsee_rider_logged_in', 'true');
      localStorage.setItem('gharsee_rider_user', JSON.stringify(userObj));
      localStorage.setItem('gharsee_rider_profile', JSON.stringify(liveProfile));
    } catch {}

    const riderPhone = userObj?.phone || userObj?.user_metadata?.phone;
    if (riderPhone || userObj?.id) {
      await loadRiderProfileFromSupabase(userObj.id, riderPhone);
    }
  };

  const logoutRider = async () => {
    const riderPhone = profile?.phone || authUser?.phone || authUser?.user_metadata?.phone;
    if (riderPhone) {
      await updateRiderOnlineStatusInSupabase(riderPhone, false, authUser?.id || profile?.id);
    }

    if (isSupabaseConfigured) {
      try { await supabase.auth.signOut(); } catch {}
    }
    setAuthUser(null);
    setIsLoggedIn(false);
    setIsOnline(false);
    setActiveDelivery(null);
    setIncomingNotification(null);
    setProfile(INITIAL_RIDER_PROFILE);
    setEarnings(INITIAL_RIDER_EARNINGS);
    try {
      localStorage.removeItem('gharsee_rider_logged_in');
      localStorage.removeItem('gharsee_rider_user');
      localStorage.removeItem('gharsee_rider_profile');
      localStorage.removeItem('gharsee_rider_earnings');
    } catch {}
    addRiderToast('Logged out of Delivery Partner Portal', 'info');
    window.location.href = '/';
  };

  return (
    <RiderContext.Provider
      value={{
        authUser,
        isLoggedIn,
        isCheckingAuth,
        isOnline,
        approvalStatus: profile?.approvalStatus || 'pending',
        isActive: Boolean(profile?.isActive),
        isApproved: Boolean(profile?.isApproved),
        rejectionReason: profile?.rejectionReason,
        activeDelivery,
        incomingRequest,
        incomingNotification,
        earnings,
        history,
        profile,
        riderProfile: profile,
        refreshRiderProfile,
        notifications,
        activeRiderTab,
        toasts,
        setActiveRiderTab,
        toggleAvailability,
        acceptIncomingNotification,
        declineIncomingNotification,
        acceptDelivery,
        declineDelivery,
        selectStoreForOrder,
        confirmPickup,
        startDelivery,
        confirmDeliveryWithOTP,
        addRiderToast,
        removeRiderToast,
        loginRider,
        logoutRider
      }}
    >
      {children}
    </RiderContext.Provider>
  );
};

export const useRider = () => {
  const context = useContext(RiderContext);
  if (!context) throw new Error('useRider must be used within a RiderProvider');
  return context;
};

export const userRider = useRider;

export default RiderProvider;