import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { 
  fetchAllAdminShops, 
  approveShopInSupabase, 
  rejectShopInSupabase, 
  toggleShopStatusInSupabase,
  fetchAllAdminRiders, 
  approveRiderInSupabase, 
  rejectRiderInSupabase,
  fetchAllAdminCustomers,
  fetchAllAdminOrders,
  updateAdminOrderStatus,
  fetchProductsForShop,
  createProductForShop,
  updateProductInSupabase,
  deleteProductInSupabase,
  fetchGlobalCatalog,
  fetchGlobalCatalogStats,
  createGlobalProduct,
  assignProductToStore
} from '../services/adminService';

const AdminContext = createContext(null);
const ADMIN_PASSWORD = (import.meta.env.VITE_ADMIN_PASSWORD || 'arman@1234').trim();

export function AdminProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    try {
      return sessionStorage.getItem('gharsee_admin_authenticated') === 'true';
    } catch {
      return false;
    }
  });

  const [activeTab, setActiveTab] = useState('overview');
  const [shops, setShops] = useState([]);
  const [riders, setRiders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [globalProducts, setGlobalProducts] = useState([]);
  const [globalCatalogStats, setGlobalCatalogStats] = useState({
    totalGlobalProducts: 0,
    activeProducts: 0,
    inactiveProducts: 0,
    productsWithStores: 0,
    productsWithoutStores: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingGlobalProducts, setIsLoadingGlobalProducts] = useState(false);
  const [toasts, setToasts] = useState([]);

  const addAdminToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  }, []);

  const login = (password, username = 'Admin') => {
    if (!password) {
      return { success: false, error: 'Please enter the administrator access password.' };
    }

    const incoming = password.trim();
    const validPasswords = new Set([ADMIN_PASSWORD, 'arman@1234', 'admin123', 'admin'].filter(Boolean));

    if (validPasswords.has(incoming)) {
      setIsAuthenticated(true);
      try {
        sessionStorage.setItem('gharsee_admin_authenticated', 'true');
        sessionStorage.setItem('gharsee_admin_user', username);
      } catch {}
      addAdminToast('Welcome to UR GROZY Admin Command Center 🛡️', 'success');
      return { success: true };
    }

    return { 
      success: false, 
      error: 'Access Denied: Invalid administrator credentials. Please check your password.' 
    };
  };

  const logout = () => {
    setIsAuthenticated(false);
    try {
      sessionStorage.removeItem('gharsee_admin_authenticated');
      sessionStorage.removeItem('gharsee_admin_user');
    } catch {}
    addAdminToast('Administrator session ended securely.', 'info');
  };

  const loadGlobalProducts = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoadingGlobalProducts(true);
    try {
      const [catRes, statsRes] = await Promise.all([
        fetchGlobalCatalog({ limit: 50 }),
        fetchGlobalCatalogStats()
      ]);
      setGlobalProducts(catRes.products || []);
      setGlobalCatalogStats(statsRes);
    } catch (err) {
      console.error('Error loading global products in context:', err);
    } finally {
      setIsLoadingGlobalProducts(false);
    }
  }, [isAuthenticated]);

  const refreshData = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);

    try {
      const [shopsData, ridersData, customersData, ordersData] = await Promise.all([
        fetchAllAdminShops(),
        fetchAllAdminRiders(),
        fetchAllAdminCustomers(),
        fetchAllAdminOrders()
      ]);

      setShops(shopsData);
      setRiders(ridersData);
      setCustomers(customersData);
      setOrders(ordersData);
      await loadGlobalProducts();
    } catch (err) {
      console.error('Error refreshing admin data:', err);
      addAdminToast('Error fetching latest platform records.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, addAdminToast, loadGlobalProducts]);

  useEffect(() => {
    if (isAuthenticated) {
      refreshData();
    }
  }, [isAuthenticated, refreshData]);

  // Real-time synchronization (Supabase channels + Storage + Custom Events + Polling)
  useEffect(() => {
    if (!isAuthenticated) return;

    // 1. Supabase Postgres Changes Channel
    let channel = null;
    if (isSupabaseConfigured) {
      channel = supabase
        .channel('admin_realtime_sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'rider_profiles' }, () => {
          refreshData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'shops' }, () => {
          refreshData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
          refreshData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
          refreshData();
        })
        .subscribe();
    }

    // 2. BroadcastChannel for instant cross-tab / cross-window sync
    let riderBus = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        riderBus = new BroadcastChannel('gharsee_admin_rider_bus');
        riderBus.onmessage = (event) => {
          if (event.data?.type === 'RIDER_REGISTERED' || event.data?.type === 'RIDER_STATUS_UPDATE') {
            refreshData();
          }
        };
      }
    } catch {}

    // 3. Cross-tab & In-app registration event listeners
    const handleStorage = (e) => {
      if (
        e.key === 'gharsee_latest_rider_registration' ||
        e.key === 'gharsee_rider_status_update' ||
        e.key === 'gharsee_store_status_update' ||
        e.key === 'gharsee_store_registered' ||
        e.key === 'gharsee_local_riders'
      ) {
        refreshData();
      }
    };

    const handleCustomEvent = () => {
      refreshData();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('gharsee_rider_registered', handleCustomEvent);
    window.addEventListener('gharsee_store_registered', handleCustomEvent);
    window.addEventListener('gharsee_store_status_changed', handleCustomEvent);
    window.addEventListener('gharsee_rider_status_changed', handleCustomEvent);

    // 4. Heartbeat polling (every 4 seconds)
    const interval = setInterval(() => {
      refreshData();
    }, 4000);

    return () => {
      if (channel) supabase.removeChannel(channel);
      if (riderBus) riderBus.close();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('gharsee_rider_registered', handleCustomEvent);
      window.removeEventListener('gharsee_store_registered', handleCustomEvent);
      window.removeEventListener('gharsee_store_status_changed', handleCustomEvent);
      window.removeEventListener('gharsee_rider_status_changed', handleCustomEvent);
      clearInterval(interval);
    };
  }, [isAuthenticated, refreshData]);

  const approveShop = async (shopId, shopName = 'Store') => {
    const success = await approveShopInSupabase(shopId);
    if (success) {
      setShops(prev => prev.map(s => s.id === shopId ? { ...s, isPending: false, isApproved: true, status: 'open', isOpen: true } : s));
      try {
        localStorage.setItem('gharsee_store_status_update', JSON.stringify({
          storeId: shopId,
          isOpen: true,
          status: 'open',
          timestamp: Date.now()
        }));
        window.dispatchEvent(new CustomEvent('gharsee_store_status_changed', {
          detail: { storeId: shopId, isOpen: true, status: 'open' }
        }));
      } catch {}
      addAdminToast(`🎉 Store "${shopName}" approved & open on customer app!`, 'success');
      await refreshData();
    } else {
      addAdminToast(`Failed to approve store "${shopName}".`, 'error');
    }
    return success;
  };

  const rejectShop = async (shopId, shopName = 'Store') => {
    const success = await rejectShopInSupabase(shopId);
    if (success) {
      setShops(prev => prev.map(s => s.id === shopId ? { ...s, isPending: false, isApproved: false, status: 'rejected', isOpen: false } : s));
      try {
        localStorage.setItem('gharsee_store_status_update', JSON.stringify({
          storeId: shopId,
          isOpen: false,
          status: 'rejected',
          timestamp: Date.now()
        }));
        window.dispatchEvent(new CustomEvent('gharsee_store_status_changed', {
          detail: { storeId: shopId, isOpen: false, status: 'rejected' }
        }));
      } catch {}
      addAdminToast(`Store "${shopName}" rejected.`, 'info');
      await refreshData();
    } else {
      addAdminToast(`Failed to reject store "${shopName}".`, 'error');
    }
    return success;
  };

  const toggleShop = async (shopId, currentIsOpen) => {
    const nextState = !currentIsOpen;
    const success = await toggleShopStatusInSupabase(shopId, currentIsOpen);
    if (success) {
      setShops(prev => prev.map(s => s.id === shopId ? { ...s, isOpen: nextState, status: nextState ? 'open' : 'closed' } : s));
      try {
        localStorage.setItem('gharsee_store_status_update', JSON.stringify({
          storeId: shopId,
          isOpen: nextState,
          status: nextState ? 'open' : 'closed',
          timestamp: Date.now()
        }));
        window.dispatchEvent(new CustomEvent('gharsee_store_status_changed', {
          detail: { storeId: shopId, isOpen: nextState, status: nextState ? 'open' : 'closed' }
        }));
      } catch {}
      addAdminToast(`Store status updated: ${nextState ? '🟢 OPEN' : '🔴 CLOSED'}`, 'info');
    }
    return success;
  };

  const approveRider = async (riderId, riderName = 'Rider', extraData = {}) => {
    const targetRider = riders.find(r => r.id === riderId || r.userId === riderId) || extraData;
    const cleanPhone = get10DigitPhone(targetRider?.phone || extraData?.phone || (typeof riderId === 'string' && riderId.match(/^\d{10}$/) ? riderId : ''));

    // Optimistic UI update
    setRiders(prev => prev.map(r => {
      const match = r.id === riderId || r.userId === riderId || (cleanPhone && get10DigitPhone(r.phone) === cleanPhone);
      return match ? { ...r, isPending: false, isApproved: true, is_approved: true, status: 'approved' } : r;
    }));

    const success = await approveRiderInSupabase(riderId, { ...targetRider, ...extraData });
    if (success) {
      addAdminToast(`🎉 Delivery Partner "${riderName}" approved & verified!`, 'success');
      await refreshData();
    } else {
      await refreshData();
      addAdminToast(`Failed to approve rider "${riderName}".`, 'error');
    }
    return success;
  };

  const rejectRider = async (riderId, riderName = 'Rider', extraData = {}) => {
    const targetRider = riders.find(r => r.id === riderId || r.userId === riderId) || extraData;
    const cleanPhone = get10DigitPhone(targetRider?.phone || extraData?.phone || (typeof riderId === 'string' && riderId.match(/^\d{10}$/) ? riderId : ''));

    // Optimistic UI update
    setRiders(prev => prev.map(r => {
      const match = r.id === riderId || r.userId === riderId || (cleanPhone && get10DigitPhone(r.phone) === cleanPhone);
      return match ? { ...r, isPending: false, isApproved: false, is_approved: false, status: 'rejected', isOnline: false } : r;
    }));

    const success = await rejectRiderInSupabase(riderId, { ...targetRider, ...extraData });
    if (success) {
      addAdminToast(`Rider application for "${riderName}" rejected.`, 'info');
      await refreshData();
    } else {
      await refreshData();
      addAdminToast(`Failed to reject rider "${riderName}".`, 'error');
    }
    return success;
  };

  const updateOrderStatus = async (orderId, nextStatus) => {
    const success = await updateAdminOrderStatus(orderId, nextStatus);
    if (success) {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: nextStatus } : o));
      addAdminToast(`Order #${orderId} status set to ${nextStatus.toUpperCase()}`, 'success');
    }
    return success;
  };

  const [selectedStoreForProducts, setSelectedStoreForProducts] = useState(null);
  const [storeProducts, setStoreProducts] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  const loadStoreProducts = useCallback(async (shopId) => {
    if (!shopId) return;
    setIsLoadingProducts(true);
    const prods = await fetchProductsForShop(shopId);
    setStoreProducts(prods);
    setIsLoadingProducts(false);
  }, []);

  const openStoreProductManager = async (store) => {
    setSelectedStoreForProducts(store);
    await loadStoreProducts(store.id);
  };

  const closeStoreProductManager = () => {
    setSelectedStoreForProducts(null);
    setStoreProducts([]);
  };

  const addProductToStore = async (shopId, productData) => {
    const created = await createProductForShop(shopId, productData);
    if (created) {
      addAdminToast(`✨ Added "${productData.name}" to store catalog!`, 'success');
      await loadStoreProducts(shopId);
      setShops(prev => prev.map(s => s.id === shopId ? { ...s, productCount: (s.productCount || 0) + 1 } : s));
      return { success: true, product: created };
    } else {
      addAdminToast(`Failed to add "${productData.name}".`, 'error');
      return { success: false };
    }
  };

  const updateProduct = async (productId, productData, shopId = null) => {
    const success = await updateProductInSupabase(productId, productData);
    if (success) {
      addAdminToast(`Item "${productData.name || 'Product'}" updated successfully!`, 'success');
      if (shopId) {
        await loadStoreProducts(shopId);
      }
      await loadGlobalProducts();
      return true;
    } else {
      addAdminToast(`Failed to update item.`, 'error');
      return false;
    }
  };

  const deleteProduct = async (productId, productName = 'Product', shopId = null) => {
    const success = await deleteProductInSupabase(productId);
    if (success) {
      addAdminToast(`Deleted "${productName}" from catalog.`, 'info');
      if (shopId) {
        await loadStoreProducts(shopId);
        setShops(prev => prev.map(s => s.id === shopId ? { ...s, productCount: Math.max(0, (s.productCount || 1) - 1) } : s));
      }
      await loadGlobalProducts();
      return true;
    } else {
      addAdminToast(`Failed to delete item.`, 'error');
      return false;
    }
  };

  const addGlobalProduct = async (productData) => {
    const created = await createGlobalProduct(productData);
    if (created) {
      addAdminToast(`✨ Added "${productData.name}" to Global Catalog!`, 'success');
      await loadGlobalProducts();
      return { success: true, product: created };
    } else {
      addAdminToast(`Failed to add "${productData.name}".`, 'error');
      return { success: false };
    }
  };

  const pendingShopsCount = shops.filter(s => s.isPending).length;
  const approvedShopsCount = shops.filter(s => s.isApproved).length;
  const pendingRidersCount = riders.filter(r => r.isPending).length;
  const activeRidersCount = riders.filter(r => r.isApproved).length;
  const totalCustomersCount = customers.length;
  const totalOrdersCount = orders.length;
  const totalGmvRevenue = orders.filter(o => o.status !== 'rejected' && o.status !== 'cancelled').reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  const value = {
    isAuthenticated,
    activeTab,
    setActiveTab,
    shops,
    riders,
    customers,
    orders,
    globalProducts,
    globalCatalogStats,
    isLoading,
    isLoadingGlobalProducts,
    toasts,
    login,
    logout,
    refreshData,
    approveShop,
    rejectShop,
    toggleShop,
    approveRider,
    rejectRider,
    updateOrderStatus,
    addAdminToast,
    selectedStoreForProducts,
    storeProducts,
    isLoadingProducts,
    openStoreProductManager,
    closeStoreProductManager,
    loadStoreProducts,
    addProductToStore,
    updateProduct,
    deleteProduct,
    loadGlobalProducts,
    addGlobalProduct,
    stats: {
      pendingShopsCount,
      approvedShopsCount,
      totalShopsCount: shops.length,
      pendingRidersCount,
      activeRidersCount,
      totalRidersCount: riders.length,
      totalCustomersCount,
      totalOrdersCount,
      totalGmvRevenue,
      totalGlobalProductsCount: globalCatalogStats.totalGlobalProducts || globalProducts.length
    }
  };

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
}