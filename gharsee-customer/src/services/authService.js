import { supabase, isSupabaseConfigured, getSupabaseErrorMessage } from '../lib/supabase';

// Enable real authentication with Supabase Auth
export const ENABLE_REAL_AUTH = true;

// Standard RFC 4122 v4 UUID Generator
export function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Helper to normalize Indian mobile numbers to standard E.164 (+91XXXXXXXXXX)
export function normalizePhone(phoneInput) {
  if (!phoneInput) return '';
  const digits = phoneInput.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (phoneInput.startsWith('+')) return phoneInput;
  return `+${digits}`;
}

// Extract clean 10-digit number for matching regardless of country code or whitespace
export function get10DigitPhone(phoneInput) {
  if (!phoneInput) return '';
  return phoneInput.replace(/\D/g, '').slice(-10);
}

// Deterministic auth identifier mapping using @gmail.com for 100% valid MX & Supabase Auth compatibility
export function phoneToAuthEmail(phoneInput) {
  const clean = get10DigitPhone(phoneInput);
  if (!clean || clean.length < 10) return '';
  return `user_${clean}@gmail.com`;
}

/**
 * Sign Up User with Phone + Password natively using Supabase Auth
 */
export async function signUpUserWithPhone({
  phone,
  password,
  fullName,
  role = 'customer',
  storeName = '',
  address = '',
  locality = '',
  city = '',
  state = '',
  pincode = '',
  latitude = null,
  longitude = null,
  imageUrl = null,
  vehicleType = 'scooter',
  vehicleNumber = '',
  drivingLicense = '',
  deliveryCity = ''
}) {
  if (!isSupabaseConfigured) {
    return { user: null, session: null, error: 'Supabase is not configured' };
  }

  const cleanDigits = get10DigitPhone(phone);
  if (!cleanDigits || cleanDigits.length < 10) {
    return { user: null, session: null, error: 'Please enter a valid 10-digit mobile number.' };
  }

  if (!password || password.length < 6) {
    return { user: null, session: null, error: 'Password must be at least 6 characters long.' };
  }

  try {
    const normalizedPhone = normalizePhone(phone);
    const authEmail = phoneToAuthEmail(phone);
    const safeFullName = (fullName || (role === 'rider' ? 'Delivery Partner' : (role === 'shopkeeper' ? 'Store Partner' : 'Customer'))).trim();

    // 1. Primary Attempt: Supabase Auth Email-backed Provider
    let authRes = await supabase.auth.signUp({
      email: authEmail,
      password: password,
      options: {
        data: {
          phone: normalizedPhone,
          full_name: safeFullName,
          role: role
        }
      }
    });

    // 2. Secondary Attempt: If Email signup is disabled in dashboard, attempt native Phone provider
    if (authRes.error && (
      authRes.error.message?.includes('Email signups are disabled') ||
      authRes.error.message?.includes('signup_disabled')
    )) {
      const phoneRes = await supabase.auth.signUp({
        phone: normalizedPhone,
        password: password,
        options: {
          data: {
            phone: normalizedPhone,
            full_name: safeFullName,
            role: role
          }
        }
      });
      if (!phoneRes.error && phoneRes.data?.user) {
        authRes = phoneRes;
      }
    }

    // 3. Handle Errors / Existing Users / Rate Limits
    if (authRes.error) {
      const msg = (authRes.error.message || '').toLowerCase();

      if (
        msg.includes('rate limit') || 
        msg.includes('rate_limit') || 
        msg.includes('already registered') || 
        msg.includes('already exists') || 
        msg.includes('duplicate') || 
        msg.includes('user already registered') ||
        authRes.error.status === 429
      ) {
        const directSignIn = await signInUserWithPhone({ phone, password, expectedRole: role });
        if (!directSignIn.error && directSignIn.user) {
          return directSignIn;
        }

        if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('user already registered')) {
          return {
            user: null,
            session: null,
            error: `An account with mobile number ${cleanDigits} is already registered. Please enter your password and click Sign In.`
          };
        }

        return {
          user: null,
          session: null,
          error: 'Rate limit reached. Please disable "Confirm email" in Supabase Dashboard (Authentication ➔ Providers ➔ Email ➔ Turn off "Confirm email"), or click "Sign In / Login".'
        };
      }

      if (msg.includes('email signups are disabled') || msg.includes('signup_disabled')) {
        return {
          user: null,
          session: null,
          error: 'Signups are disabled in your Supabase project settings. Please go to Supabase Dashboard ➔ Authentication ➔ Providers ➔ Email ➔ Turn ON "Allow new users to sign up" and turn OFF "Confirm email".'
        };
      }

      return { user: null, session: null, error: getSupabaseErrorMessage ? getSupabaseErrorMessage(authRes.error) : authRes.error.message };
    }

    const authUser = authRes.data?.user;
    if (!authUser) {
      return { user: null, session: null, error: 'Failed to create user authentication account.' };
    }

    // 4. Ensure profile in public.profiles table
    try {
      await supabase
        .from('profiles')
        .upsert({
          id: authUser.id,
          phone: normalizedPhone,
          full_name: safeFullName,
          role: role,
          updated_at: new Date().toISOString()
        });
    } catch (profileErr) {
      console.warn('Profile sync warning:', profileErr);
    }

    // 5. If Shopkeeper, automatically create store record with owner_id
    if (role === 'shopkeeper' && storeName) {
      try {
        const shopLocality = locality || 'Uppalli';
        const shopCity = city || 'Chikkamagaluru';
        const shopState = state || 'Karnataka';
        const shopAddress = address || `${shopLocality}, ${shopCity}, ${shopState}${pincode ? ' - ' + pincode : ''}`;

        await supabase
          .from('shops')
          .insert([{
            owner_id: authUser.id,
            name: storeName,
            phone: normalizedPhone,
            address: shopAddress,
            locality: shopLocality,
            city: shopCity,
            state: shopState,
            pincode: pincode || '577101',
            latitude: latitude != null ? parseFloat(latitude) : 13.3284,
            longitude: longitude != null ? parseFloat(longitude) : 75.7578,
            status: 'pending',
            is_approved: false,
            is_open: false,
            image_url: imageUrl || '/images/store_lakshmi.jpg'
          }]);
      } catch (shopErr) {
        console.warn('Shop creation warning:', shopErr);
      }
    } else if (role === 'rider') {
      try {
        const riderCity = deliveryCity || city || 'Chikkamagaluru, Karnataka';
        const vType = (vehicleType || 'scooter').toLowerCase();
        const vNum = (vehicleNumber || `KA-14-EA-${cleanDigits.slice(-4)}`).trim().toUpperCase();
        const dLic = (drivingLicense || `KA14202400${cleanDigits.slice(-5)}`).trim().toUpperCase();

        const { data: allR } = await supabase.from('rider_profiles').select('id, phone');
        const existingR = (allR || []).find(r => get10DigitPhone(r.phone) === cleanDigits);

        if (existingR?.id) {
          await supabase
            .from('rider_profiles')
            .update({
              user_id: authUser.id,
              full_name: safeFullName,
              vehicle_type: vType,
              vehicle_number: vNum,
              driving_license: dLic,
              delivery_city: riderCity,
              is_approved: false,
              status: 'pending',
              is_online: false
            })
            .eq('id', existingR.id);
        } else {
          await supabase
            .from('rider_profiles')
            .insert([{
              user_id: authUser.id,
              full_name: safeFullName,
              phone: normalizedPhone,
              vehicle_type: vType,
              vehicle_number: vNum,
              driving_license: dLic,
              delivery_city: riderCity,
              is_approved: false,
              status: 'pending',
              is_online: false
            }]);
        }
      } catch (riderErr) {
        console.warn('Rider creation warning in signUpUserWithPhone:', riderErr);
      }
    }

    return {
      user: {
        id: authUser.id,
        phone: normalizedPhone,
        user_metadata: { full_name: safeFullName, role: role, phone: normalizedPhone },
        role: role
      },
      session: authRes.data.session,
      error: null
    };
  } catch (err) {
    console.error('Exception in signUpUserWithPhone:', err);
    return { user: null, session: null, error: err.message || 'Registration failed' };
  }
}

/**
 * Sign In User with Phone + Password natively using Supabase Auth
 */
export async function signInUserWithPhone({ phone, password, expectedRole = null }) {
  if (!isSupabaseConfigured) {
    return { session: null, user: null, error: 'Supabase is not configured' };
  }

  const cleanDigits = get10DigitPhone(phone);
  if (!cleanDigits || cleanDigits.length < 10) {
    return { session: null, user: null, error: 'Please enter a valid 10-digit mobile phone number.' };
  }

  if (!password) {
    return { session: null, user: null, error: 'Please enter your password.' };
  }

  try {
    const normalizedPhone = normalizePhone(phone);
    const candidateEmails = [
      `user_${cleanDigits}@gmail.com`,
      `phone_${cleanDigits}@gmail.com`,
      `partner_${cleanDigits}@urgrozy.in`,
      `user_${cleanDigits}@urgrozy.in`
    ];

    let authRes = null;

    // 1. Try candidate email authenticators
    for (const email of candidateEmails) {
      const res = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });
      if (!res.error && res.data?.user) {
        authRes = res;
        break;
      }
    }

    // 2. If email sign in failed, try native phone sign in
    if (!authRes || !authRes.data?.user) {
      const phoneRes = await supabase.auth.signInWithPassword({
        phone: normalizedPhone,
        password: password
      });
      if (!phoneRes.error && phoneRes.data?.user) {
        authRes = phoneRes;
      }
    }

    // 3. If Sign In succeeded with Supabase Auth
    if (authRes && authRes.data?.user) {
      const authUser = authRes.data.user;
      let userRole = authUser.user_metadata?.role || expectedRole || 'customer';
      let userFullName = authUser.user_metadata?.full_name || 'UR GROZY User';

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (profile) {
        userRole = profile.role || userRole;
        userFullName = profile.full_name || userFullName;
      } else {
        await supabase
          .from('profiles')
          .upsert({
            id: authUser.id,
            phone: normalizedPhone,
            role: userRole,
            full_name: userFullName,
            updated_at: new Date().toISOString()
          })
          .catch?.(() => {});
      }

      if (expectedRole && userRole && userRole !== expectedRole) {
        return {
          session: null,
          user: null,
          profile: null,
          error: `Access Restricted: This account is registered as a ${userRole === 'rider' ? 'Delivery Partner (Rider)' : (userRole === 'shopkeeper' ? 'Store Partner (Shopkeeper)' : 'Customer')}. Please sign in with the appropriate role.`
        };
      }

      if (userRole === 'shopkeeper') {
        const { data: shops } = await supabase.from('shops').select('id, owner_id, phone');
        const matchedShop = (shops || []).find(s => get10DigitPhone(s.phone) === cleanDigits);
        if (matchedShop && (!matchedShop.owner_id || matchedShop.owner_id !== authUser.id)) {
          await supabase.from('shops').update({ owner_id: authUser.id }).eq('id', matchedShop.id).catch?.(() => {});
        }
      } else if (userRole === 'rider') {
        const { data: riders } = await supabase.from('rider_profiles').select('id, user_id, phone, is_approved, status');
        const matchedRider = (riders || []).find(r => get10DigitPhone(r.phone) === cleanDigits);
        if (matchedRider && (!matchedRider.user_id || matchedRider.user_id !== authUser.id)) {
          const isAppr = matchedRider.is_approved === true && matchedRider.status === 'active';
          await supabase.from('rider_profiles').update({ 
            user_id: authUser.id,
            is_online: isAppr ? true : false 
          }).eq('id', matchedRider.id).catch?.(() => {});
        }
      }

      return {
        session: authRes.data.session,
        user: {
          id: authUser.id,
          phone: normalizedPhone,
          role: userRole,
          user_metadata: { full_name: userFullName, role: userRole, phone: normalizedPhone }
        },
        profile: profile || { id: authUser.id, role: userRole, phone: normalizedPhone, full_name: userFullName },
        error: null
      };
    }

    // 4. Fallback: Auto-onboard legacy database user into Supabase Auth
    let matchedLegacy = null;
    let targetRole = expectedRole || 'customer';
    let legacyName = targetRole === 'rider' ? 'Delivery Partner' : (targetRole === 'shopkeeper' ? 'Store Partner' : 'Customer');

    if (targetRole === 'shopkeeper' || !expectedRole) {
      const { data: shops } = await supabase.from('shops').select('*');
      const sMatch = (shops || []).find(s => get10DigitPhone(s.phone) === cleanDigits);
      if (sMatch) {
        matchedLegacy = sMatch;
        targetRole = 'shopkeeper';
        legacyName = sMatch.name || sMatch.owner_name || 'Store Partner';
      }
    }

    if (!matchedLegacy && (targetRole === 'rider' || !expectedRole)) {
      const { data: riders } = await supabase.from('rider_profiles').select('*');
      const rMatch = (riders || []).find(r => get10DigitPhone(r.phone) === cleanDigits);
      if (rMatch) {
        matchedLegacy = rMatch;
        targetRole = 'rider';
        legacyName = rMatch.full_name || rMatch.name || 'Delivery Partner';
      }
    }

    const { data: profiles } = await supabase.from('profiles').select('*');
    const matchedProfile = (profiles || []).find(p => get10DigitPhone(p.phone) === cleanDigits);
    if (matchedProfile && !matchedLegacy) {
      matchedLegacy = matchedProfile;
      targetRole = matchedProfile.role || targetRole;
      legacyName = matchedProfile.full_name || legacyName;
    }

    if (matchedLegacy) {
      const primaryEmail = phoneToAuthEmail(phone);
      const newAuthRes = await supabase.auth.signUp({
        email: primaryEmail,
        password: password,
        options: {
          data: {
            phone: normalizedPhone,
            full_name: legacyName,
            role: targetRole
          }
        }
      });

      if (!newAuthRes.error && newAuthRes.data?.user) {
        const newUserId = newAuthRes.data.user.id;

        await supabase
          .from('profiles')
          .upsert({
            id: newUserId,
            phone: normalizedPhone,
            full_name: legacyName,
            role: targetRole,
            updated_at: new Date().toISOString()
          })
          .catch?.(() => {});

        if (targetRole === 'shopkeeper' && matchedLegacy?.id) {
          await supabase.from('shops').update({ owner_id: newUserId }).eq('id', matchedLegacy.id).catch?.(() => {});
        } else if (targetRole === 'rider' && matchedLegacy?.id) {
          await supabase.from('rider_profiles').update({ user_id: newUserId, is_online: true }).eq('id', matchedLegacy.id).catch?.(() => {});
        }

        return {
          session: newAuthRes.data.session,
          user: {
            id: newUserId,
            phone: normalizedPhone,
            role: targetRole,
            user_metadata: { full_name: legacyName, role: targetRole, phone: normalizedPhone }
          },
          profile: { id: newUserId, phone: normalizedPhone, role: targetRole, full_name: legacyName },
          error: null
        };
      }
    }

    return {
      session: null,
      user: null,
      profile: null,
      error: 'Invalid mobile phone number or password. Please check your credentials.'
    };
  } catch (err) {
    console.error('Exception in signInUserWithPhone:', err);
    return { session: null, user: null, error: 'Authentication failed. Please check your mobile number and password.' };
  }
}

export async function signUpPartnerWithPhone(params) {
  return signUpUserWithPhone(params);
}

export async function signInPartnerWithPhone(params) {
  return signInUserWithPhone(params);
}

export async function signUpUser(params) {
  return signUpUserWithPhone(params);
}

export async function signInUser(params) {
  return signInUserWithPhone(params);
}

export async function signOutUser() {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn('signOut error:', err);
  }
}

export async function getCurrentUserProfile() {
  if (!isSupabaseConfigured) return null;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    return profile || {
      id: user.id,
      phone: user.phone || user.user_metadata?.phone || '',
      role: user.user_metadata?.role || 'customer',
      full_name: user.user_metadata?.full_name || 'User'
    };
  } catch {
    return null;
  }
}