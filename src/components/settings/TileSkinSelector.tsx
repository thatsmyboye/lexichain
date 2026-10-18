import React, { useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription } from '@/components/ui/card';
import { getAvailableSkins, getSeasonEnd, TileSkinId } from '@/lib/tileSkins';
import { useTileSkin } from '@/hooks/useTileSkin';
import { useSound } from '@/components/effects/SoundSystem';
import { cn } from '@/lib/utils';

const endFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

export function TileSkinSelector() {
  const { skinId, changeSkin } = useTileSkin();
  // Permanent skins plus whichever seasonal sets are live today
  const SKINS = useMemo(() => getAvailableSkins(), []);
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
          Each skin restyles the tiles, board frame, trail and screen colors. Tile edges change color as your score reaches each medal.
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
          const seasonEnd = getSeasonEnd(skin);
          const limitedLabel = seasonEnd ? `Limited · ends ${endFormatter.format(seasonEnd)}` : null;

          return (
            <Card
              key={skin.id}
              ref={(el) => { optionRefs.current[index] = el; }}
              role="radio"
              aria-checked={isSelected}
              aria-label={`${skin.name}: ${skin.description}${limitedLabel ? `. ${limitedLabel.replace(' · ', ', ')}` : ''}`}
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
                  {/* Preview: a tile on the skin's own screen + frame colors */}
                  <div aria-hidden="true" className="skin-scene flex-shrink-0 rounded-xl p-2" data-skin-preview={skin.id}>
                    <div className={cn(
                      'relative w-14 h-14 rounded-lg border-2 flex items-center justify-center text-card-foreground',
                      skin.baseClasses,
                      isSelected ? skin.benchmarkColors.gold.border : 'border-border'
                    )}>
                      <span className={cn('tile-texture', skin.textureClass)} />
                      <span className="relative text-2xl font-semibold">A</span>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-base font-semibold leading-none tracking-tight">
                        {skin.name}
                      </span>
                      {isSelected && (
                        <div className="w-2 h-2 rounded-full bg-primary" aria-hidden="true" />
                      )}
                    </div>
                    {limitedLabel && (
                      <span className="mb-1 inline-flex items-center rounded-full border border-[hsl(var(--brand-500))] px-2 py-0.5 text-[11px] font-semibold leading-none text-foreground">
                        {limitedLabel}
                      </span>
                    )}
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
