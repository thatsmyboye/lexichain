import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from '@supabase/supabase-js';

interface TitleScreenProps {
  onPlayClick: () => void;
  onLoginClick: () => void;
  onRegisterClick: () => void;
  onStatsClick: () => void;
}

const TitleScreen = ({ onPlayClick, onLoginClick, onRegisterClick, onStatsClick }: TitleScreenProps) => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-muted relative">
      <div className="text-center space-y-8">
        <h1 className="text-6xl md:text-8xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-400))] to-[hsl(var(--brand-600))]">
          Lexichain
        </h1>
        
        <div className="flex items-center justify-center gap-4">
          <Button 
            variant="outline" 
            size="lg"
            onClick={onLoginClick}
            className={`px-8 ${user ? 'bg-gray-500/20 border-gray-500/30 text-muted-foreground cursor-not-allowed' : ''}`}
            disabled={!!user}
          >
            {user ? 'Logged In' : 'Login'}
          </Button>
          <Button 
            variant="hero" 
            size="lg"
            onClick={onPlayClick}
            className="px-8"
          >
            Play
          </Button>
        </div>
        
        {user && (
          <div className="flex justify-center mt-4">
            <Button 
              variant="outline" 
              size="lg"
              onClick={onStatsClick}
              className="px-8"
            >
              Stats
            </Button>
          </div>
        )}
        
        <div className="text-center">
          <button 
            onClick={onRegisterClick}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
          >
            Register
          </button>
        </div>
      </div>
      
      {/* Version and Copyright footer */}
      <footer className="absolute bottom-6 text-center text-xs text-muted-foreground space-y-1">
        <div>v08.18.2025-001</div>
        <div>© {new Date().getFullYear()} Banton Games. All rights reserved.</div>
      </footer>
    </div>
  );
};

export default TitleScreen;