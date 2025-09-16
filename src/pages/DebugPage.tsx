import { DailyChallengeDebug } from "@/components/debug/DailyChallengeDebug";
import { WordValidationDebug } from "@/components/debug/WordValidationDebug";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function DebugPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4">
      <div className="container mx-auto py-8 space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Debug Tools</h1>
          <p className="text-muted-foreground">
            Debug and monitor game functionality
          </p>
        </div>
        
        <WordValidationDebug />
        
        <DailyChallengeDebug />
        
        <div className="text-center mt-8">
          <Button variant="secondary" onClick={() => navigate("/")}>
            🏠 Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}