import { Button } from "@/components/ui/button";

interface TitleScreenProps {
  onPlayClick: () => void;
  onLoginClick: () => void;
}

const TitleScreen = ({ onPlayClick, onLoginClick }: TitleScreenProps) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-muted">
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
      </div>
    </div>
  );
};

export default TitleScreen;