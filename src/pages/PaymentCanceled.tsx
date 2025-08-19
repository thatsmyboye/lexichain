import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle, Home, ShoppingCart } from "lucide-react";

export default function PaymentCanceled() {
  useEffect(() => {
    document.title = "Payment Canceled - Word Game";
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 text-center space-y-6">
        <div className="flex justify-center">
          <XCircle className="h-12 w-12 text-orange-500" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-orange-600">Payment Canceled</h1>
          <p className="text-muted-foreground">
            Your payment was canceled. No charges were made to your account.
          </p>
        </div>

        <div className="bg-muted p-4 rounded-lg">
          <p className="text-sm text-muted-foreground">
            You can try again anytime. Your items will be waiting for you in the store!
          </p>
        </div>

        <div className="space-y-2">
          <Button asChild className="w-full">
            <Link to="/" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Return to Game
            </Link>
          </Button>
          
          <Button variant="outline" asChild className="w-full">
            <Link to="/store" className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Back to Store
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}