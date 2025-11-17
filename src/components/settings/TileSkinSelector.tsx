import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TILE_SKINS, TileSkinId } from '@/lib/tileSkins';
import { useTileSkin } from '@/hooks/useTileSkin';
import { useSound } from '@/components/effects/SoundSystem';
import { cn } from '@/lib/utils';

export function TileSkinSelector() {
  const { skinId, changeSkin } = useTileSkin();
  const { playSound } = useSound();

  const handleSkinChange = (newSkinId: TileSkinId) => {
    changeSkin(newSkinId);
    playSound('button_click');
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium mb-2">Tile Grid Skin</h4>
        <p className="text-xs text-muted-foreground mb-4">
          Customize the appearance of game tiles. Colors change based on your score achievements.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Object.values(TILE_SKINS).map((skin) => {
          const isSelected = skinId === skin.id;
          
          return (
            <Card
              key={skin.id}
              className={cn(
                'cursor-pointer transition-all duration-200 hover:shadow-md',
                isSelected && 'ring-2 ring-primary shadow-lg'
              )}
              onClick={() => handleSkinChange(skin.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {/* Preview Box */}
                  <div className={cn(
                    'w-16 h-16 rounded-lg border-2 flex items-center justify-center flex-shrink-0',
                    skin.baseClasses,
                    isSelected ? skin.selectedClasses : '',
                    isSelected ? skin.benchmarkColors.gold.border : 'border-border'
                  )}>
                    <span className="text-2xl font-semibold">A</span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <CardTitle className="text-base font-semibold">
                        {skin.name}
                      </CardTitle>
                      {isSelected && (
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <CardDescription className="text-xs">
                      {skin.description}
                    </CardDescription>
                    
                    {/* Benchmark Color Preview */}
                    <div className="flex gap-1 mt-2">
                      <div className={cn(
                        'w-4 h-4 rounded border',
                        skin.benchmarkColors.bronze.border,
                        skin.benchmarkColors.bronze.background
                      )} title="Bronze" />
                      <div className={cn(
                        'w-4 h-4 rounded border',
                        skin.benchmarkColors.silver.border,
                        skin.benchmarkColors.silver.background
                      )} title="Silver" />
                      <div className={cn(
                        'w-4 h-4 rounded border',
                        skin.benchmarkColors.gold.border,
                        skin.benchmarkColors.gold.background
                      )} title="Gold" />
                      <div className={cn(
                        'w-4 h-4 rounded border',
                        skin.benchmarkColors.platinum.border,
                        skin.benchmarkColors.platinum.background
                      )} title="Platinum" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

