import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Home, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const [isVerifying, setIsVerifying] = useState(true);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const { toast } = useToast();

  const sessionId = searchParams.get("session_id");
  const consumable = searchParams.get("consumable");
  const userId = searchParams.get("user_id");

  useEffect(() => {
    document.title = "Payment Successful - Word Game";
    
    if (sessionId) {
      verifyPayment();
    } else {
      setIsVerifying(false);
    }
  }, [sessionId]);

  const verifyPayment = async () => {
    try {
      console.log("Verifying payment for session:", sessionId);
      
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: { sessionId }
      });

      if (error) throw error;

      setVerificationResult(data);
      
      if (data.success) {
        toast({
          title: "Purchase successful!",
          description: userId && userId !== 'guest' 
            ? "Your consumables have been added to your inventory"
            : "Payment completed successfully",
        });
      }
    } catch (error: any) {
      console.error("Payment verification error:", error);
      toast({
        title: "Verification failed",
        description: error.message || "Unable to verify payment",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const getConsumableName = (id: string) => {
    return id?.replace(/_/g, ' ').split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ') || 'Unknown Item';
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 text-center space-y-6">
        {isVerifying ? (
          <>
            <div className="flex justify-center">
              <RefreshCw className="h-12 w-12 text-primary animate-spin" />
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-2">Verifying Payment</h1>
              <p className="text-muted-foreground">
                Please wait while we confirm your purchase...
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-center">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-green-600">Payment Successful!</h1>
              <p className="text-muted-foreground">
                Thank you for your purchase
              </p>
            </div>

            {consumable && (
              <div className="bg-muted p-4 rounded-lg">
                <h3 className="font-semibold mb-1">Purchased Item</h3>
                <p className="text-sm text-muted-foreground">
                  {getConsumableName(consumable)}
                </p>
              </div>
            )}

            {verificationResult?.success && userId && userId !== 'guest' && (
              <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-700 dark:text-green-300">
                  ✅ Your consumables have been added to your inventory and are ready to use!
                </p>
              </div>
            )}

            {(!userId || userId === 'guest') && (
              <div className="bg-yellow-50 dark:bg-yellow-950 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  ⚠️ Guest purchase complete. To save items to your account, please sign in.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Button asChild className="w-full">
                <Link to="/" className="flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  Return to Game
                </Link>
              </Button>
              
              {(!userId || userId === 'guest') && (
                <Button variant="outline" asChild className="w-full">
                  <Link to="/auth">
                    Sign In to Save Items
                  </Link>
                </Button>
              )}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}