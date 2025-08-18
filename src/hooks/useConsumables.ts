import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@supabase/supabase-js";
import type { ConsumableId, ConsumableReward, ActiveEffect } from "@/lib/consumables";

export type ConsumableInventory = Record<ConsumableId, {
  quantity: number;
  lastUsed?: Date;
  cooldownUntil?: Date;
}>;

export function useConsumables(user: User | null) {
  const [inventory, setInventory] = useState<ConsumableInventory>({
    hint_revealer: { quantity: 0 },
    score_multiplier: { quantity: 0 },
    letter_shuffle: { quantity: 0 },
    extra_moves: { quantity: 0 }
  });
  const [activeEffects, setActiveEffects] = useState<ActiveEffect[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchInventory = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('user_consumables')
        .select('*')
        .eq('user_id', user.id);
        
      if (error) {
        console.error('Error fetching consumables:', error);
        return;
      }

      const inventoryMap = data?.reduce((acc, item) => {
        acc[item.consumable_id as ConsumableId] = {
          quantity: item.quantity,
          lastUsed: item.last_used ? new Date(item.last_used) : undefined
        };
        return acc;
      }, {
        hint_revealer: { quantity: 0 },
        score_multiplier: { quantity: 0 },
        letter_shuffle: { quantity: 0 },
        extra_moves: { quantity: 0 }
      } as ConsumableInventory) || {
        hint_revealer: { quantity: 0 },
        score_multiplier: { quantity: 0 },
        letter_shuffle: { quantity: 0 },
        extra_moves: { quantity: 0 }
      };
      
      setInventory(inventoryMap);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const useConsumable = async (consumableId: ConsumableId, gameResultId?: string): Promise<boolean> => {
    if (!user || !inventory[consumableId] || inventory[consumableId].quantity <= 0) {
      return false;
    }

    try {
      // Record usage transaction
      const { error: transactionError } = await supabase
        .from('consumable_transactions')
        .insert({
          user_id: user.id,
          consumable_id: consumableId,
          transaction_type: 'used',
          quantity: 1,
          source: 'manual_use',
          game_result_id: gameResultId || null
        });

      if (transactionError) {
        console.error('Error recording transaction:', transactionError);
        return false;
      }

      // Update inventory
      const newQuantity = inventory[consumableId].quantity - 1;
      const { error: inventoryError } = await supabase
        .from('user_consumables')
        .upsert({
          user_id: user.id,
          consumable_id: consumableId,
          quantity: newQuantity,
          last_used: new Date().toISOString()
        });

      if (inventoryError) {
        console.error('Error updating inventory:', inventoryError);
        return false;
      }

      // Update local state
      setInventory(prev => ({
        ...prev,
        [consumableId]: {
          ...prev[consumableId],
          quantity: newQuantity,
          lastUsed: new Date()
        }
      }));

      return true;
    } catch (error) {
      console.error('Error using consumable:', error);
      return false;
    }
  };

  const awardConsumables = async (rewards: ConsumableReward[], source: string, gameResultId?: string) => {
    if (!user || rewards.length === 0) return;

    try {
      // Record earning transactions
      const transactions = rewards.map(reward => ({
        user_id: user.id,
        consumable_id: reward.id,
        transaction_type: 'earned' as const,
        quantity: reward.quantity,
        source,
        game_result_id: gameResultId || null
      }));

      const { error: transactionError } = await supabase
        .from('consumable_transactions')
        .insert(transactions);

      if (transactionError) {
        console.error('Error recording reward transactions:', transactionError);
        return;
      }
      
      // Update inventory for each reward
      for (const reward of rewards) {
        const currentQuantity = inventory[reward.id]?.quantity || 0;
        const { error: inventoryError } = await supabase
          .from('user_consumables')
          .upsert({
            user_id: user.id,
            consumable_id: reward.id,
            quantity: currentQuantity + reward.quantity
          });

        if (inventoryError) {
          console.error(`Error updating inventory for ${reward.id}:`, inventoryError);
        }
      }

      await fetchInventory();
      
      // Show toast notification
      const totalItems = rewards.reduce((sum, r) => sum + r.quantity, 0);
      toast({
        title: "Consumables Earned!",
        description: `You earned ${totalItems} consumable${totalItems > 1 ? 's' : ''}!`
      });
      
    } catch (error) {
      console.error('Error awarding consumables:', error);
    }
  };

  const addActiveEffect = (effect: ActiveEffect) => {
    setActiveEffects(prev => [...prev.filter(e => e.id !== effect.id), effect]);
  };

  const removeActiveEffect = (consumableId: ConsumableId) => {
    setActiveEffects(prev => prev.filter(e => e.id !== consumableId));
  };

  const clearAllEffects = () => {
    setActiveEffects([]);
  };

  useEffect(() => {
    fetchInventory();
  }, [user]);

  return {
    inventory,
    activeEffects,
    loading,
    useConsumable,
    awardConsumables,
    addActiveEffect,
    removeActiveEffect,
    clearAllEffects,
    refreshInventory: fetchInventory
  };
}