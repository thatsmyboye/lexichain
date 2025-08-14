import { Button } from "@/components/ui/button";

interface TitleScreenProps {
  onPlayClick: () => void;
  onLoginClick: () => void;
  onRegisterClick: () => void;
}

const TitleScreen = ({ onPlayClick, onLoginClick, onRegisterClick }: TitleScreenProps) => {

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
            className="px-8"
          >
            Login
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
        
        <div className="text-center">
          <button 
            onClick={onRegisterClick}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
          >
            Register
          </button>
        </div>
      </div>
      
      {/* Copyright footer */}
      <footer className="absolute bottom-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Banton Games. All rights reserved.
      </footer>
    </div>
  );
};

export default TitleScreen;