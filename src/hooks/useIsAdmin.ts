import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'paul.t.boye@gmail.com';

export function useIsAdmin(user: User | null) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setIsLoading(false);
      return;
    }

    const checkAdminStatus = async () => {
      try {
        // Check if user email matches the exclusive admin email
        const userEmail = user.email?.toLowerCase().trim();
        const isAdminUser = userEmail === ADMIN_EMAIL.toLowerCase().trim();
        
        setIsAdmin(isAdminUser);
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAdminStatus();
  }, [user]);

  return { isAdmin, isLoading };
}
