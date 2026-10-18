import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { syncRemoteBests } from "@/lib/personalBests";
import { syncRemoteTrophies } from "@/lib/trophies";

// When a player signs in, merge their saved results into the local personal
// bests and trophy case so both follow them across devices.
export function AccountSync() {
  useEffect(() => {
    const synced = new Set<string>();
    const sync = (userId: string | undefined) => {
      if (!userId || synced.has(userId)) return;
      synced.add(userId);
      syncRemoteBests(userId);
      syncRemoteTrophies(userId);
    };
    supabase.auth.getSession().then(({ data: { session } }) => sync(session?.user?.id));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => sync(session?.user?.id));
    return () => subscription.unsubscribe();
  }, []);
  return null;
}
