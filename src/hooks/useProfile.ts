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
        .maybeSingle();

      if (error) {
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
    if (!user) {
      console.error('No user found for display name update');
      return false;
    }

    console.log('Attempting to update display name:', displayName);

    // Validate display name before saving
    const validation = validateDisplayName(displayName);
    console.log('Validation result:', validation);
    
    if (!validation.isValid) {
      console.log('Validation failed:', validation.error);
      toast({
        title: "Invalid Display Name",
        description: validation.error,
        variant: "destructive",
      });
      return false;
    }

    setLoading(true);
    try {
      // Use upsert with proper conflict resolution
      const upsertData = {
        user_id: user.id,
        display_name: displayName.trim(),
      };
      
      console.log('Upserting profile data:', upsertData);

      const { data, error } = await supabase
        .from('profiles')
        .upsert(upsertData, {
          onConflict: 'user_id'
        })
        .select()
        .maybeSingle();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Profile updated successfully:', data);
      setProfile(data);
      toast({
        title: "Success",
        description: "Display name updated successfully",
      });
      return true;
    } catch (error: any) {
      console.error('Error updating display name:', error);
      const errorMessage = error.message || error.details || 'Unknown database error';
      toast({
        title: "Error",
        description: `Failed to update display name: ${errorMessage}`,
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