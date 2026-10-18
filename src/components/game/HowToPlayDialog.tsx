import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import type { SpecialTileType } from "@/types/game";
import { SpecialTileIcon } from "./SpecialTileIcon";

// Same fills, letter colors and border shapes as the board's special tiles
const SPECIAL_SWATCHES: Array<{
  type: NonNullable<SpecialTileType>;
  name: string;
  desc: string;
  shape: string;
  classes: string;
}> = [
  { type: "stone", name: "Stone", desc: "Cannot be used", shape: "rounded-none border-4 border-double border-gray-300", classes: "bg-gradient-to-br from-gray-500 to-gray-700 text-white" },
  { type: "wild", name: "Wild", desc: "Any letter", shape: "rounded border-2 border-dashed border-white/70", classes: "bg-gradient-to-br from-purple-500 via-pink-500 to-red-500 text-white" },
  { type: "xfactor", name: "X-Factor", desc: "Changes adjacent corner tiles", shape: "rounded border-2 border-orange-200/70", classes: "bg-gradient-to-br from-orange-500 to-red-600 text-white" },
  { type: "multiplier", name: "Multiplier", desc: "Boost word score", shape: "rounded border-2 border-blue-200/70", classes: "bg-gradient-to-br from-blue-500 to-blue-700 text-white" },
  { type: "shuffle", name: "Shuffle", desc: "Randomizes all unfrozen letters", shape: "rounded border-2 border-red-400/60", classes: "bg-gradient-to-br from-red-200 to-red-300 text-red-900" },
  { type: "freeze", name: "Freeze", desc: "Locks neighbors in place", shape: "rounded-sm border-2 border-dotted border-blue-500/70", classes: "bg-gradient-to-br from-cyan-200 to-blue-300 text-blue-950" },
  { type: "decay", name: "Decay", desc: "Spreads, degrades letters", shape: "rounded border-2 border-green-600/50", classes: "bg-gradient-to-br from-yellow-200 to-green-400 text-green-950" },
  { type: "mirror", name: "Mirror", desc: "Copies previous letter", shape: "rounded border-2 border-gray-500/50", classes: "bg-gradient-to-br from-gray-200 to-gray-400 text-gray-900" },
  { type: "magnet", name: "Magnet", desc: "Pulls vowels nearby", shape: "rounded border-2 border-red-300/60", classes: "bg-gradient-to-br from-red-500 to-gray-600 text-white" },
  { type: "bomb", name: "Bomb", desc: "Blasts nearby tiles", shape: "rounded-full border-2 border-red-300/60", classes: "bg-gradient-to-br from-red-600 to-gray-900 text-white" },
  { type: "chain", name: "Chain", desc: "Bonus for long words", shape: "rounded border-2 border-amber-300/60", classes: "bg-gradient-to-br from-amber-600 to-amber-800 text-white" },
  { type: "ghost", name: "Ghost", desc: "Bridge tile, no letter", shape: "rounded border-2 border-dashed border-gray-400", classes: "bg-gradient-to-br from-white to-gray-200 text-gray-700 dark:from-slate-700 dark:to-slate-800 dark:text-gray-200" },
  { type: "tax", name: "Tax", desc: "-30% word score", shape: "rounded border-2 border-yellow-600/50", classes: "bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-950" },
];

export function HowToPlayDialog({
  open,
  onOpenChange,
  mode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: string;
}) {
  return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] max-w-[425px] max-h-[90vh] overflow-y-auto sm:max-w-lg sm:max-h-[85vh] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>How to play</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {mode === "endless" ? (
              <>
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">(Almost) Endless Mode</h3>
                  <div className="flex items-start gap-2">
                    <span aria-hidden="true" className="text-muted-foreground mt-1">•</span>
                    <span className="text-sm">Drag through adjacent tiles (including diagonals), or tap tiles one at a time and press Submit (or tap the last tile again)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span aria-hidden="true" className="text-muted-foreground mt-1">•</span>
                    <span className="text-sm">Words must be 3+ letters and valid</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span aria-hidden="true" className="text-muted-foreground mt-1">•</span>
                    <span className="text-sm">Each word must reuse ≥1 tile from previous</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span aria-hidden="true" className="text-muted-foreground mt-1">•</span>
                    <span className="text-sm">When no words remain, a new board appears automatically</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span aria-hidden="true" className="text-muted-foreground mt-1">•</span>
                    <span className="text-sm">Difficulty increases with each new board</span>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Strategy Tips</h3>
                  <div className="flex items-start gap-2">
                    <span aria-hidden="true" className="text-muted-foreground mt-1">•</span>
                    <span className="text-sm">Your score accumulates across all boards - aim for high-scoring words</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span aria-hidden="true" className="text-muted-foreground mt-1">•</span>
                    <span className="text-sm">Plan ahead to maximize tile reuse and word chains</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span aria-hidden="true" className="text-muted-foreground mt-1">•</span>
                    <span className="text-sm">Special tiles become more common as difficulty increases</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span aria-hidden="true" className="text-muted-foreground mt-1">•</span>
                    <span className="text-sm">There's no time limit - take your time to find the best words</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span aria-hidden="true" className="text-muted-foreground mt-1">•</span>
                    <span className="text-sm">Try to clear each board completely before moving to the next</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <span aria-hidden="true" className="text-muted-foreground mt-1">•</span>
                  <span className="text-sm">Drag through adjacent tiles (including diagonals), or tap tiles one at a time and press Submit (or tap the last tile again)</span>
                </div>
                <div className="flex items-start gap-2">
                  <span aria-hidden="true" className="text-muted-foreground mt-1">•</span>
                  <span className="text-sm">Words must be 3+ letters and valid</span>
                </div>
                <div className="flex items-start gap-2">
                  <span aria-hidden="true" className="text-muted-foreground mt-1">•</span>
                  <span className="text-sm">Each word must reuse ≥1 tile from previous</span>
                </div>
                <div className="flex items-start gap-2">
                  <span aria-hidden="true" className="text-muted-foreground mt-1">•</span>
                  <span className="text-sm">Keep chaining until no valid word remains</span>
                </div>
                <div className="flex items-start gap-2">
                  <span aria-hidden="true" className="text-muted-foreground mt-1">•</span>
                  <span className="text-sm">Keyboard: type letters to trace a path, Enter to submit, Backspace to undo a letter, Esc to clear. Arrow keys move between tiles; Space selects</span>
                </div>
              </div>
            )}
            
            <Collapsible>
              <CollapsibleTrigger className="flex w-full items-center justify-between py-1 group">
                <h3 className="text-sm font-semibold text-foreground">Special Tiles</h3>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-y-3 gap-x-2 sm:grid-cols-3">
                  {SPECIAL_SWATCHES.map((swatch) => (
                    <div key={swatch.type} className="flex items-center gap-2">
                      <div aria-hidden="true" className={`relative w-8 h-8 flex-shrink-0 flex items-center justify-center ${swatch.shape} ${swatch.classes}`}>
                        <SpecialTileIcon type={swatch.type} className="h-4 w-4" />
                        {swatch.type === "multiplier" && (
                          <span className="absolute -bottom-1 -right-1 rounded bg-black/60 px-0.5 text-[9px] font-bold leading-tight text-white">2x</span>
                        )}
                        {swatch.type === "xfactor" && (
                          <>
                            <span className="absolute top-0.5 left-0.5 w-1 h-1 bg-white/80 rounded-full" />
                            <span className="absolute top-0.5 right-0.5 w-1 h-1 bg-white/80 rounded-full" />
                            <span className="absolute bottom-0.5 left-0.5 w-1 h-1 bg-white/80 rounded-full" />
                            <span className="absolute bottom-0.5 right-0.5 w-1 h-1 bg-white/80 rounded-full" />
                          </>
                        )}
                      </div>
                      <div className="text-xs">
                        <div className="font-medium">{swatch.name}</div>
                        <div className="text-muted-foreground">{swatch.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground">
                  Special tiles appear after forming your first valid word and expire after a few turns.
                </div>
              </CollapsibleContent>
            </Collapsible>
            
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Consumable Items</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <span aria-hidden="true" className="text-muted-foreground mt-1">•</span>
                  <span className="text-sm">Tap a consumable in your inventory to use it</span>
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center gap-2">
                    <span aria-hidden="true" className="text-lg">🔨</span>
                    <div className="text-xs">
                      <div className="font-medium">Hammer</div>
                      <div className="text-muted-foreground">Breaks every Stone tile on the board at once</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span aria-hidden="true" className="text-lg">💡</span>
                    <div className="text-xs">
                      <div className="font-medium">Hint Revealer</div>
                      <div className="text-muted-foreground">Highlights the path of one playable word for 5 seconds</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span aria-hidden="true" className="text-lg">⚡</span>
                    <div className="text-xs">
                      <div className="font-medium">Score Multiplier</div>
                      <div className="text-muted-foreground">Doubles the score of your next word</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span aria-hidden="true" className="text-lg">🎯</span>
                    <div className="text-xs">
                      <div className="font-medium">Extra Moves</div>
                      <div className="text-muted-foreground">Adds 3 extra moves (Daily Challenge only)</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
  );
}
