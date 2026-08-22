import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { fetchShopkeeperOrders, updateOrderStatusInSupabase } from '../../services/orderService';
import { fetchProductsByStore, updateProductStockInSupabase } from '../../services/productService';
import { updateStoreStatus, updateStoreInSupabase } from '../../services/storeService';
import { validateStatusTransition } from '../services/shopkeeperService';
import { get10DigitPhone } from '../../services/authService';

export const ShopkeeperContext = createContext();

export const ShopkeeperProvider = ({ children }) => {
  const [authUser, setAuthUser] = useState(() => {
    try {
      const saved = localStorage.getItem('gharsee_shopkeeper_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  
  // Persist isLoggedIn state - only true if a valid user object exists
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    try {
      const savedUser = localStorage.getItem('gharsee_shopkeeper_user');
      return Boolean(savedUser && localStorage.getItem('gharsee_shopkeeper_logged_in') === 'true');
    } catch {
      return false;
    }
  });

  const [hasStore, setHasStore] = useState(() => {
    try {
      return localStorage.getItem('gharsee_has_store') === 'true';
    } catch {
      return false;
    }
  });

  const [isCheckingStore, setIsCheckingStore] = useState(false);

  const [storeProfile, setStoreProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('gharsee_store_profile');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [orders, setOrders] = useState(() => {
    try {
      const saved = localStorage.getItem('gharsee_shopkeeper_orders');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [products, setProducts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [activeShopkeeperTab, setActiveShopkeeperTab] = useState('dashboard');
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [toasts, setToasts] = useState([]);

  // Query Supabase for store owned by authenticated user via owner_id or 10-digit phone
  const loadUserStoreFromSupabase = async (userId, userPhone) => {
    if (!isSupabaseConfigured) return;

    try {
      const cleanDigits = get10DigitPhone(userPhone);
      const { data: allShops, error } = await supabase.from('shops').select('*');

      let matchedShop = null;
      if (!error && allShops && allShops.length > 0) {
        matchedShop = allShops.find(s => 
          (userId && s.owner_id === userId) || 
          (cleanDigits && get10DigitPhone(s.phone) === cleanDigits)
        );
      }

      if (matchedShop) {
        if (userId && (!matchedShop.owner_id || matchedShop.owner_id !== userId)) {
          supabase
            .from('shops')
            .update({ owner_id: userId })
            .eq('id', matchedShop.id)
            .catch?.(() => {});
        }

        setHasStore(true);
        const statusLower = (matchedShop.status || '').toLowerCase();
        const isPending = statusLower === 'pending_approval' || statusLower === 'pending' || matchedShop.is_approved === false;
        const isApproved = !isPending && statusLower !== 'rejected';

        const prof = {
          id: matchedShop.id,
          name: matchedShop.name,
          ownerName: matchedShop.owner_name || 'Store Owner',
          phone: matchedShop.phone || userPhone,
          email: matchedShop.email || 'store@urgrozy.app',
          address: matchedShop.address || 'Chikkamagaluru, Karnataka',
          isOpen: matchedShop.is_open ?? (matchedShop.status === 'open' || matchedShop.status === 'active'),
          status: matchedShop.status,
          isApproved: isApproved,
          isPending: isPending,
          is_approved: matchedShop.is_approved,
          image: matchedShop.image_url || matchedShop.image || '/images/store_lakshmi.jpg',
          image_url: matchedShop.image_url || matchedShop.image || '/images/store_lakshmi.jpg',
          ...matchedShop
        };
        setStoreProfile(prof);
        try {
          localStorage.setItem('gharsee_has_store', 'true');
          localStorage.setItem('gharsee_store_profile', JSON.stringify(prof));
        } catch {}
      } else {
        setHasStore(false);
        setStoreProfile(null);
        try {
          localStorage.setItem('gharsee_has_store', 'false');
          localStorage.removeItem('gharsee_store_profile');
        } catch {}
      }
    } catch (err) {
      console.error('Error fetching shopkeeper store from Supabase:', err);
    }
  };

  // Check Supabase Authentication & Store Registration on Mount
  useEffect(() => {
    async function checkShopkeeperAuthAndStore() {
      if (!isSupabaseConfigured) {
        setIsCheckingStore(false);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const userPhone = user.phone || user.user_metadata?.phone;

          setAuthUser(user);
          setIsLoggedIn(true);
          try { 
            localStorage.setItem('gharsee_shopkeeper_logged_in', 'true'); 
            localStorage.setItem('gharsee_shopkeeper_user', JSON.stringify(user));
          } catch {}

          await loadUserStoreFromSupabase(user.id, userPhone);
        } else {
          setAuthUser(null);
          setIsLoggedIn(false);
          setHasStore(false);
          setStoreProfile(null);
          try {
            localStorage.removeItem('gharsee_shopkeeper_logged_in');
            localStorage.removeItem('gharsee_shopkeeper_user');
            localStorage.removeItem('gharsee_has_store');
            localStorage.removeItem('gharsee_store_profile');
          } catch {}
        }
      } catch (err) {
        console.error('Error checking shopkeeper auth:', err);
      } finally {
        setIsCheckingStore(false);
      }
    }

    checkShopkeeperAuthAndStore();

    if (isSupabaseConfigured) {
      const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          setAuthUser(session.user);
          setIsLoggedIn(true);
          try { localStorage.setItem('gharsee_shopkeeper_logged_in', 'true'); } catch {}
          await loadUserStoreFromSupabase(session.user.id, session.user.phone || session.user.user_metadata?.phone);
        } else if (event === 'SIGNED_OUT') {
          setAuthUser(null);
          setIsLoggedIn(false);
          setHasStore(false);
          setStoreProfile(null);
          try {
            localStorage.removeItem('gharsee_shopkeeper_logged_in');
            localStorage.removeItem('gharsee_shopkeeper_user');
            localStorage.removeItem('gharsee_has_store');
            localStorage.removeItem('gharsee_store_profile');
          } catch {}
        }
      });

      return () => {
        authListener?.subscription?.unsubscribe();
      };
    }
  }, []);

  // Fetch real shopkeeper orders & derive live notifications from Supabase
  const loadLiveOrders = async () => {
    const shopId = storeProfile?.id || null;
    const live = await fetchShopkeeperOrders(shopId);
    if (live && live.length > 0) {
      setOrders(live);
      try {
        localStorage.setItem('gharsee_shopkeeper_orders', JSON.stringify(live));
      } catch {}

      const liveAlerts = live.slice(0, 10).map(o => ({
        id: `notif_${o.id}`,
        title: `Order #${o.id} • ${o.status.toUpperCase()}`,
        message: `Customer ${o.customerName} (${o.customerPhone || o.phone}) ordered ${o.items?.length || 1} items totaling ₹${o.total}`,
        time: new Date(o.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        read: false,
        type: o.status === 'pending' ? 'alert' : 'info'
      }));
      setNotifications(liveAlerts);
    }
  };

  const loadLiveProducts = async () => {
    if (!storeProfile?.id) return;
    try {
      const fetched = await fetchProductsByStore(storeProfile.id);
      if (fetched && fetched.length > 0) {
        setProducts(fetched);
      }
    } catch {}
  };

  useEffect(() => {
    if (storeProfile?.id) {
      loadLiveOrders();
      loadLiveProducts();
    }

    if (isSupabaseConfigured && storeProfile?.id) {
      const orderChannel = supabase
        .channel(`public:orders:shopkeeper:${storeProfile.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
          const incomingStoreId = payload.new?.store_id || payload.old?.store_id;
          if (!incomingStoreId || incomingStoreId === storeProfile.id) {
            loadLiveOrders();
            if (payload.eventType === 'INSERT') {
              const isImg = payload.new?.order_type === 'image' || payload.new?.image_url;
              addShopkeeperToast(
                isImg 
                  ? `📸 New Grocery Image Order #${payload.new?.id || ''} Received!`
                  : `🔔 New Order #${payload.new?.id || ''} Received!`, 
                'success'
              );
            }
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(orderChannel);
      };
    }
  }, [storeProfile]);

  const addShopkeeperToast = (message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  };

  const removeShopkeeperToast = id => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Toggle Store Status (🟢 OPEN / 🔴 CLOSED)
  const toggleStoreStatus = () => {
    setStoreProfile(prev => {
      if (!prev) return prev;
      const newStatus = !prev.isOpen;
      const updated = { 
        ...prev, 
        isOpen: newStatus,
        is_open: newStatus,
        status: newStatus ? 'open' : 'closed'
      };

      try { 
        localStorage.setItem('gharsee_store_profile', JSON.stringify(updated)); 
        localStorage.setItem('gharsee_store_status_update', JSON.stringify({
          storeId: prev.id,
          isOpen: newStatus,
          status: newStatus ? 'open' : 'closed',
          timestamp: Date.now()
        }));
        window.dispatchEvent(new CustomEvent('gharsee_store_status_changed', { 
          detail: { 
            storeId: prev.id, 
            isOpen: newStatus, 
            status: newStatus ? 'open' : 'closed' 
          } 
        }));
      } catch {}

      addShopkeeperToast(`Store status updated: ${newStatus ? '🟢 STORE OPEN' : '🔴 STORE CLOSED'}`, 'info');

      if (prev.id) {
        updateStoreStatus(prev.id, newStatus).catch(err => {
          console.error('Failed to sync store status to Supabase:', err);
        });
      }

      return updated;
    });
  };

  const updateStoreProfile = (newDetails) => {
    setStoreProfile(prev => {
      const updated = { ...prev, ...newDetails };
      try { 
        localStorage.setItem('gharsee_store_profile', JSON.stringify(updated)); 
        window.dispatchEvent(new CustomEvent('gharsee_store_status_changed', { 
          detail: { 
            storeId: updated.id, 
            isOpen: updated.isOpen, 
            status: updated.status 
          } 
        }));
      } catch {}
      return updated;
    });
    addShopkeeperToast('Store profile updated successfully!', 'success');
  };

  // Order Workflow Actions
  const acceptOrder = async (orderId) => {
    const target = orders.find(o => o.id === orderId);
    if (!target || !storeProfile || String(target.storeId || target.store_id) !== String(storeProfile.id)) {
      addShopkeeperToast('You can only update orders for your own store.', 'error');
      return;
    }
    const updated = orders.map(o => {
      if (o.id === orderId) return { ...o, status: 'accepted' };
      return o;
    });
    setOrders(updated);
    try { localStorage.setItem('gharsee_shopkeeper_orders', JSON.stringify(updated)); } catch {}

    await updateOrderStatusInSupabase(orderId, 'accepted', null, storeProfile.id);
    addShopkeeperToast(`Order #${orderId} accepted successfully! ✓`, 'success');
  };

  const rejectOrder = async (orderId, reason) => {
    const target = orders.find(o => o.id === orderId);
    if (!target || !storeProfile || String(target.storeId || target.store_id) !== String(storeProfile.id)) {
      addShopkeeperToast('You can only update orders for your own store.', 'error');
      return;
    }
    const updated = orders.map(o => {
      if (o.id === orderId) return { ...o, status: 'rejected', rejectionReason: reason };
      return o;
    });
    setOrders(updated);
    try { localStorage.setItem('gharsee_shopkeeper_orders', JSON.stringify(updated)); } catch {}

    await updateOrderStatusInSupabase(orderId, 'rejected', null, storeProfile.id);
    addShopkeeperToast(`Order #${orderId} rejected.`, 'error');
  };

  const updateOrderStatus = async (orderId, nextStatus) => {
    const target = orders.find(o => o.id === orderId);
    if (!target || !storeProfile || String(target.storeId || target.store_id) !== String(storeProfile.id)) {
      addShopkeeperToast('You can only update orders for your own store.', 'error');
      return;
    }
    if (!validateStatusTransition(target.status, nextStatus)) {
      addShopkeeperToast(`Invalid status transition: ${target.status} → ${nextStatus}`, 'error');
      return;
    }
    const updated = orders.map(o => {
      if (o.id === orderId) return { ...o, status: nextStatus };
      return o;
    });
    setOrders(updated);
    try { localStorage.setItem('gharsee_shopkeeper_orders', JSON.stringify(updated)); } catch {}

    await updateOrderStatusInSupabase(orderId, nextStatus, null, storeProfile.id);
    addShopkeeperToast(`Order #${orderId} status updated to ${nextStatus.replace(/_/g, ' ').toUpperCase()}`, 'success');
  };

  const todayOrders = orders.length;
  const pendingOrders = orders.filter(o => o.status === 'pending');
  const preparingOrders = orders.filter(o => o.status === 'preparing');
  const readyOrders = orders.filter(o => o.status === 'ready');
  const totalSales = orders.filter(o => o.status !== 'rejected').reduce((sum, o) => sum + (o.total || 0), 0);
  const avgOrderValue = todayOrders > 0 ? Math.round(totalSales / todayOrders) : 0;
  const lowStockProducts = products.filter(p => p.stock <= p.minThreshold);

  const loginShopkeeper = async (userObj) => {
    setAuthUser(userObj);
    setIsLoggedIn(true);
    try {
      localStorage.setItem('gharsee_shopkeeper_logged_in', 'true');
      localStorage.setItem('gharsee_shopkeeper_user', JSON.stringify(userObj));
    } catch {}
    await loadUserStoreFromSupabase(userObj.id, userObj.phone);
  };

  const updateStock = async (productId, newStock) => {
    const parsed = parseInt(newStock, 10);
    if (isNaN(parsed)) return;
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, stock: parsed } : p));
    await updateProductStockInSupabase(productId, parsed);
    addShopkeeperToast(`Stock updated to ${parsed} units!`, 'success');
  };

  const logoutShopkeeper = async () => {
    if (isSupabaseConfigured) {
      try { await supabase.auth.signOut(); } catch {}
    }
    setAuthUser(null);
    setIsLoggedIn(false);
    setHasStore(false);
    setStoreProfile(null);
    try {
      localStorage.removeItem('gharsee_shopkeeper_logged_in');
      localStorage.removeItem('gharsee_shopkeeper_user');
      localStorage.removeItem('gharsee_has_store');
      localStorage.removeItem('gharsee_store_profile');
      localStorage.removeItem('gharsee_shopkeeper_orders');
    } catch {}
    addShopkeeperToast('Logged out of Store Partner Portal', 'info');
    window.location.href = '/';
  };

  return (
    <ShopkeeperContext.Provider
      value={{
        authUser,
        isLoggedIn,
        setIsLoggedIn,
        hasStore,
        setHasStore,
        isCheckingStore,
        storeProfile,
        setStoreProfile,
        orders,
        products,
        notifications,
        activeShopkeeperTab,
        selectedOrderId,
        toasts,
        todayOrders,
        pendingOrders,
        preparingOrders,
        readyOrders,
        totalSales,
        avgOrderValue,
        lowStockProducts,
        setActiveShopkeeperTab,
        setSelectedOrderId,
        toggleStoreStatus,
        updateStoreProfile,
        acceptOrder,
        rejectOrder,
        updateOrderStatus,
        updateStock,
        loadLiveProducts,
        setProducts,
        addShopkeeperToast,
        removeShopkeeperToast,
        loginShopkeeper,
        logoutShopkeeper
      }}
    >
      {children}
    </ShopkeeperContext.Provider>
  );
};

export const useShopkeeper = () => {
  const context = useContext(ShopkeeperContext);
  if (!context) throw new Error('useShopkeeper must be used within a ShopkeeperProvider');
  return context;
};

export default ShopkeeperProvider;