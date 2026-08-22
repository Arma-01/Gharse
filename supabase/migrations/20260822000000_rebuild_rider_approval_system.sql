-- ============================================================================
-- GHARSEE / UR GROZY RIDER APPROVAL SYSTEM REBUILD MIGRATION
-- Date: 2026-08-22
-- Description:
--   1. Ensures authoritative columns on public.rider_profiles table:
--      id, user_id, phone, full_name, vehicle_type, vehicle_number,
--      driving_license, delivery_city, approval_status, is_active,
--      is_online, rejection_reason, rating, total_deliveries, created_at, updated_at
--   2. Ensures backward-compatible alias columns (is_approved, status).
--   3. Sets default approval_status = 'pending', is_active = false, is_online = false.
--   4. Configures clean, non-blocking Row Level Security (RLS) policies.
--   5. Adds rider_profiles and profiles to supabase_realtime publication.
-- ============================================================================

-- 1. Create or ensure table public.rider_profiles
CREATE TABLE IF NOT EXISTS public.rider_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  phone TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL DEFAULT 'Delivery Partner',
  vehicle_type TEXT NOT NULL DEFAULT 'scooter',
  vehicle_number TEXT NOT NULL DEFAULT 'Not specified',
  driving_license TEXT NOT NULL DEFAULT 'Not specified',
  delivery_city TEXT NOT NULL DEFAULT 'Chikkamagaluru, Karnataka',
  approval_status TEXT NOT NULL DEFAULT 'pending',
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  is_online BOOLEAN NOT NULL DEFAULT FALSE,
  rejection_reason TEXT,
  rating NUMERIC(3,2) DEFAULT 5.0,
  total_deliveries INT DEFAULT 0,
  is_approved BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add columns if table already existed without them
ALTER TABLE public.rider_profiles 
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS full_name TEXT DEFAULT 'Delivery Partner',
  ADD COLUMN IF NOT EXISTS vehicle_type TEXT DEFAULT 'scooter',
  ADD COLUMN IF NOT EXISTS vehicle_number TEXT DEFAULT 'Not specified',
  ADD COLUMN IF NOT EXISTS driving_license TEXT DEFAULT 'Not specified',
  ADD COLUMN IF NOT EXISTS delivery_city TEXT DEFAULT 'Chikkamagaluru, Karnataka',
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) DEFAULT 5.0,
  ADD COLUMN IF NOT EXISTS total_deliveries INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Set proper defaults on existing columns
ALTER TABLE public.rider_profiles 
  ALTER COLUMN approval_status SET DEFAULT 'pending',
  ALTER COLUMN is_active SET DEFAULT FALSE,
  ALTER COLUMN is_online SET DEFAULT FALSE,
  ALTER COLUMN is_approved SET DEFAULT FALSE,
  ALTER COLUMN status SET DEFAULT 'pending';

-- 4. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_rider_profiles_phone ON public.rider_profiles(phone);
CREATE INDEX IF NOT EXISTS idx_rider_profiles_user_id ON public.rider_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_rider_profiles_approval_status ON public.rider_profiles(approval_status);
CREATE INDEX IF NOT EXISTS idx_rider_profiles_is_online ON public.rider_profiles(is_online);

-- 5. Ensure columns on public.profiles
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 6. Grant permissions to anon, authenticated and service_role
GRANT ALL ON TABLE public.rider_profiles TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.profiles TO anon, authenticated, service_role, postgres;

-- 7. Enable Row Level Security (RLS)
ALTER TABLE public.rider_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 8. Drop old / conflicting RLS policies
DROP POLICY IF EXISTS "Rider profiles public access" ON public.rider_profiles;
DROP POLICY IF EXISTS "Rider profiles unrestricted select" ON public.rider_profiles;
DROP POLICY IF EXISTS "Rider profiles unrestricted insert" ON public.rider_profiles;
DROP POLICY IF EXISTS "Rider profiles unrestricted update" ON public.rider_profiles;
DROP POLICY IF EXISTS "Allow select for all authenticated users and riders" ON public.rider_profiles;
DROP POLICY IF EXISTS "Allow insert for new rider registrations" ON public.rider_profiles;
DROP POLICY IF EXISTS "Allow update for rider profile management and admin approval" ON public.rider_profiles;
DROP POLICY IF EXISTS "Public read rider_profiles" ON public.rider_profiles;
DROP POLICY IF EXISTS "Public write rider_profiles" ON public.rider_profiles;

DROP POLICY IF EXISTS "Profiles public access" ON public.profiles;
DROP POLICY IF EXISTS "Public read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public write profiles" ON public.profiles;

-- 9. Create robust, clean RLS policies for public.rider_profiles
CREATE POLICY "Rider profiles public access" ON public.rider_profiles
  FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Profiles public access" ON public.profiles
  FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

-- 10. Auto-sync trigger for updated_at
CREATE OR REPLACE FUNCTION update_rider_profiles_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  -- Keep legacy boolean / text fields synchronized with approval_status and is_active
  IF NEW.approval_status = 'approved' AND NEW.is_active = TRUE THEN
    NEW.is_approved = TRUE;
    NEW.status = 'approved';
  ELSIF NEW.approval_status = 'rejected' THEN
    NEW.is_approved = FALSE;
    NEW.status = 'rejected';
    NEW.is_online = FALSE;
  ELSIF NEW.approval_status = 'suspended' THEN
    NEW.is_approved = FALSE;
    NEW.status = 'suspended';
    NEW.is_online = FALSE;
  ELSE
    NEW.is_approved = FALSE;
    NEW.status = 'pending';
    NEW.is_online = FALSE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_rider_profiles_timestamp ON public.rider_profiles;
CREATE TRIGGER trg_update_rider_profiles_timestamp
  BEFORE INSERT OR UPDATE ON public.rider_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_rider_profiles_timestamp();

-- 11. Add rider_profiles and profiles to supabase_realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'rider_profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rider_profiles;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;
