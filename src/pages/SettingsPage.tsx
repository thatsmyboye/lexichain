import { GameSettings } from '@/components/settings/GameSettings';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FloatingTiles } from '@/components/effects/FloatingTiles';

export default function SettingsPage() {
  const navigate = useNavigate();

  return (
    <div className="relative overflow-hidden min-h-screen bg-gradient-to-br from-background to-muted py-8 px-4">
      <FloatingTiles />
      <div className="relative z-10 container mx-auto max-w-4xl">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
        <GameSettings />
      </div>
    </div>
  );
}

