import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

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
                  <div className="flex items-center gap-2">
                    <div aria-hidden="true" className="w-8 h-8 rounded bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white text-xs font-bold">
                      A
                    </div>
                    <div className="text-xs">
                      <div className="font-medium">Stone</div>
                      <div className="text-muted-foreground">Cannot be used</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div aria-hidden="true" className="w-8 h-8 rounded bg-gradient-to-br from-purple-400 via-pink-400 to-red-400 flex items-center justify-center text-white text-xs font-bold">
                      ?
                    </div>
                    <div className="text-xs">
                      <div className="font-medium">Wild</div>
                      <div className="text-muted-foreground">Any letter</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div aria-hidden="true" className="w-8 h-8 rounded bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white text-xs font-bold relative">
                      A
                      <div className="absolute top-0 left-0 w-1 h-1 bg-white/30 rounded-full"></div>
                      <div className="absolute top-0 right-0 w-1 h-1 bg-white/30 rounded-full"></div>
                      <div className="absolute bottom-0 left-0 w-1 h-1 bg-white/30 rounded-full"></div>
                      <div className="absolute bottom-0 right-0 w-1 h-1 bg-white/30 rounded-full"></div>
                    </div>
                    <div className="text-xs">
                      <div className="font-medium">X-Factor</div>
                      <div className="text-muted-foreground">Changes adjacent corner tiles</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div aria-hidden="true" className="w-8 h-8 rounded bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold relative">
                      A
                      <div className="absolute bottom-0 right-0 text-xs font-bold bg-white/20 px-0.5 rounded text-[10px]">
                        2x
                      </div>
                    </div>
                    <div className="text-xs">
                      <div className="font-medium">Multiplier</div>
                      <div className="text-muted-foreground">Boost word score</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div aria-hidden="true" className="w-8 h-8 rounded bg-gradient-to-br from-red-200 to-red-300 flex items-center justify-center text-red-800 text-xs font-bold relative">
                      A
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="relative">
                          <div className="w-3 h-3 border border-red-700 rounded-full opacity-70"></div>
                          <div className="absolute inset-0.5 w-2 h-2 border border-red-700 rounded-full opacity-50"></div>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs">
                      <div className="font-medium">Shuffle</div>
                      <div className="text-muted-foreground">Randomizes all unfrozen letters</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div aria-hidden="true" className="w-8 h-8 rounded bg-gradient-to-br from-cyan-300 to-blue-400 flex items-center justify-center text-white text-xs">
                      ❄️
                    </div>
                    <div className="text-xs">
                      <div className="font-medium">Freeze</div>
                      <div className="text-muted-foreground">Locks neighbors in place</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div aria-hidden="true" className="w-8 h-8 rounded bg-gradient-to-br from-yellow-300 to-green-500 flex items-center justify-center text-white text-xs">
                      🦠
                    </div>
                    <div className="text-xs">
                      <div className="font-medium">Decay</div>
                      <div className="text-muted-foreground">Spreads, degrades letters</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div aria-hidden="true" className="w-8 h-8 rounded bg-gradient-to-br from-gray-200 to-gray-400 flex items-center justify-center text-gray-800 text-xs">
                      🪞
                    </div>
                    <div className="text-xs">
                      <div className="font-medium">Mirror</div>
                      <div className="text-muted-foreground">Copies previous letter</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div aria-hidden="true" className="w-8 h-8 rounded bg-gradient-to-br from-red-400 to-gray-400 flex items-center justify-center text-white text-xs">
                      🧲
                    </div>
                    <div className="text-xs">
                      <div className="font-medium">Magnet</div>
                      <div className="text-muted-foreground">Pulls vowels nearby</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div aria-hidden="true" className="w-8 h-8 rounded bg-gradient-to-br from-red-600 to-gray-900 flex items-center justify-center text-white text-xs">
                      💣
                    </div>
                    <div className="text-xs">
                      <div className="font-medium">Bomb</div>
                      <div className="text-muted-foreground">Blasts nearby tiles</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div aria-hidden="true" className="w-8 h-8 rounded bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white text-xs">
                      ⛓️
                    </div>
                    <div className="text-xs">
                      <div className="font-medium">Chain</div>
                      <div className="text-muted-foreground">Bonus for long words</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div aria-hidden="true" className="w-8 h-8 rounded bg-gradient-to-br from-white/60 to-gray-200/60 flex items-center justify-center text-gray-400 text-xs opacity-70">
                      👻
                    </div>
                    <div className="text-xs">
                      <div className="font-medium">Ghost</div>
                      <div className="text-muted-foreground">Bridge tile, no letter</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div aria-hidden="true" className="w-8 h-8 rounded bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-white text-xs">
                      💰
                    </div>
                    <div className="text-xs">
                      <div className="font-medium">Tax</div>
                      <div className="text-muted-foreground">-30% word score</div>
                    </div>
                  </div>
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
