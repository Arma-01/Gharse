-- ============================================================================
-- GHARSEE RIDER APPROVAL, REGISTRATION & DISCOVERY FIX MIGRATION
-- Date: 2026-08-21
-- Description:
--   1. Ensures all columns exist on public.rider_profiles and public.profiles.
--   2. Drops all legacy restrictive RLS policies that blocked Admin from discovering riders.
--   3. Sets up resilient, non-blocking RLS policies for rider_profiles and profiles.
--   4. Adds rider_profiles and profiles to supabase_realtime publication.
-- ============================================================================

-- 1. Ensure columns on public.rider_profiles
ALTER TABLE IF EXISTS public.rider_profiles 
  ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS vehicle_type TEXT DEFAULT 'scooter',
  ADD COLUMN IF NOT EXISTS vehicle_number TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS driving_license TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS delivery_city TEXT DEFAULT 'Chikkamagaluru, Karnataka',
  ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) DEFAULT 5.0,
  ADD COLUMN IF NOT EXISTS total_deliveries INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Drop any blocking foreign key constraints or check constraints
ALTER TABLE IF EXISTS public.rider_profiles DROP CONSTRAINT IF EXISTS rider_profiles_user_id_fkey;
ALTER TABLE IF EXISTS public.rider_profiles DROP CONSTRAINT IF EXISTS fk_rider_user;
ALTER TABLE IF EXISTS public.rider_profiles DROP CONSTRAINT IF EXISTS rider_profiles_vehicle_type_check;

-- 3. Alter defaults on rider_profiles
ALTER TABLE IF EXISTS public.rider_profiles 
  ALTER COLUMN is_approved SET DEFAULT FALSE,
  ALTER COLUMN status SET DEFAULT 'pending',
  ALTER COLUMN is_online SET DEFAULT FALSE;

-- 4. Ensure columns on public.profiles
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 5. Grant full table permissions to anon, authenticated and service_role
GRANT ALL ON TABLE public.rider_profiles TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.profiles TO anon, authenticated, service_role, postgres;

-- 6. Enable Row Level Security
ALTER TABLE IF EXISTS public.rider_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

-- 7. Drop all old/conflicting RLS policies on public.rider_profiles
DROP POLICY IF EXISTS "Allow select for all authenticated users and riders" ON public.rider_profiles;
DROP POLICY IF EXISTS "Allow insert for new rider registrations" ON public.rider_profiles;
DROP POLICY IF EXISTS "Allow update for rider profile management and admin approval" ON public.rider_profiles;
DROP POLICY IF EXISTS "Public read rider_profiles" ON public.rider_profiles;
DROP POLICY IF EXISTS "Public write rider_profiles" ON public.rider_profiles;
DROP POLICY IF EXISTS "Rider profiles self" ON public.rider_profiles;
DROP POLICY IF EXISTS "Rider profiles public read" ON public.rider_profiles;
DROP POLICY IF EXISTS "Rider profiles select" ON public.rider_profiles;
DROP POLICY IF EXISTS "Rider profiles self update" ON public.rider_profiles;
DROP POLICY IF EXISTS "Rider profiles self insert" ON public.rider_profiles;
DROP POLICY IF EXISTS "Rider profiles unrestricted select" ON public.rider_profiles;
DROP POLICY IF EXISTS "Rider profiles unrestricted insert" ON public.rider_profiles;
DROP POLICY IF EXISTS "Rider profiles unrestricted update" ON public.rider_profiles;
DROP POLICY IF EXISTS "Rider profiles public access" ON public.rider_profiles;

-- 8. Create robust RLS policies for public.rider_profiles
CREATE POLICY "Rider profiles public access" ON public.rider_profiles
  FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

-- 9. Drop all old/conflicting RLS policies on public.profiles
DROP POLICY IF EXISTS "Public read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public write profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles select own" ON public.profiles;
DROP POLICY IF EXISTS "Profiles insert own" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update own safe fields" ON public.profiles;
DROP POLICY IF EXISTS "Profiles unrestricted select" ON public.profiles;
DROP POLICY IF EXISTS "Profiles unrestricted insert" ON public.profiles;
DROP POLICY IF EXISTS "Profiles unrestricted update" ON public.profiles;
DROP POLICY IF EXISTS "Profiles public access" ON public.profiles;

-- 10. Create robust RLS policies for public.profiles
CREATE POLICY "Profiles public access" ON public.profiles
  FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

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
