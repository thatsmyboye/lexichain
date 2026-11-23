import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

export function useIsAdmin(user: User | null) {
  const userId = user?.id ?? null;
  // The answer is stored with the user it belongs to. A check for one user
  // must never be read as the answer for another, and "not checked yet" must
  // never be read as "not an admin".
  const [checked, setChecked] = useState<{ userId: string; isAdmin: boolean } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const checkAdminStatus = async () => {
      let isAdmin = false;
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .eq('role', 'admin')
          .maybeSingle();

        isAdmin = !error && !!data;
      } catch (error) {
        console.error('Error checking admin status:', error);
      }
      if (!cancelled) setChecked({ userId, isAdmin });
    };

    checkAdminStatus();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const answered = userId !== null && checked?.userId === userId;

  return {
    isAdmin: answered && checked.isAdmin,
    // Loading from the moment a user is known until their check comes back.
    isLoading: userId !== null && !answered,
  };
}
