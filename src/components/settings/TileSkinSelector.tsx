import React, { useRef } from 'react';
import { Card, CardContent, CardDescription } from '@/components/ui/card';
import { TILE_SKINS, TileSkinId } from '@/lib/tileSkins';
import { useTileSkin } from '@/hooks/useTileSkin';
import { useSound } from '@/components/effects/SoundSystem';
import { cn } from '@/lib/utils';

const SKINS = Object.values(TILE_SKINS);

export function TileSkinSelector() {
  const { skinId, changeSkin } = useTileSkin();
  const { playSound } = useSound();
  const optionRefs = useRef<Array<HTMLDivElement | null>>([]);

  const handleSkinChange = (newSkinId: TileSkinId) => {
    changeSkin(newSkinId);
    playSound('button_click');
  };

  // Radio group keyboard pattern: Enter/Space select, arrows move + select, Home/End jump.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, index: number) => {
    let nextIndex: number | null = null;
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        handleSkinChange(SKINS[index].id);
        return;
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (index + 1) % SKINS.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (index - 1 + SKINS.length) % SKINS.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = SKINS.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    optionRefs.current[nextIndex]?.focus();
    handleSkinChange(SKINS[nextIndex].id);
  };

  const selectedIndex = Math.max(0, SKINS.findIndex((skin) => skin.id === skinId));

  return (
    <div className="space-y-4">
      <div>
        <h3 id="tile-skin-heading" className="text-sm font-medium mb-2">Tile Grid Skin</h3>
        <p id="tile-skin-description" className="text-xs text-muted-foreground mb-4">
          Customize the appearance of game tiles. Colors change based on your score achievements.
        </p>
      </div>

      <div
        role="radiogroup"
        aria-labelledby="tile-skin-heading"
        aria-describedby="tile-skin-description"
        className="grid grid-cols-1 md:grid-cols-2 gap-3"
      >
        {SKINS.map((skin, index) => {
          const isSelected = skinId === skin.id;

          return (
            <Card
              key={skin.id}
              ref={(el) => { optionRefs.current[index] = el; }}
              role="radio"
              aria-checked={isSelected}
              aria-label={`${skin.name}: ${skin.description}`}
              tabIndex={index === selectedIndex ? 0 : -1}
              className={cn(
                'cursor-pointer transition-all duration-200 hover:shadow-md',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                isSelected && 'ring-2 ring-primary shadow-lg'
              )}
              onClick={() => handleSkinChange(skin.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {/* Preview Box */}
                  <div aria-hidden="true" className={cn(
                    'w-16 h-16 rounded-lg border-2 flex items-center justify-center flex-shrink-0',
                    skin.baseClasses,
                    isSelected ? skin.selectedClasses : '',
                    isSelected ? skin.benchmarkColors.gold.border : 'border-border'
                  )}>
                    <span className="text-2xl font-semibold">A</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-base font-semibold leading-none tracking-tight">
                        {skin.name}
                      </span>
                      {isSelected && (
                        <div className="w-2 h-2 rounded-full bg-primary" aria-hidden="true" />
                      )}
                    </div>
                    <CardDescription className="text-xs">
                      {skin.description}
                    </CardDescription>

                    {/* Benchmark Color Preview */}
                    <div className="flex gap-1 mt-2" aria-hidden="true">
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
