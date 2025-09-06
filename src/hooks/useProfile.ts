import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { validateDisplayName } from "@/lib/contentFilter";
import type { User } from "@supabase/supabase-js";

interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

export function useProfile(user: User | null) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Helper function to get display name or truncated email
  const getDisplayName = (profile: Profile | null, userEmail?: string) => {
    if (profile?.display_name) {
      return profile.display_name;
    }
    if (userEmail) {
      return userEmail.split('@')[0];
    }
    return 'Anonymous';
  };

  const fetchProfile = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        throw error;
      }

      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast({
        title: "Error",
        description: "Failed to load profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateDisplayName = async (displayName: string) => {
    if (!user) return false;

    // Validate display name before saving
    const validation = validateDisplayName(displayName);
    if (!validation.isValid) {
      toast({
        title: "Invalid Display Name",
        description: validation.error,
        variant: "destructive",
      });
      return false;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          display_name: displayName.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      setProfile(data);
      toast({
        title: "Success",
        description: "Display name updated successfully",
      });
      return true;
    } catch (error) {
      console.error('Error updating display name:', error);
      toast({
        title: "Error",
        description: "Failed to update display name",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [user]);

  return {
    profile,
    loading,
    getDisplayName: (userEmail?: string) => getDisplayName(profile, userEmail),
    updateDisplayName,
    refreshProfile: fetchProfile,
  };
}