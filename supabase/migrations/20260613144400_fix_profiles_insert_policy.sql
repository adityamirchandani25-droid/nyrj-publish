-- Fix profiles INSERT policy so users cannot impersonate others by setting an arbitrary email.
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;

CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = id
    AND email = (auth.jwt() ->> 'email')
  );
