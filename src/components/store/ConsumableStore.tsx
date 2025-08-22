import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart, User, UserPlus, Star, Zap, Sparkles } from "lucide-react";
import { CONSUMABLES, RARITY_COLORS, type ConsumableId } from "@/lib/consumables";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { User as SupabaseUser } from "@supabase/supabase-js";

interface ConsumableStoreProps {
  user: SupabaseUser | null;
  onPurchaseComplete?: () => void;
}

interface StoreItem {
  name: string;
  price: number;
  description: string;
  icon: string;
  originalPrice?: number;
  isBundle?: boolean;
}

const STORE_ITEMS: Record<string, StoreItem> = {
  // Individual consumables - sold in packs
  hint_revealer: { name: "Hint Revealer Pack", price: 0.99, description: "3 Hint Revealers - Reveals hidden words", icon: "💡" },
  score_multiplier: { name: "Score Multiplier Pack", price: 0.99, description: "2 Score Multipliers - Doubles word score", icon: "⚡" },
  hammer: { name: "Hammer Pack", price: 0.99, description: "3 Hammers - Disables stone tiles", icon: "🔨" },
  extra_moves: { name: "Extra Moves", price: 0.99, description: "Adds 3 moves (Daily only)", icon: "🎯" },
  
  // Bundles
  bundle_starter: { 
    name: "Starter Bundle", 
    price: 1.99, 
    description: "5 Hints + 2 Hammers + 1 Multiplier", 
    icon: "📦",
    originalPrice: 2.81,
    isBundle: true
  },
  bundle_power: { 
    name: "Power Bundle", 
    price: 5.99, 
    description: "10 Hints + 5 Hammers + 3 Multipliers + 2 Extra Moves", 
    icon: "⚡",
    originalPrice: 8.43,
    isBundle: true
  },
  bundle_ultimate: { 
    name: "Ultimate Bundle", 
    price: 15.99, 
    description: "25 Hints + 15 Hammers + 10 Multipliers + 5 Extra Moves", 
    icon: "👑",
    originalPrice: 23.15,
    isBundle: true
  }
};

export function ConsumableStore({ user, onPurchaseComplete }: ConsumableStoreProps) {
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [guestEmail, setGuestEmail] = useState("");
  const [showGuestDialog, setShowGuestDialog] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handlePurchase = async (itemId: string) => {
    if (!user) {
      setSelectedItem(itemId);
      setShowAuthPrompt(true);
      return;
    }

    await processPurchase(itemId);
  };

  const handleGuestPurchase = async () => {
    if (!guestEmail || !selectedItem) return;
    
    setShowGuestDialog(false);
    await processPurchase(selectedItem, guestEmail);
  };

  const processPurchase = async (itemId: string, email?: string) => {
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: { 
          consumableId: itemId,
          guestEmail: email
        }
      });

      if (error) throw error;
      if (!data?.url) throw new Error("No checkout URL received");

      // Open Stripe checkout in new tab
      window.open(data.url, '_blank');
      
      toast({
        title: "Redirecting to checkout",
        description: "Complete your purchase in the new tab",
      });
    } catch (error: any) {
      console.error("Purchase error:", error);
      toast({
        title: "Purchase failed",
        description: error.message || "Unable to start checkout",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const proceedAsGuest = () => {
    setShowAuthPrompt(false);
    setShowGuestDialog(true);
  };

  const goToAuth = () => {
    setShowAuthPrompt(false);
    window.location.href = "/auth";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
          <ShoppingCart className="h-6 w-6" />
          Consumable Store
        </h2>
        <p className="text-muted-foreground">Enhance your gameplay with powerful consumables</p>
      </div>

      {/* Featured Bundles */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-yellow-500" />
          <h3 className="text-lg font-semibold">Featured Bundles</h3>
          <Badge variant="secondary">Best Value</Badge>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(STORE_ITEMS)
            .filter(([_, item]) => item.isBundle)
            .map(([id, item]) => (
              <Card key={id} className="p-4 border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-2xl">{item.icon}</div>
                    <div className="text-right">
                      <div className="text-sm line-through text-muted-foreground">
                        ${item.originalPrice?.toFixed(2)}
                      </div>
                      <div className="text-lg font-bold text-primary">
                        ${item.price.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold">{item.name}</h4>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  
                  <Button 
                    onClick={() => handlePurchase(id)}
                    disabled={isLoading}
                    className="w-full"
                  >
                    {isLoading ? "Processing..." : "Buy Bundle"}
                  </Button>
                </div>
              </Card>
            ))}
        </div>
      </div>

      <Separator />

      {/* Individual Consumables */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold">Individual Consumables</h3>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(STORE_ITEMS)
            .filter(([_, item]) => !item.isBundle)
            .map(([id, item]) => {
              const consumable = CONSUMABLES[id as ConsumableId];
              
              return (
                <Card key={id} className={`p-3 h-full ${consumable ? RARITY_COLORS[consumable.rarity] : ''}`}>
                  <div className="flex flex-col h-full">
                    <div className="text-center flex-1">
                      <div className="text-2xl mb-2">{item.icon}</div>
                      <h4 className="font-medium text-sm mb-1">{item.name}</h4>
                      <p className="text-xs text-muted-foreground mb-3">{item.description}</p>
                    </div>
                    
                    <div className="text-center mt-auto">
                      <div className="text-lg font-bold mb-2">${item.price.toFixed(2)}</div>
                      <Button 
                        size="sm" 
                        onClick={() => handlePurchase(id)}
                        disabled={isLoading}
                        className="w-full"
                      >
                        Buy
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
        </div>
      </div>

      {/* Authentication prompt dialog */}
      <AlertDialog open={showAuthPrompt} onOpenChange={setShowAuthPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Sign in to save your purchase
            </AlertDialogTitle>
            <AlertDialogDescription>
              To keep your consumables safe and accessible across devices, we recommend signing in. 
              You can also continue as a guest, but your items won't be saved to an account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={proceedAsGuest} className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Continue as Guest
            </AlertDialogCancel>
            <AlertDialogAction onClick={goToAuth} className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Sign In / Register
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Guest checkout dialog */}
      <Dialog open={showGuestDialog} onOpenChange={setShowGuestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Guest Checkout</DialogTitle>
            <DialogDescription>
              Enter your email to complete the purchase. Your receipt will be sent here.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="guest-email">Email Address</Label>
              <Input
                id="guest-email"
                type="email"
                placeholder="your.email@example.com"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
              />
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowGuestDialog(false)} className="flex-1">
                Cancel
              </Button>
              <Button 
                onClick={handleGuestPurchase} 
                disabled={!guestEmail || isLoading}
                className="flex-1"
              >
                {isLoading ? "Processing..." : "Continue to Payment"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}