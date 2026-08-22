import { supabase, isSupabaseConfigured } from '../lib/supabase.js';
import { 
  normalizePhone, 
  get10DigitPhone, 
  signUpPartnerWithPhone, 
  signInPartnerWithPhone 
} from './authService.js';

/**
 * Retrieve persistent rider status from local registry
 */
export function getPersistentRiderStatus(phone, riderId = null, userId = null) {
  try {
    const cleanPhone = get10DigitPhone(phone);
    const registry = JSON.parse(localStorage.getItem('gharsee_riders_status_registry') || '{}');
    if (cleanPhone && registry[cleanPhone]) return registry[cleanPhone];
    if (riderId && registry[riderId]) return registry[riderId];
    if (userId && registry[userId]) return registry[userId];
  } catch {}
  return null;
}

/**
 * Write persistent rider status to local registry for immediate multi-window/multi-session authority
 */
export function setPersistentRiderStatus(phone, riderId, statusData) {
  try {
    const cleanPhone = get10DigitPhone(phone);
    const registry = JSON.parse(localStorage.getItem('gharsee_riders_status_registry') || '{}');
    const entry = {
      ...statusData,
      phone: cleanPhone || phone,
      riderId,
      updatedAt: new Date().toISOString()
    };
    if (cleanPhone) registry[cleanPhone] = entry;
    if (riderId) registry[riderId] = entry;
    if (statusData?.userId) registry[statusData.userId] = entry;
    localStorage.setItem('gharsee_riders_status_registry', JSON.stringify(registry));
  } catch {}
}

/**
 * Normalizes a raw rider record from Supabase into a consistent, authoritative Rider object.
 */
export function normalizeRiderProfile(rawRecord, fallbackUserId = null, fallbackPhone = null) {
  if (!rawRecord && !fallbackUserId && !fallbackPhone) return null;

  const raw = rawRecord || {};
  const cleanDigits = get10DigitPhone(raw.phone || fallbackPhone);
  const normalizedPhone = raw.phone || (cleanDigits ? `+91${cleanDigits}` : '');
  
  // Authoritative state evaluation (checking database record + persistent status registry)
  const rawStatus = (raw.approval_status || raw.status || '').toLowerCase().trim();
  const regEntry = getPersistentRiderStatus(normalizedPhone, raw.id || fallbackUserId, raw.user_id || fallbackUserId);

  let approvalStatus = 'pending';
  let isActive = false;
  let rejectionReason = raw.rejection_reason || raw.rejectionReason || regEntry?.rejectionReason || null;

  if (raw.approval_status) {
    approvalStatus = raw.approval_status.toLowerCase();
    isActive = Boolean(raw.is_active === true && approvalStatus === 'approved');
  } else if (raw.is_approved === true || rawStatus === 'approved' || rawStatus === 'active') {
    approvalStatus = 'approved';
    isActive = Boolean(raw.is_active ?? true);
  } else if (rawStatus === 'rejected') {
    approvalStatus = 'rejected';
    isActive = false;
  } else if (rawStatus === 'suspended') {
    approvalStatus = 'suspended';
    isActive = false;
  } else if (regEntry) {
    approvalStatus = regEntry.approvalStatus || (regEntry.isApproved ? 'approved' : (regEntry.status || 'pending'));
    isActive = Boolean(approvalStatus === 'approved' && regEntry.isActive !== false);
    if (regEntry.rejectionReason) rejectionReason = regEntry.rejectionReason;
  } else {
    approvalStatus = 'pending';
    isActive = false;
  }

  const isApproved = approvalStatus === 'approved';
  const isOnline = Boolean(isApproved && isActive && (raw.is_online === true || raw.isOnline === true));

  return {
    id: raw.id || fallbackUserId || `rider_${cleanDigits}`,
    user_id: raw.user_id || fallbackUserId,
    userId: raw.user_id || fallbackUserId,
    phone: normalizedPhone,
    fullName: raw.full_name || raw.fullName || raw.name || 'Delivery Partner',
    name: raw.full_name || raw.fullName || raw.name || 'Delivery Partner',
    role: 'rider',
    vehicleType: (raw.vehicle_type || raw.vehicleType || 'scooter').toLowerCase(),
    vehicleNumber: raw.vehicle_number || raw.vehicleNumber || 'Not specified',
    drivingLicense: raw.driving_license || raw.drivingLicense || 'Not specified',
    deliveryCity: raw.delivery_city || raw.deliveryCity || 'Chikkamagaluru, Karnataka',
    approval_status: approvalStatus,
    approvalStatus: approvalStatus,
    is_active: isActive,
    isActive: isActive,
    is_online: isOnline,
    isOnline: isOnline,
    rejection_reason: rejectionReason,
    rejectionReason: rejectionReason,
    rating: raw.rating || 5.0,
    totalDeliveries: raw.total_deliveries || raw.totalDeliveries || 0,
    createdAt: raw.created_at || new Date().toISOString(),
    // Backward compatibility aliases
    status: approvalStatus,
    isPending: approvalStatus === 'pending',
    isApproved: isApproved,
    is_approved: isApproved
  };
}

/**
 * Fetch the authoritative Rider Profile directly from Supabase.
 */
export async function fetchRiderProfileFromSupabase(userId = null, phone = null) {
  if (!isSupabaseConfigured) return null;

  const cleanDigits = get10DigitPhone(phone);

  try {
    const { data: allRiders, error } = await supabase
      .from('rider_profiles')
      .select('*');

    if (error) {
      console.warn('fetchRiderProfileFromSupabase query warning:', error.message);
      return null;
    }

    const matched = (allRiders || []).find(r => 
      (userId && r.user_id === userId) ||
      (userId && r.id === userId) ||
      (cleanDigits && get10DigitPhone(r.phone) === cleanDigits)
    );

    if (matched) {
      return normalizeRiderProfile(matched, userId, phone);
    }

    // If phone is given but not in rider_profiles, still check if there's a registered user
    if (cleanDigits || userId) {
      const reg = getPersistentRiderStatus(phone, userId);
      if (reg) {
        return normalizeRiderProfile(null, userId, phone);
      }
    }

    return null;
  } catch (err) {
    console.error('Exception in fetchRiderProfileFromSupabase:', err);
    return null;
  }
}

/**
 * Update Rider is_online status in Supabase rider_profiles table.
 * Only allowed if the rider is approved and active.
 */
export async function updateRiderOnlineStatusInSupabase(riderPhone, isOnlineStatus, userId = null) {
  if (!isSupabaseConfigured) return false;

  const cleanDigits = get10DigitPhone(riderPhone);

  try {
    // 1. Locate authoritative rider record
    const { data: riders } = await supabase.from('rider_profiles').select('id, user_id, phone, approval_status, is_active, is_approved, status');
    const matched = (riders || []).find(r => 
      (userId && (r.user_id === userId || r.id === userId)) ||
      (cleanDigits && get10DigitPhone(r.phone) === cleanDigits)
    );

    if (!matched) return false;

    // Safety check: only approved & active riders can toggle online availability
    const status = (matched.approval_status || matched.status || '').toLowerCase();
    const isApproved = matched.approval_status === 'approved' || matched.is_approved === true || status === 'approved';
    const isActive = matched.is_active !== false && isApproved;

    const safeOnlineState = (isApproved && isActive) ? Boolean(isOnlineStatus) : false;

    const { error } = await supabase
      .from('rider_profiles')
      .update({
        is_online: safeOnlineState,
        updated_at: new Date().toISOString()
      })
      .eq('id', matched.id);

    return !error;
  } catch (err) {
    console.error('Error updating rider is_online status in Supabase:', err);
    return false;
  }
}

/**
 * Sign Up a new Rider:
 * 1. Creates Supabase Auth User with role = 'rider'.
 * 2. Creates/updates single authoritative record in rider_profiles with:
 *    - approval_status = 'pending'
 *    - is_active = false
 *    - is_online = false
 */
export async function signUpRiderInSupabase({
  phone,
  password,
  fullName,
  vehicleType = 'scooter',
  vehicleNumber = '',
  drivingLicense = '',
  deliveryCity = 'Chikkamagaluru'
}) {
  if (!isSupabaseConfigured) {
    return { user: null, error: 'Supabase connection is not configured.' };
  }

  const cleanDigits = get10DigitPhone(phone);
  if (!cleanDigits || cleanDigits.length < 10) {
    return { user: null, error: 'Please enter a valid 10-digit mobile phone number.' };
  }

  if (!password || password.length < 6) {
    return { user: null, error: 'Password must be at least 6 characters long.' };
  }

  try {
    const normalizedPhone = normalizePhone(phone);
    const safeFullName = (fullName || 'Delivery Partner').trim();
    const vType = (vehicleType || 'scooter').toLowerCase();
    const vNum = (vehicleNumber || `KA-14-EA-${cleanDigits.slice(-4)}`).trim().toUpperCase();
    const dLic = (drivingLicense || `KA14202400${cleanDigits.slice(-5)}`).trim().toUpperCase();
    const safeCity = deliveryCity || 'Chikkamagaluru, Karnataka';

    // 1. Create Supabase Auth User with role 'rider'
    let authUser = null;
    const authRes = await signUpPartnerWithPhone({
      phone: normalizedPhone,
      password,
      fullName: safeFullName,
      role: 'rider',
      vehicleType: vType,
      vehicleNumber: vNum,
      drivingLicense: dLic,
      deliveryCity: safeCity
    });

    if (authRes.user) {
      authUser = authRes.user;
    } else {
      // If user already exists in auth, attempt sign-in
      const signInRes = await signInPartnerWithPhone({
        phone: normalizedPhone,
        password,
        expectedRole: 'rider'
      });

      if (signInRes.user) {
        authUser = signInRes.user;
      } else {
        return { 
          user: null, 
          error: authRes.error || signInRes.error || 'An account with this mobile number already exists. Please sign in.' 
        };
      }
    }

    const userId = authUser.id;

    // 2. Guarantee public.profiles row
    try {
      await supabase
        .from('profiles')
        .upsert({
          id: userId,
          phone: normalizedPhone,
          full_name: safeFullName,
          role: 'rider',
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
    } catch (profErr) {
      console.warn('Profile sync in signUpRiderInSupabase:', profErr);
    }

    // 3. Guarantee authoritative row in public.rider_profiles with pending status
    let persistedRiderId = userId;
    const nowIso = new Date().toISOString();

    const authoritativeRiderPayload = {
      user_id: userId,
      full_name: safeFullName,
      phone: normalizedPhone,
      vehicle_type: vType,
      vehicle_number: vNum,
      driving_license: dLic,
      delivery_city: safeCity,
      approval_status: 'pending',
      is_active: false,
      is_online: false,
      rejection_reason: null,
      is_approved: false,
      status: 'pending',
      updated_at: nowIso
    };

    const { data: allRiders } = await supabase.from('rider_profiles').select('*');
    const existing = (allRiders || []).find(r => 
      (userId && r.user_id === userId) || 
      (cleanDigits && get10DigitPhone(r.phone) === cleanDigits)
    );

    if (existing) {
      persistedRiderId = existing.id;
      const { error: updateErr } = await supabase
        .from('rider_profiles')
        .update(authoritativeRiderPayload)
        .eq('id', existing.id);

      if (updateErr) {
        // Fallback for base columns if new columns not yet migrated
        await supabase
          .from('rider_profiles')
          .update({
            user_id: userId,
            full_name: safeFullName,
            vehicle_type: vType,
            vehicle_number: vNum,
            driving_license: dLic,
            delivery_city: safeCity,
            is_online: false,
            updated_at: nowIso
          })
          .eq('id', existing.id)
          .catch?.(() => {});
      }
    } else {
      const { data: inserted, error: insertErr } = await supabase
        .from('rider_profiles')
        .insert([{
          ...authoritativeRiderPayload,
          created_at: nowIso
        }])
        .select()
        .maybeSingle();

      if (!insertErr && inserted?.id) {
        persistedRiderId = inserted.id;
      } else {
        // Fallback insert with base columns
        const { data: baseInserted } = await supabase
          .from('rider_profiles')
          .insert([{
            user_id: userId,
            full_name: safeFullName,
            phone: normalizedPhone,
            vehicle_type: vType,
            vehicle_number: vNum,
            driving_license: dLic,
            delivery_city: safeCity,
            is_online: false,
            created_at: nowIso,
            updated_at: nowIso
          }])
          .select()
          .maybeSingle();

        if (baseInserted?.id) {
          persistedRiderId = baseInserted.id;
        }
      }
    }

    const riderUser = normalizeRiderProfile({
      ...authoritativeRiderPayload,
      id: persistedRiderId
    }, userId, normalizedPhone);

    // Broadcast across tabs so Admin gets immediate notification
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('gharsee_admin_rider_bus');
        bc.postMessage({ type: 'RIDER_REGISTERED', rider: riderUser });
        bc.close();
      }
      window.dispatchEvent(new CustomEvent('gharsee_rider_registered', { detail: { rider: riderUser } }));
    } catch {}

    return { user: riderUser, error: null };
  } catch (err) {
    console.error('Exception in signUpRiderInSupabase:', err);
    return { user: null, error: err.message || 'Rider registration failed.' };
  }
}

/**
 * Sign In Rider using Supabase Auth + retrieve live authoritative approval state
 */
export async function signInRiderWithPhone({ phone, password }) {
  if (!isSupabaseConfigured) {
    return { user: null, error: 'Supabase is not configured.' };
  }

  const cleanDigits = get10DigitPhone(phone);
  if (!cleanDigits || cleanDigits.length < 10) {
    return { user: null, error: 'Please enter a valid 10-digit mobile phone number.' };
  }

  if (!password) {
    return { user: null, error: 'Please enter your password.' };
  }

  try {
    const authRes = await signInPartnerWithPhone({
      phone,
      password,
      expectedRole: 'rider'
    });

    if (authRes.error || !authRes.user) {
      return { 
        user: null, 
        error: authRes.error || 'Authentication failed. Please check your phone number and password.' 
      };
    }

    const authUser = authRes.user;

    // Fetch authoritative rider profile from Supabase
    const liveProfile = await fetchRiderProfileFromSupabase(authUser.id, authUser.phone || phone);

    if (liveProfile) {
      return { user: liveProfile, error: null };
    }

    // Fallback if profile row is missing: construct clean pending profile
    const fallbackProfile = normalizeRiderProfile({
      user_id: authUser.id,
      phone: authUser.phone || normalizePhone(phone),
      full_name: authUser.user_metadata?.full_name || 'Delivery Partner',
      approval_status: 'pending',
      is_active: false,
      is_online: false
    }, authUser.id, phone);

    return { user: fallbackProfile, error: null };
  } catch (err) {
    console.error('Exception in signInRiderWithPhone:', err);
    return { user: null, error: 'Authentication failed. Please check phone number and password.' };
  }
}