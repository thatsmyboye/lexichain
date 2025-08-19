import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown } from "lucide-react";
import { CONSUMABLES, RARITY_COLORS, type ConsumableId } from "@/lib/consumables";
import type { ConsumableInventory } from "@/hooks/useConsumables";

interface ConsumableInventoryProps {
  inventory: ConsumableInventory;
  onUseConsumable: (id: ConsumableId) => void;
  gameMode: string;
  disabled?: boolean;
}

export function ConsumableInventoryPanel({ 
  inventory, 
  onUseConsumable, 
  gameMode,
  disabled = false 
}: ConsumableInventoryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const availableConsumables = Object.entries(inventory).filter(([_, data]) => data.quantity > 0);

  if (availableConsumables.length === 0) {
    return null;
  }

  return (
    <Card className="p-3 bg-card">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-muted-foreground font-medium">Consumables</div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setIsExpanded(!isExpanded)}
          className="h-6 w-6 p-0"
        >
          <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </Button>
      </div>
      
      {isExpanded && (
        <div className="grid grid-cols-2 gap-2">
          {availableConsumables.map(([id, data]) => {
            const consumable = CONSUMABLES[id as ConsumableId];
            const canUse = !disabled && 
              (!consumable.dailyModeOnly || gameMode === "daily") &&
              data.quantity > 0;

            return (
              <Button
                key={id}
                variant="outline"
                size="sm"
                className={`h-16 p-2 flex flex-col items-center gap-1 relative ${RARITY_COLORS[consumable.rarity]}`}
                onClick={() => canUse && onUseConsumable(id as ConsumableId)}
                disabled={!canUse}
              >
                <div className="text-lg leading-none">{consumable.icon}</div>
                <div className="text-xs text-center leading-tight">{consumable.name}</div>
                
                <Badge 
                  variant="secondary" 
                  className="absolute -top-1 -right-1 h-5 w-5 text-xs p-0 flex items-center justify-center"
                >
                  {data.quantity}
                </Badge>
              </Button>
            );
          })}
        </div>
      )}
    </Card>
  );
}

interface QuickUseBarProps {
  inventory: ConsumableInventory;
  onUseConsumable: (id: ConsumableId) => void;
  gameMode: string;
  gameState?: any;
  disabled?: boolean;
}

export function QuickUseBar({ 
  inventory, 
  onUseConsumable, 
  gameMode, 
  gameState,
  disabled = false 
}: QuickUseBarProps) {
  // Get relevant consumables based on game state
  const getRelevantConsumables = (): ConsumableId[] => {
    const relevant: ConsumableId[] = [];
    
    // Always show hint revealer and hammer if available
    if (inventory["hint_revealer"]?.quantity > 0) {
      relevant.push("hint_revealer");
    }
    if (inventory["hammer"]?.quantity > 0) {
      relevant.push("hammer");
    }
    
    // Show score multiplier if player is doing well
    if (inventory["score_multiplier"]?.quantity > 0) {
      relevant.push("score_multiplier");
    }
    
    // Show extra moves in daily mode when moves are running low
    if (gameMode === "daily" && inventory["extra_moves"]?.quantity > 0) {
      relevant.push("extra_moves");
    }
    
    return relevant.slice(0, 4);
  };

  const relevantConsumables = getRelevantConsumables();

  if (relevantConsumables.length === 0) {
    return null;
  }

  return (
    <div className="flex gap-2 justify-center mb-3">
      {relevantConsumables.map(id => {
        const consumable = CONSUMABLES[id];
        const data = inventory[id];
        const canUse = !disabled && 
          (!consumable.dailyModeOnly || gameMode === "daily") &&
          data && data.quantity > 0;

        return (
          <Button
            key={id}
            variant="outline"
            size="sm"
            className={`relative h-12 w-12 p-0 ${RARITY_COLORS[consumable.rarity]}`}
            onClick={() => canUse && onUseConsumable(id)}
            disabled={!canUse}
            title={`${consumable.name}: ${consumable.description}`}
          >
            <div className="text-lg">{consumable.icon}</div>
            {data && data.quantity > 0 && (
              <Badge className="absolute -top-1 -right-1 h-5 w-5 text-xs p-0 flex items-center justify-center">
                {data.quantity}
              </Badge>
            )}
          </Button>
        );
      })}
    </div>
  );
}