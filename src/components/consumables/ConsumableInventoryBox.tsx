import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShoppingCart, Plus } from "lucide-react";
import { useState } from "react";
import { ConsumableStore } from "@/components/store/ConsumableStore";
import { CONSUMABLES } from "@/lib/consumables";
import type { ConsumableInventory } from "@/hooks/useConsumables";
import type { User } from "@supabase/supabase-js";

interface ConsumableInventoryBoxProps {
  inventory: ConsumableInventory;
  user: User | null;
}

export function ConsumableInventoryBox({ inventory, user }: ConsumableInventoryBoxProps) {
  const [showStore, setShowStore] = useState(false);

  const consumableTypes = ['hint_revealer', 'score_multiplier', 'hammer', 'extra_moves'] as const;

  return (
    <>
      <Card className="p-4 bg-card/90 backdrop-blur-sm border-muted/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Inventory</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowStore(true)}
            className="h-7 px-2 text-xs hover:bg-primary/10"
          >
            <Plus className="h-3 w-3 mr-1" />
            Buy More
          </Button>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          {consumableTypes.map((consumableId) => {
            const consumable = CONSUMABLES[consumableId];
            const quantity = inventory[consumableId]?.quantity || 0;
            
            return (
              <div
                key={consumableId}
                className="flex items-center justify-between p-2 rounded-md bg-muted/30 border border-muted/40"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg" title={consumable.name}>
                    {consumable.icon}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {consumable.name.split(' ')[0]}
                  </span>
                </div>
                <span className={`text-xs font-medium tabular-nums ${
                  quantity > 0 ? 'text-foreground' : 'text-muted-foreground'
                }`}>
                  {quantity}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      <Dialog open={showStore} onOpenChange={setShowStore}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Consumable Store</DialogTitle>
          </DialogHeader>
          <ConsumableStore 
            user={user}
            onPurchaseComplete={() => {
              setShowStore(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}