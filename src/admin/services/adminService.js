import { supabase, isSupabaseConfigured } from '../../lib/supabase.js';
import { isValidOrderStatus } from '../../utils/validators.js';
import { get10DigitPhone } from '../../services/authService.js';
import { 
  getPersistentRiderStatus, 
  setPersistentRiderStatus, 
  normalizeRiderProfile 
} from '../../services/riderService.js';
import { 
  fetchGlobalCatalog,
  fetchGlobalCatalogStats,
  checkDuplicateGlobalProduct,
  createGlobalProduct,
  updateGlobalProduct,
  deleteGlobalProduct,
  fetchStoreAssignmentsForProduct,
  assignProductToStore,
  updateStoreProductPricing,
  removeProductFromStore,
  fetchStoreInventory,
  GLOBAL_CATEGORIES
} from '../../services/globalCatalogService.js';

export {
  fetchGlobalCatalog,
  fetchGlobalCatalogStats,
  checkDuplicateGlobalProduct,
  createGlobalProduct,
  updateGlobalProduct,
  deleteGlobalProduct,
  fetchStoreAssignmentsForProduct,
  assignProductToStore,
  updateStoreProductPricing,
  removeProductFromStore,
  fetchStoreInventory,
  GLOBAL_CATEGORIES
};

// Fetch all stores with approval, operational status, and live product count
export async function fetchAllAdminShops() {
  if (!isSupabaseConfigured) return [];

  try {
    const [shopsRes, prodsRes, storeProdsRes] = await Promise.all([
      supabase.from('shops').select('*').order('created_at', { ascending: false }),
      supabase.from('products').select('id, shop_id'),
      supabase.from('store_products').select('id, store_id')
    ]);

    const { data, error } = shopsRes;
    const { data: allProducts } = prodsRes;
    const { data: allStoreProducts } = storeProdsRes;

    if (error || !data) {
      console.error('Error fetching admin shops:', error);
      return [];
    }

    const prodCountMap = new Map();
    (allProducts || []).forEach(p => {
      if (p.shop_id) {
        prodCountMap.set(p.shop_id, (prodCountMap.get(p.shop_id) || 0) + 1);
      }
    });

    (allStoreProducts || []).forEach(sp => {
      if (sp.store_id) {
        // If store_products is used, prefer store_products count
        prodCountMap.set(sp.store_id, (prodCountMap.get(sp.store_id) || 0) + 1);
      }
    });

    return data.map(s => {
      const statusLower = (s.status || '').toLowerCase();
      const isPending = statusLower === 'pending_approval' || statusLower === 'pending' || s.is_approved === false;
      const isApproved = !isPending && statusLower !== 'rejected';
      const isOpen = s.is_open ?? (statusLower === 'open' || statusLower === 'active');

      return {
        id: s.id,
        name: s.name,
        phone: s.phone,
        address: s.address,
        locality: s.locality || 'Local Area',
        city: s.city || 'Bengaluru',
        state: s.state || 'Karnataka',
        pincode: s.pincode || '',
        latitude: s.latitude,
        longitude: s.longitude,
        imageUrl: s.image_url || '/images/store_lakshmi.jpg',
        rating: s.rating || 5.0,
        status: s.status || (isPending ? 'pending_approval' : 'open'),
        isPending,
        isApproved,
        isOpen,
        categories: s.categories || ['Groceries', 'Dairy', 'Vegetables'],
        productCount: prodCountMap.get(s.id) || 0,
        createdAt: s.created_at || new Date().toISOString()
      };
    });
  } catch (err) {
    console.error('Exception in fetchAllAdminShops:', err);
    return [];
  }
}

// Approve / Accept a Shop Registration
export async function approveShopInSupabase(shopId) {
  if (!isSupabaseConfigured || !shopId) return false;

  try {
    const { error } = await supabase
      .from('shops')
      .update({
        status: 'open',
        is_open: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', shopId);

    if (error) {
      console.warn('First approveShop update failed, trying fallback without updated_at:', error.message);
      const { error: err2 } = await supabase
        .from('shops')
        .update({
          status: 'open',
          is_open: true
        })
        .eq('id', shopId);

      return !err2;
    }

    return true;
  } catch (err) {
    console.error('Exception in approveShopInSupabase:', err);
    return false;
  }
}

// Reject a Shop Registration
export async function rejectShopInSupabase(shopId) {
  if (!isSupabaseConfigured || !shopId) return false;

  try {
    const { error } = await supabase
      .from('shops')
      .update({
        status: 'rejected',
        is_open: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', shopId);

    if (error) {
      const { error: err2 } = await supabase
        .from('shops')
        .update({
          status: 'rejected',
          is_open: false
        })
        .eq('id', shopId);

      return !err2;
    }

    return true;
  } catch (err) {
    console.error('Exception in rejectShopInSupabase:', err);
    return false;
  }
}

// Toggle Shop Operational Status (Open / Close)
export async function toggleShopStatusInSupabase(shopId, currentIsOpen) {
  if (!isSupabaseConfigured) return false;

  const nextIsOpen = !currentIsOpen;
  const nextStatus = nextIsOpen ? 'open' : 'closed';

  try {
    const { error } = await supabase
      .from('shops')
      .update({
        is_open: nextIsOpen,
        status: nextStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', shopId);

    if (error) {
      const { error: err2 } = await supabase
        .from('shops')
        .update({
          is_open: nextIsOpen,
          status: nextStatus
        })
        .eq('id', shopId);

      return !err2;
    }

    return true;
  } catch (err) {
    console.error('Exception in toggleShopStatusInSupabase:', err);
    return false;
  }
}

// Fetch all delivery riders directly from Supabase with authoritative state mapping
export async function fetchAllAdminRiders() {
  if (!isSupabaseConfigured) return [];

  let riderRows = [];

  try {
    // 1. Fetch from rider_profiles table directly
    const { data: dbRiders, error: riderErr } = await supabase
      .from('rider_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (!riderErr && Array.isArray(dbRiders)) {
      riderRows = [...dbRiders];
    } else {
      console.warn('fetchAllAdminRiders direct query warning:', riderErr?.message);
    }

    // 2. Discover any registered riders in profiles where role = 'rider'
    const { data: profileRiders } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'rider');

    for (const pr of (profileRiders || [])) {
      const cleanPrPhone = get10DigitPhone(pr.phone);
      const exists = riderRows.some(r => 
        (r.user_id && r.user_id === pr.id) ||
        (cleanPrPhone && get10DigitPhone(r.phone) === cleanPrPhone)
      );

      if (!exists) {
        const numTail = (cleanPrPhone || '2024').slice(-4);
        const autoRecord = {
          id: pr.id,
          user_id: pr.id,
          phone: pr.phone || (cleanPrPhone ? `+91${cleanPrPhone}` : ''),
          full_name: pr.full_name || 'Delivery Partner',
          vehicle_type: 'scooter',
          vehicle_number: `KA-14-EA-${numTail}`,
          driving_license: `KA14202400${(cleanPrPhone || '98765').slice(-5)}`,
          delivery_city: 'Chikkamagaluru, Karnataka',
          approval_status: 'pending',
          is_active: false,
          is_online: false,
          rejection_reason: null,
          created_at: pr.created_at || new Date().toISOString()
        };
        riderRows.push(autoRecord);

        // Lazily ensure row exists in database
        supabase
          .from('rider_profiles')
          .insert([{
            user_id: pr.id,
            phone: autoRecord.phone,
            full_name: autoRecord.full_name,
            vehicle_type: autoRecord.vehicle_type,
            vehicle_number: autoRecord.vehicle_number,
            driving_license: autoRecord.driving_license,
            delivery_city: autoRecord.delivery_city,
            is_online: false
          }])
          .catch?.(() => {});
      }
    }
  } catch (err) {
    console.error('Exception in fetchAllAdminRiders:', err);
  }

  // 3. Deduplicate strictly by 10-digit phone
  const seenPhones = new Set();
  const deduped = [];
  for (const r of riderRows) {
    const cleanPhone = get10DigitPhone(r.phone);
    if (cleanPhone) {
      if (seenPhones.has(cleanPhone)) continue;
      seenPhones.add(cleanPhone);
    }
    deduped.push(r);
  }

  // 4. Map to normalized Rider Application object
  return deduped.map(r => {
    return normalizeRiderProfile(r, r.user_id || r.userId || r.id, r.phone);
  });
}

/**
 * Approve & Activate a Rider:
 * 1. Identifies the exact rider record by UUID or phone.
 * 2. Writes persistent status immediately to registry & dispatches events.
 * 3. Updates Supabase database record:
 *    approval_status = 'approved', is_active = true, is_online = false, rejection_reason = null.
 */
export async function approveRiderInSupabase(riderId, extraData = {}) {
  if (!riderId) return false;

  const nowIso = new Date().toISOString();
  const cleanPhone = get10DigitPhone(extraData?.phone || (typeof riderId === 'string' && riderId.match(/^\d{10}$/) ? riderId : ''));
  let targetUserId = extraData?.userId || extraData?.user_id || null;

  // 1. Immediately persist approval in local registry
  setPersistentRiderStatus(cleanPhone || extraData?.phone, riderId, {
    approvalStatus: 'approved',
    status: 'approved',
    isApproved: true,
    isActive: true,
    userId: targetUserId,
    rejectionReason: null
  });

  // 2. Broadcast across channels so Rider portal & other tabs unlock instantly
  const updateEvent = {
    type: 'RIDER_STATUS_UPDATE',
    riderId,
    userId: targetUserId,
    phone: cleanPhone,
    approvalStatus: 'approved',
    approval_status: 'approved',
    isActive: true,
    is_active: true,
    isApproved: true,
    status: 'approved',
    rejectionReason: null,
    timestamp: Date.now()
  };

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('gharsee_admin_rider_bus');
      bc.postMessage(updateEvent);
      bc.close();
    }
    window.dispatchEvent(new CustomEvent('gharsee_rider_status_changed', { detail: updateEvent }));
  } catch {}

  // 3. Update in Supabase
  if (isSupabaseConfigured) {
    try {
      const { data: allRiders } = await supabase.from('rider_profiles').select('*');
      const matched = (allRiders || []).find(r => 
        (riderId && (r.id === riderId || r.user_id === riderId)) ||
        (targetUserId && r.user_id === targetUserId) ||
        (cleanPhone && get10DigitPhone(r.phone) === cleanPhone)
      );

      const approvePayload = {
        approval_status: 'approved',
        is_active: true,
        is_online: false,
        is_approved: true,
        status: 'approved',
        rejection_reason: null,
        updated_at: nowIso
      };

      if (matched?.id) {
        targetUserId = matched.user_id || targetUserId;
        const { error: err } = await supabase
          .from('rider_profiles')
          .update(approvePayload)
          .eq('id', matched.id);

        if (err) {
          await supabase
            .from('rider_profiles')
            .update({
              is_online: false,
              updated_at: nowIso
            })
            .eq('id', matched.id)
            .catch?.(() => {});
        }
      } else if (cleanPhone) {
        await supabase
          .from('rider_profiles')
          .update(approvePayload)
          .eq('phone', extraData?.phone || `+91${cleanPhone}`)
          .catch?.(() => {});
      }

      // Also guarantee profiles.role = 'rider'
      if (targetUserId) {
        await supabase.from('profiles').update({ role: 'rider', updated_at: nowIso }).eq('id', targetUserId).catch?.(() => {});
      }
    } catch (err) {
      console.warn('approveRiderInSupabase DB update warning:', err);
    }
  }

  return true;
}

/**
 * Reject a Rider Application with an optional rejection reason.
 */
export async function rejectRiderInSupabase(riderId, rejectionReason = 'Application did not meet operational criteria', extraData = {}) {
  if (!riderId) return false;

  const nowIso = new Date().toISOString();
  const safeReason = (typeof rejectionReason === 'string' && rejectionReason.trim()) ? rejectionReason.trim() : 'Application did not meet operational criteria';
  const cleanPhone = get10DigitPhone(extraData?.phone || (typeof riderId === 'string' && riderId.match(/^\d{10}$/) ? riderId : ''));
  let targetUserId = extraData?.userId || extraData?.user_id || null;

  // 1. Immediately persist rejection in local registry
  setPersistentRiderStatus(cleanPhone || extraData?.phone, riderId, {
    approvalStatus: 'rejected',
    status: 'rejected',
    isApproved: false,
    isActive: false,
    userId: targetUserId,
    rejectionReason: safeReason
  });

  // 2. Broadcast event
  const updateEvent = {
    type: 'RIDER_STATUS_UPDATE',
    riderId,
    userId: targetUserId,
    phone: cleanPhone,
    approvalStatus: 'rejected',
    approval_status: 'rejected',
    isActive: false,
    is_active: false,
    isApproved: false,
    status: 'rejected',
    rejectionReason: safeReason,
    timestamp: Date.now()
  };

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('gharsee_admin_rider_bus');
      bc.postMessage(updateEvent);
      bc.close();
    }
    window.dispatchEvent(new CustomEvent('gharsee_rider_status_changed', { detail: updateEvent }));
  } catch {}

  // 3. Update Supabase
  if (isSupabaseConfigured) {
    try {
      const { data: allRiders } = await supabase.from('rider_profiles').select('*');
      const matched = (allRiders || []).find(r => 
        (riderId && (r.id === riderId || r.user_id === riderId)) ||
        (targetUserId && r.user_id === targetUserId) ||
        (cleanPhone && get10DigitPhone(r.phone) === cleanPhone)
      );

      const rejectPayload = {
        approval_status: 'rejected',
        is_active: false,
        is_online: false,
        is_approved: false,
        status: 'rejected',
        rejection_reason: safeReason,
        updated_at: nowIso
      };

      if (matched?.id) {
        targetUserId = matched.user_id || targetUserId;
        const { error } = await supabase
          .from('rider_profiles')
          .update(rejectPayload)
          .eq('id', matched.id);

        if (error) {
          await supabase
            .from('rider_profiles')
            .update({
              is_online: false,
              updated_at: nowIso
            })
            .eq('id', matched.id)
            .catch?.(() => {});
        }
      } else if (cleanPhone) {
        await supabase
          .from('rider_profiles')
          .update(rejectPayload)
          .eq('phone', extraData?.phone || `+91${cleanPhone}`)
          .catch?.(() => {});
      }
    } catch (err) {
      console.warn('rejectRiderInSupabase DB update warning:', err);
    }
  }

  return true;
}

/**
 * Suspend a Rider account temporarily.
 */
export async function suspendRiderInSupabase(riderId, suspensionReason = 'Account temporarily suspended by Admin', extraData = {}) {
  if (!riderId) return false;

  const nowIso = new Date().toISOString();
  const safeReason = (typeof suspensionReason === 'string' && suspensionReason.trim()) ? suspensionReason.trim() : 'Account temporarily suspended by Admin';
  const cleanPhone = get10DigitPhone(extraData?.phone || (typeof riderId === 'string' && riderId.match(/^\d{10}$/) ? riderId : ''));
  let targetUserId = extraData?.userId || extraData?.user_id || null;

  // 1. Immediately persist suspension in local registry
  setPersistentRiderStatus(cleanPhone || extraData?.phone, riderId, {
    approvalStatus: 'suspended',
    status: 'suspended',
    isApproved: false,
    isActive: false,
    userId: targetUserId,
    rejectionReason: safeReason
  });

  // 2. Broadcast event
  const updateEvent = {
    type: 'RIDER_STATUS_UPDATE',
    riderId,
    userId: targetUserId,
    phone: cleanPhone,
    approvalStatus: 'suspended',
    approval_status: 'suspended',
    isActive: false,
    is_active: false,
    isApproved: false,
    status: 'suspended',
    rejectionReason: safeReason,
    timestamp: Date.now()
  };

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('gharsee_admin_rider_bus');
      bc.postMessage(updateEvent);
      bc.close();
    }
    window.dispatchEvent(new CustomEvent('gharsee_rider_status_changed', { detail: updateEvent }));
  } catch {}

  // 3. Update Supabase
  if (isSupabaseConfigured) {
    try {
      const { data: allRiders } = await supabase.from('rider_profiles').select('*');
      const matched = (allRiders || []).find(r => 
        (riderId && (r.id === riderId || r.user_id === riderId)) ||
        (targetUserId && r.user_id === targetUserId) ||
        (cleanPhone && get10DigitPhone(r.phone) === cleanPhone)
      );

      const suspendPayload = {
        approval_status: 'suspended',
        is_active: false,
        is_online: false,
        is_approved: false,
        status: 'suspended',
        rejection_reason: safeReason,
        updated_at: nowIso
      };

      if (matched?.id) {
        targetUserId = matched.user_id || targetUserId;
        await supabase
          .from('rider_profiles')
          .update(suspendPayload)
          .eq('id', matched.id)
          .catch?.(() => {});
      } else if (cleanPhone) {
        await supabase
          .from('rider_profiles')
          .update(suspendPayload)
          .eq('phone', extraData?.phone || `+91${cleanPhone}`)
          .catch?.(() => {});
      }
    } catch (err) {
      console.warn('suspendRiderInSupabase DB update warning:', err);
    }
  }

  return true;
}

/**
 * Reactivate a suspended or rejected Rider.
 */
export async function reactivateRiderInSupabase(riderId, extraData = {}) {
  return approveRiderInSupabase(riderId, extraData);
}

// Fetch all registered customer profiles & geolocations
export async function fetchAllAdminCustomers() {
  if (!isSupabaseConfigured) return [];

  try {
    const { data, error } = await supabase
      .from('customer_addresses')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) {
      console.error('Error fetching admin customers:', error);
      return [];
    }

    return data.map(c => ({
      id: c.id,
      phone: c.phone,
      fullName: c.full_name || 'Customer',
      flat: c.flat || '',
      street: c.street || '',
      city: c.city || 'Bengaluru',
      pincode: c.pincode || '',
      addressText: c.address_text || '',
      latitude: c.latitude,
      longitude: c.longitude,
      createdAt: c.created_at || new Date().toISOString()
    }));
  } catch (err) {
    console.error('Exception in fetchAllAdminCustomers:', err);
    return [];
  }
}

// Fetch all customer orders across all stores
export async function fetchAllAdminOrders() {
  if (!isSupabaseConfigured) return [];

  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) {
      console.error('Error fetching admin orders:', error);
      return [];
    }

    return data.map(o => ({
      id: o.id,
      storeId: o.store_id,
      storeName: o.store_name || 'Local Grocery Store',
      customerName: o.customer_name || 'Customer',
      customerPhone: o.customer_phone || '',
      deliveryAddress: o.delivery_address || '',
      status: o.status || 'pending',
      totalAmount: o.total_amount || 0,
      subtotal: o.subtotal || 0,
      deliveryFee: o.delivery_fee || 0,
      paymentMethod: o.payment_method || 'Cash on Delivery',
      items: o.items || [],
      createdAt: o.created_at || new Date().toISOString()
    }));
  } catch (err) {
    console.error('Exception in fetchAllAdminOrders:', err);
    return [];
  }
}

// Update Order Status from Admin Portal
export async function updateAdminOrderStatus(orderId, nextStatus) {
  if (!isSupabaseConfigured) return false;

  if (!isValidOrderStatus(nextStatus)) {
    console.warn('updateAdminOrderStatus: invalid status', nextStatus);
    return false;
  }

  try {
    const { error } = await supabase
      .from('orders')
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    return !error;
  } catch (err) {
    console.error('Exception in updateAdminOrderStatus:', err);
    return false;
  }
}

// -------------------------------------------------------------
// STORE INVENTORY & PRODUCT MANAGEMENT (ADMIN & STORE-SPECIFIC)
// -------------------------------------------------------------

// Fetch all products belonging to a specific store
export async function fetchProductsForShop(shopId) {
  if (!isSupabaseConfigured || !shopId) return [];

  try {
    const inventory = await fetchStoreInventory(shopId);
    if (inventory && inventory.length > 0) {
      return inventory;
    }

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map(p => ({
      id: p.id,
      storeProductId: p.id,
      globalProductId: p.id,
      shopId: p.shop_id,
      storeId: p.shop_id,
      name: p.name,
      brand: p.brand || 'Store Fresh',
      category: p.category || 'Groceries',
      price: parseFloat(p.price || 0),
      mrp: parseFloat(p.mrp || p.price || 0),
      unit: p.unit || '1 kg',
      stock: p.stock != null ? parseInt(p.stock, 10) : 50,
      minThreshold: p.min_threshold != null ? parseInt(p.min_threshold, 10) : 5,
      imageUrl: p.image_url || '/images/cat_veg_fruits.jpg',
      image_url: p.image_url || '/images/cat_veg_fruits.jpg',
      description: p.description || '',
      isAvailable: p.is_available !== false,
      is_available: p.is_available !== false,
      createdAt: p.created_at || new Date().toISOString()
    }));
  } catch (err) {
    console.error('Exception in fetchProductsForShop:', err);
    return [];
  }
}

// Add a new product to a specific store in Supabase
export async function createProductForShop(shopId, productData) {
  if (!isSupabaseConfigured || !shopId) return null;

  try {
    let globalId = productData.globalProductId;

    // If no existing global product selected, create one in global catalog
    if (!globalId) {
      const createdGlobal = await createGlobalProduct({
        name: productData.name,
        brand: productData.brand || 'Standard',
        category: productData.category || 'General Groceries',
        unit: productData.unit || '1 kg',
        quantity: productData.quantity || 1,
        imageUrl: productData.imageUrl || productData.image_url,
        description: productData.description || '',
        barcode: productData.barcode || null,
        searchKeywords: productData.searchKeywords || null
      });

      if (createdGlobal) {
        globalId = createdGlobal.id;
      }
    }

    if (globalId) {
      const assigned = await assignProductToStore({
        storeId: shopId,
        globalProductId: globalId,
        price: productData.price,
        mrp: productData.mrp,
        stock: productData.stock,
        minThreshold: productData.minThreshold,
        isAvailable: productData.isAvailable !== false,
        storeSku: productData.storeSku || ''
      });

      if (assigned) return assigned;
    }

    // Fallback insertion into legacy products table
    const payload = {
      shop_id: shopId,
      name: (productData.name || '').trim(),
      category: productData.category || 'Groceries',
      price: parseFloat(productData.price || 0),
      mrp: parseFloat(productData.mrp || productData.price || 0),
      unit: productData.unit || '1 kg',
      stock: parseInt(productData.stock || 50, 10),
      min_threshold: parseInt(productData.minThreshold || 5, 10),
      image_url: productData.imageUrl || productData.image_url || '/images/cat_veg_fruits.jpg',
      description: productData.description || '',
      is_available: productData.isAvailable !== false
    };

    const { data: legacyData, error: legacyErr } = await supabase
      .from('products')
      .insert([payload])
      .select()
      .maybeSingle();

    if (legacyErr) {
      console.error('Legacy fallback insert error:', legacyErr);
      return null;
    }

    return legacyData;
  } catch (err) {
    console.error('Exception in createProductForShop:', err);
    return null;
  }
}

// Update existing product in Supabase (updates store_products or products)
export async function updateProductInSupabase(productId, productData) {
  if (!isSupabaseConfigured || !productId) return false;

  try {
    // 1. Attempt updating in store_products
    const spSuccess = await updateStoreProductPricing({
      storeProductId: productId,
      price: productData.price,
      mrp: productData.mrp,
      stock: productData.stock,
      minThreshold: productData.minThreshold,
      isAvailable: productData.isAvailable,
      storeSku: productData.storeSku
    });

    if (spSuccess) {
      // If global metadata was also edited, update global_products
      if (productData.globalProductId && productData.name) {
        await updateGlobalProduct(productData.globalProductId, productData);
      }
      return true;
    }

    // 2. Fallback: update in legacy products table
    const updatePayload = {
      name: (productData.name || '').trim(),
      category: productData.category,
      price: parseFloat(productData.price || 0),
      mrp: parseFloat(productData.mrp || productData.price || 0),
      unit: productData.unit || '1 kg',
      stock: parseInt(productData.stock || 0, 10),
      image_url: productData.imageUrl || productData.image_url,
      description: productData.description || '',
      is_available: productData.isAvailable !== false,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('products')
      .update(updatePayload)
      .eq('id', productId);

    return !error;
  } catch (err) {
    console.error('Exception in updateProductInSupabase:', err);
    return false;
  }
}

// Delete product from Supabase (store_products or products)
export async function deleteProductInSupabase(productId) {
  if (!isSupabaseConfigured || !productId) return false;

  try {
    // Try removing from store_products first
    const spRemoved = await removeProductFromStore(productId);
    if (spRemoved) return true;

    // Fallback: delete from legacy products
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId);

    return !error;
  } catch (err) {
    console.error('Exception in deleteProductInSupabase:', err);
    return false;
  }
}

// -------------------------------------------------------------
// IMAGE UPLOAD & PROCESSING UTILITY
// -------------------------------------------------------------

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export async function uploadImageFile(file) {
  if (!file) return null;

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error('Unsupported image type. Please upload a JPEG, PNG, WEBP, or GIF file.');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('Image is too large. Maximum allowed size is 5 MB.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const maxDim = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          resolve(dataUrl);
        } catch {
          resolve(e.target.result);
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}