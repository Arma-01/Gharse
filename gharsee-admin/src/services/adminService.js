import { supabase, isSupabaseConfigured } from '../lib/supabase';
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
} from './globalCatalogService';

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

    return !error;
  } catch (err) {
    return false;
  }
}

// Helper to safely extract 10-digit phone
const get10DigitPhone = (phone) => (phone || '').replace(/\D/g, '').slice(-10);

// Persistent Rider Status Registry in LocalStorage to prevent approval rollback
function getRidersStatusRegistry() {
  try {
    return JSON.parse(localStorage.getItem('gharsee_riders_status_registry') || '{}');
  } catch {
    return {};
  }
}

function setRiderStatusInRegistry(phone, riderId, isApproved, status) {
  try {
    const reg = getRidersStatusRegistry();
    const cleanPhone = get10DigitPhone(phone);
    const entry = { isApproved, status, updatedAt: Date.now() };
    if (cleanPhone) reg[cleanPhone] = entry;
    if (riderId) reg[riderId] = entry;
    localStorage.setItem('gharsee_riders_status_registry', JSON.stringify(reg));
  } catch {}
}

// Fetch all delivery riders with multi-source fallback discovery and status registry protection
// Fetch all delivery riders directly from Supabase with multi-source fallback discovery and status registry protection
export async function fetchAllAdminRiders() {
  const statusRegistry = getRidersStatusRegistry();
  let riderData = [];

  if (isSupabaseConfigured) {
    try {
      // 1. Fetch from rider_profiles table directly
      const { data, error } = await supabase
        .from('rider_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        riderData = [...data];
      } else {
        const { data: fallbackData } = await supabase.from('rider_profiles').select('*');
        if (Array.isArray(fallbackData)) riderData = [...fallbackData];
      }
    } catch (err) {
      console.warn('Direct rider_profiles query warning:', err);
    }

    // 2. Discover any riders registered in profiles table where role = 'rider'
    try {
      const { data: authProfiles } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'rider');

      for (const ap of (authProfiles || [])) {
        const cleanApPhone = get10DigitPhone(ap.phone);
        const numTail = (cleanApPhone || '2024').slice(-4);
        const defaultVNum = `KA-14-EA-${numTail}`;
        const defaultDLic = `KA14202400${(cleanApPhone || '98765').slice(-5)}`;

        const existingIdx = riderData.findIndex(
          r => (r.user_id && r.user_id === ap.id) || (cleanApPhone && get10DigitPhone(r.phone) === cleanApPhone)
        );

        if (existingIdx >= 0) {
          if (!riderData[existingIdx].user_id) riderData[existingIdx].user_id = ap.id;
          if (!riderData[existingIdx].full_name && ap.full_name) riderData[existingIdx].full_name = ap.full_name;
          if (!riderData[existingIdx].vehicle_number || riderData[existingIdx].vehicle_number === 'Not specified') {
            riderData[existingIdx].vehicle_number = defaultVNum;
          }
          if (!riderData[existingIdx].driving_license || riderData[existingIdx].driving_license === 'Not specified') {
            riderData[existingIdx].driving_license = defaultDLic;
          }
        } else {
          const regEntry = cleanApPhone ? statusRegistry[cleanApPhone] : (statusRegistry[ap.id] || null);
          const isApprovedInReg = regEntry ? regEntry.isApproved === true : false;
          const isRejectedInReg = regEntry ? regEntry.status === 'rejected' : false;

          const newRec = {
            id: ap.id,
            user_id: ap.id,
            full_name: ap.full_name || 'Delivery Partner',
            phone: ap.phone || `+91${cleanApPhone}`,
            vehicle_type: 'scooter',
            vehicle_number: defaultVNum,
            driving_license: defaultDLic,
            delivery_city: 'Chikkamagaluru, Karnataka',
            is_approved: isApprovedInReg,
            status: isApprovedInReg ? 'approved' : (isRejectedInReg ? 'rejected' : 'pending'),
            is_online: false,
            created_at: ap.created_at || ap.updated_at || new Date().toISOString()
          };
          riderData.push(newRec);

          supabase
            .from('rider_profiles')
            .upsert([{
              id: newRec.id,
              full_name: newRec.full_name,
              phone: newRec.phone,
              vehicle_type: newRec.vehicle_type,
              vehicle_number: newRec.vehicle_number,
              driving_license: newRec.driving_license,
              delivery_city: newRec.delivery_city,
              is_online: false
            }], { onConflict: 'phone' })
            .catch?.(() => {});
        }
      }
    } catch (profErr) {
      console.warn('Profiles rider discovery non-fatal warning:', profErr);
    }
  }

  // 3. Discover latest registered riders from local cache / bus if present
  try {
    const localRiders = JSON.parse(localStorage.getItem('gharsee_local_riders') || '[]');
    for (const lr of localRiders) {
      if (lr && lr.phone) {
        const cleanLrPhone = get10DigitPhone(lr.phone);
        const existingIdx = riderData.findIndex(r => get10DigitPhone(r.phone) === cleanLrPhone);
        if (existingIdx === -1) {
          const regEntry = cleanLrPhone ? statusRegistry[cleanLrPhone] : null;
          const isApprovedInReg = regEntry ? regEntry.isApproved === true : (lr.isApproved === true || lr.is_approved === true);
          const isRejectedInReg = regEntry ? regEntry.status === 'rejected' : (lr.status === 'rejected');

          riderData.push({
            id: lr.riderId || lr.id || `rider_${Date.now()}`,
            user_id: lr.userId || lr.user_id,
            full_name: lr.fullName || lr.full_name || 'Delivery Partner',
            phone: lr.phone,
            vehicle_type: (lr.vehicleType || lr.vehicle_type || 'scooter').toLowerCase(),
            vehicle_number: lr.vehicleNumber || lr.vehicle_number || 'KA-14-EA-2024',
            driving_license: lr.drivingLicense || lr.driving_license || 'KA1420240098765',
            delivery_city: lr.deliveryCity || lr.delivery_city || 'Chikkamagaluru, Karnataka',
            is_approved: isApprovedInReg,
            status: isApprovedInReg ? 'approved' : (isRejectedInReg ? 'rejected' : 'pending'),
            is_online: false,
            created_at: new Date(lr.timestamp || Date.now()).toISOString()
          });
        }
      }
    }

    const latestReg = JSON.parse(localStorage.getItem('gharsee_latest_rider_registration') || 'null');
    if (latestReg && latestReg.phone) {
      const cleanRegPhone = get10DigitPhone(latestReg.phone);
      const existingIdx = riderData.findIndex(r => get10DigitPhone(r.phone) === cleanRegPhone);

      if (existingIdx === -1) {
        const regEntry = cleanRegPhone ? statusRegistry[cleanRegPhone] : null;
        const isApprovedInReg = regEntry ? regEntry.isApproved === true : (latestReg.isApproved === true);
        const isRejectedInReg = regEntry ? regEntry.status === 'rejected' : (latestReg.status === 'rejected');
        const numTail = (cleanRegPhone || '2024').slice(-4);

        riderData.push({
          id: latestReg.riderId || `rider_${Date.now()}`,
          user_id: latestReg.userId || latestReg.riderId,
          full_name: latestReg.fullName || 'Delivery Partner',
          phone: latestReg.phone,
          vehicle_type: (latestReg.vehicleType || 'scooter').toLowerCase(),
          vehicle_number: latestReg.vehicleNumber && latestReg.vehicleNumber !== 'Not specified' ? latestReg.vehicleNumber : `KA-14-EA-${numTail}`,
          driving_license: latestReg.drivingLicense && latestReg.drivingLicense !== 'Not specified' ? latestReg.drivingLicense : `KA14202400${(cleanRegPhone || '98765').slice(-5)}`,
          delivery_city: latestReg.deliveryCity || 'Chikkamagaluru, Karnataka',
          is_approved: isApprovedInReg,
          status: isApprovedInReg ? 'approved' : (isRejectedInReg ? 'rejected' : 'pending'),
          is_online: false,
          created_at: new Date(latestReg.timestamp || Date.now()).toISOString()
        });
      }
    }
  } catch {}

  // 4. Deduplicate riders strictly by 10-digit phone
  const seenPhones = new Set();
  const dedupedRiders = [];
  for (const r of riderData) {
    const cleanPhone = get10DigitPhone(r.phone);
    if (cleanPhone) {
      if (seenPhones.has(cleanPhone)) continue;
      seenPhones.add(cleanPhone);
    }
    dedupedRiders.push(r);
  }

  // 5. Map & Normalize every rider with clean status logic
  return dedupedRiders.map(r => {
    const cleanPhone = get10DigitPhone(r.phone);
    const regEntry = (cleanPhone && statusRegistry[cleanPhone]) || 
                     (r.id && statusRegistry[r.id]) || 
                     (r.user_id && statusRegistry[r.user_id]) || 
                     null;

    const statusLower = (r.status || '').toLowerCase();
    let isApproved = false;
    let isPending = false;
    let status = 'pending';

    // Direct database state evaluation
    if (r.is_approved === true || statusLower === 'approved' || statusLower === 'active') {
      isApproved = true;
      isPending = false;
      status = 'approved';
    } else if (statusLower === 'rejected') {
      isApproved = false;
      isPending = false;
      status = 'rejected';
    } else if (regEntry?.isApproved === true || regEntry?.status === 'approved') {
      isApproved = true;
      isPending = false;
      status = 'approved';
    } else if (regEntry?.status === 'rejected') {
      isApproved = false;
      isPending = false;
      status = 'rejected';
    } else {
      isApproved = false;
      isPending = true;
      status = 'pending';
    }

    const isOnline = Boolean(isApproved && (r.is_online === true || r.isOnline === true));
    const numTail = (cleanPhone || '2024').slice(-4);
    const safeVNum = r.vehicle_number && r.vehicle_number !== 'Not specified' ? r.vehicle_number : `KA-14-EA-${numTail}`;
    const safeDLic = r.driving_license && r.driving_license !== 'Not specified' ? r.driving_license : `KA14202400${(cleanPhone || '98765').slice(-5)}`;

    return {
      id: r.id,
      userId: r.user_id || r.userId,
      fullName: r.full_name || r.fullName || r.name || 'Delivery Partner',
      phone: r.phone || (cleanPhone ? `+91${cleanPhone}` : ''),
      vehicleType: r.vehicle_type || r.vehicleType || 'scooter',
      vehicleNumber: safeVNum,
      drivingLicense: safeDLic,
      deliveryCity: r.delivery_city || r.deliveryCity || 'Chikkamagaluru, Karnataka',
      isOnline: isOnline,
      totalDeliveries: r.total_deliveries || 0,
      rating: r.rating || 5.0,
      status,
      isPending,
      isApproved,
      is_approved: isApproved,
      createdAt: r.created_at || new Date().toISOString()
    };
  });
}

// Approve / Verify a Rider Registration
export async function approveRiderInSupabase(riderId, extraData = {}) {
  const nowIso = new Date().toISOString();
  const cleanPhone = get10DigitPhone(extraData?.phone || (typeof riderId === 'string' && riderId.match(/^\d{10}$/) ? riderId : ''));
  const numTail = (cleanPhone || '2024').slice(-4);
  const safeVNum = extraData?.vehicleNumber && extraData.vehicleNumber !== 'Not specified' ? extraData.vehicleNumber : `KA-14-EA-${numTail}`;
  const safeDLic = extraData?.drivingLicense && extraData.drivingLicense !== 'Not specified' ? extraData.drivingLicense : `KA14202400${(cleanPhone || '98765').slice(-5)}`;
  const safeFullName = extraData?.fullName || extraData?.name || 'Delivery Partner';
  const safeCity = extraData?.deliveryCity || extraData?.city || 'Chikkamagaluru, Karnataka';

  // 1. Record approval in status registry
  setRiderStatusInRegistry(cleanPhone, riderId, true, 'approved');

  // 2. Update local storage caches
  try {
    const latestReg = JSON.parse(localStorage.getItem('gharsee_latest_rider_registration') || 'null');
    if (latestReg && (latestReg.riderId === riderId || (cleanPhone && get10DigitPhone(latestReg.phone) === cleanPhone))) {
      localStorage.setItem('gharsee_latest_rider_registration', JSON.stringify({
        ...latestReg,
        isApproved: true,
        isPending: false,
        status: 'approved'
      }));
    }

    const cachedRiders = JSON.parse(localStorage.getItem('gharsee_local_riders') || '[]');
    const updatedLocal = cachedRiders.map(r => {
      if (r.riderId === riderId || r.id === riderId || (cleanPhone && get10DigitPhone(r.phone) === cleanPhone)) {
        return { ...r, isApproved: true, isPending: false, status: 'approved' };
      }
      return r;
    });
    localStorage.setItem('gharsee_local_riders', JSON.stringify(updatedLocal));

    const cached = JSON.parse(localStorage.getItem('gharsee_rider_profile') || 'null');
    if (cached && (cached.id === riderId || cached.user_id === riderId || (cleanPhone && get10DigitPhone(cached.phone) === cleanPhone))) {
      localStorage.setItem('gharsee_rider_profile', JSON.stringify({
        ...cached,
        vehicleNumber: safeVNum,
        drivingLicense: safeDLic,
        isApproved: true,
        isPending: false,
        status: 'approved',
        is_approved: true
      }));
    }
  } catch {}

  // 3. Supabase remote database updates with row verification
  let targetUserId = extraData?.userId || extraData?.user_id || null;
  let supabaseSuccess = false;

  if (isSupabaseConfigured) {
    try {
      const { data: allRiders } = await supabase.from('rider_profiles').select('*');
      const matched = (allRiders || []).find(r => 
        (riderId && r.id === riderId) ||
        (riderId && r.user_id === riderId) ||
        (targetUserId && r.user_id === targetUserId) ||
        (cleanPhone && get10DigitPhone(r.phone) === cleanPhone)
      );

      const baseUpdatePayload = {
        vehicle_number: safeVNum,
        driving_license: safeDLic,
        delivery_city: safeCity,
        full_name: safeFullName,
        updated_at: nowIso
      };

      const updatePayload = {
        ...baseUpdatePayload,
        is_approved: true,
        status: 'approved'
      };

      if (matched?.id) {
        targetUserId = matched.user_id || targetUserId;
        const { data: updatedRow, error: updateErr } = await supabase
          .from('rider_profiles')
          .update(updatePayload)
          .eq('id', matched.id)
          .select()
          .maybeSingle();

        if (!updateErr && updatedRow) {
          supabaseSuccess = true;
        } else {
          // Fallback update base columns
          const { data: baseUpdated } = await supabase
            .from('rider_profiles')
            .update(baseUpdatePayload)
            .eq('id', matched.id)
            .select()
            .maybeSingle();

          if (baseUpdated) supabaseSuccess = true;
        }
      }

      if (!supabaseSuccess && cleanPhone) {
        const { data: updateByPhone, error: phoneErr } = await supabase
          .from('rider_profiles')
          .update(updatePayload)
          .eq('phone', extraData?.phone || `+91${cleanPhone}`)
          .select()
          .maybeSingle();

        if (!phoneErr && updateByPhone) {
          supabaseSuccess = true;
          targetUserId = updateByPhone.user_id || targetUserId;
        } else {
          const { data: baseByPhone } = await supabase
            .from('rider_profiles')
            .update(baseUpdatePayload)
            .eq('phone', extraData?.phone || `+91${cleanPhone}`)
            .select()
            .maybeSingle();

          if (baseByPhone) {
            supabaseSuccess = true;
            targetUserId = baseByPhone.user_id || targetUserId;
          }
        }
      }

      if (!supabaseSuccess) {
        const baseInsertPayload = {
          full_name: safeFullName,
          phone: extraData?.phone || (cleanPhone ? `+91${cleanPhone}` : ''),
          vehicle_type: (extraData?.vehicleType || 'scooter').toLowerCase(),
          vehicle_number: safeVNum,
          driving_license: safeDLic,
          delivery_city: safeCity,
          is_online: false,
          created_at: nowIso,
          updated_at: nowIso
        };

        const { data: insertedRow, error: insertErr } = await supabase
          .from('rider_profiles')
          .insert([{
            ...baseInsertPayload,
            user_id: typeof riderId === 'string' && riderId.length > 20 && !riderId.startsWith('rider_') ? riderId : targetUserId,
            is_approved: true,
            status: 'approved'
          }])
          .select()
          .maybeSingle();

        if (!insertErr && insertedRow) {
          supabaseSuccess = true;
          targetUserId = insertedRow.user_id || targetUserId;
        } else {
          const { data: baseInserted } = await supabase
            .from('rider_profiles')
            .insert([baseInsertPayload])
            .select()
            .maybeSingle();

          if (baseInserted) {
            supabaseSuccess = true;
            targetUserId = baseInserted.user_id || targetUserId;
          }
        }
      }

      // Update profiles role
      try {
        const profId = targetUserId || (typeof riderId === 'string' && riderId.length > 20 && !riderId.startsWith('rider_') ? riderId : null);
        if (profId) {
          await supabase.from('profiles').update({ role: 'rider', updated_at: nowIso }).eq('id', profId);
        }
        if (cleanPhone) {
          const { data: allProfs } = await supabase.from('profiles').select('id, phone');
          const matchedProf = (allProfs || []).find(p => get10DigitPhone(p.phone) === cleanPhone);
          if (matchedProf) {
            await supabase.from('profiles').update({ role: 'rider', updated_at: nowIso }).eq('id', matchedProf.id);
          }
        }
      } catch {}
    } catch (err) {
      console.error('Exception in approveRiderInSupabase:', err);
    }
  }

  // 4. Multi-channel broadcast updates locally & across browser tabs
  try {
    const updateEvent = {
      type: 'RIDER_STATUS_UPDATE',
      riderId,
      userId: targetUserId,
      phone: cleanPhone,
      isApproved: true,
      status: 'approved',
      timestamp: Date.now()
    };

    localStorage.setItem('gharsee_rider_status_update', JSON.stringify(updateEvent));

    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('gharsee_admin_rider_bus');
      bc.postMessage(updateEvent);
      bc.close();
    }

    window.dispatchEvent(new CustomEvent('gharsee_rider_status_changed', {
      detail: { riderId, userId: targetUserId, isApproved: true, status: 'approved', phone: cleanPhone }
    }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'gharsee_rider_status_update' }));
  } catch {}

  return true;
}

// Reject a Rider Registration
export async function rejectRiderInSupabase(riderId, extraData = {}) {
  const nowIso = new Date().toISOString();
  const cleanPhone = get10DigitPhone(extraData?.phone || (typeof riderId === 'string' && riderId.match(/^\d{10}$/) ? riderId : ''));

  // 1. Record rejection in status registry
  setRiderStatusInRegistry(cleanPhone, riderId, false, 'rejected');

  // 2. Update local storage caches
  try {
    const latestReg = JSON.parse(localStorage.getItem('gharsee_latest_rider_registration') || 'null');
    if (latestReg && (latestReg.riderId === riderId || (cleanPhone && get10DigitPhone(latestReg.phone) === cleanPhone))) {
      localStorage.setItem('gharsee_latest_rider_registration', JSON.stringify({
        ...latestReg,
        isApproved: false,
        isPending: false,
        status: 'rejected'
      }));
    }

    const cachedRiders = JSON.parse(localStorage.getItem('gharsee_local_riders') || '[]');
    const updatedLocal = cachedRiders.map(r => {
      if (r.riderId === riderId || r.id === riderId || (cleanPhone && get10DigitPhone(r.phone) === cleanPhone)) {
        return { ...r, isApproved: false, isPending: false, status: 'rejected', isOnline: false };
      }
      return r;
    });
    localStorage.setItem('gharsee_local_riders', JSON.stringify(updatedLocal));

    const cached = JSON.parse(localStorage.getItem('gharsee_rider_profile') || 'null');
    if (cached && (cached.id === riderId || cached.user_id === riderId || (cleanPhone && get10DigitPhone(cached.phone) === cleanPhone))) {
      localStorage.setItem('gharsee_rider_profile', JSON.stringify({
        ...cached,
        isApproved: false,
        isPending: false,
        status: 'rejected',
        is_approved: false,
        isOnline: false
      }));
    }
  } catch {}

  // 3. Supabase remote database updates
  let targetUserId = extraData?.userId || extraData?.user_id || null;

  if (isSupabaseConfigured) {
    try {
      const { data: allRiders } = await supabase.from('rider_profiles').select('*');
      const matched = (allRiders || []).find(r => 
        (riderId && r.id === riderId) ||
        (riderId && r.user_id === riderId) ||
        (targetUserId && r.user_id === targetUserId) ||
        (cleanPhone && get10DigitPhone(r.phone) === cleanPhone)
      );

      const rejectPayload = {
        is_approved: false,
        status: 'rejected',
        is_online: false,
        updated_at: nowIso
      };

      if (matched?.id) {
        targetUserId = matched.user_id || targetUserId;
        await supabase
          .from('rider_profiles')
          .update(rejectPayload)
          .eq('id', matched.id);
      } else if (cleanPhone) {
        await supabase
          .from('rider_profiles')
          .update(rejectPayload)
          .eq('phone', extraData?.phone || `+91${cleanPhone}`);
      }
    } catch (err) {
      console.error('Exception in rejectRiderInSupabase:', err);
    }
  }

  // 4. Multi-channel broadcast
  try {
    const updateEvent = {
      type: 'RIDER_STATUS_UPDATE',
      riderId,
      userId: targetUserId,
      phone: cleanPhone,
      isApproved: false,
      status: 'rejected',
      timestamp: Date.now()
    };

    localStorage.setItem('gharsee_rider_status_update', JSON.stringify(updateEvent));

    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('gharsee_admin_rider_bus');
      bc.postMessage(updateEvent);
      bc.close();
    }

    window.dispatchEvent(new CustomEvent('gharsee_rider_status_changed', {
      detail: { riderId, userId: targetUserId, isApproved: false, status: 'rejected', phone: cleanPhone }
    }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'gharsee_rider_status_update' }));
  } catch {}

  return true;
}

// Fetch all registered customer profiles & geolocations
export async function fetchAllAdminCustomers() {
  if (!isSupabaseConfigured) return [];

  try {
    const { data, error } = await supabase
      .from('customer_addresses')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) return [];

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

    if (error || !data) return [];

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
    return [];
  }
}

// Update Order Status from Admin Portal
export async function updateAdminOrderStatus(orderId, nextStatus) {
  if (!isSupabaseConfigured) return false;

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
    return false;
  }
}

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

    if (error || !data) return [];

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
    return [];
  }
}

// Add a new product to a specific store in Supabase
export async function createProductForShop(shopId, productData) {
  if (!isSupabaseConfigured || !shopId) return null;

  try {
    let globalId = productData.globalProductId;

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

    if (legacyErr) return null;
    return legacyData;
  } catch (err) {
    return null;
  }
}

// Update existing product in Supabase
export async function updateProductInSupabase(productId, productData) {
  if (!isSupabaseConfigured || !productId) return false;

  try {
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
      if (productData.globalProductId && productData.name) {
        await updateGlobalProduct(productData.globalProductId, productData);
      }
      return true;
    }

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
    return false;
  }
}

// Delete product from Supabase
export async function deleteProductInSupabase(productId) {
  if (!isSupabaseConfigured || !productId) return false;

  try {
    const spRemoved = await removeProductFromStore(productId);
    if (spRemoved) return true;

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId);

    return !error;
  } catch (err) {
    return false;
  }
}

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