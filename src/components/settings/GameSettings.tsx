import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTheme } from 'next-themes';
import { getFontSize, setFontSize as persistFontSize, type FontSize } from '@/lib/appearance';
import { Settings, Accessibility, Volume2, Palette } from 'lucide-react';
import { SoundSettings } from '@/components/effects/SoundSystem';
import { ColorBlindSettings, HighContrastToggle } from '@/components/accessibility/ColorBlindSupport';
import { useSound } from '@/components/effects/SoundSystem';
import { TileSkinSelector } from '@/components/settings/TileSkinSelector';
import { useIsMobile } from '@/hooks/use-mobile';
import { FLOATING_TILES_CHANGE_EVENT } from '@/components/effects/FloatingTiles';

// Inactive tab text sits on bg-muted; text-muted-foreground there is below 4.5:1.
const TAB_TRIGGER_CLASS = 'flex items-center gap-2 text-foreground/80';

export function GameSettings() {
  const [activeTab, setActiveTab] = useState('general');
  const isMobile = useIsMobile();
  const [floatingTiles, setFloatingTiles] = useState(() => {
    return localStorage.getItem('lexichain-floating-tiles') !== 'false';
  });
  const [enhancedPowerups, setEnhancedPowerups] = useState(() => {
    return localStorage.getItem('lexichain-enhanced-powerups') === 'true';
  });

  const handleEnhancedPowerupsToggle = (checked: boolean) => {
    setEnhancedPowerups(checked);
    localStorage.setItem('lexichain-enhanced-powerups', checked ? 'true' : 'false');
  };

  const handleFloatingTilesToggle = (checked: boolean) => {
    setFloatingTiles(checked);
    localStorage.setItem('lexichain-floating-tiles', checked ? 'true' : 'false');
    window.dispatchEvent(new Event(FLOATING_TILES_CHANGE_EVENT));
  };

  const { theme, setTheme } = useTheme();
  const [fontSize, setFontSizeState] = useState<FontSize>(() => getFontSize());
  const handleFontSizeChange = (value: FontSize) => {
    setFontSizeState(value);
    persistFontSize(value);
  };
  const {
    playSound
  } = useSound();
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    playSound('button_click');
  };
  return <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <h1 className="flex items-center gap-2 text-2xl font-semibold leading-none tracking-tight">
          <Settings className="h-5 w-5" aria-hidden="true" />
          Game Settings
        </h1>
        <CardDescription>
          Customize your Lexichain experience
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general" aria-label="General" className={TAB_TRIGGER_CLASS}>
              <Settings className="h-4 w-4" aria-hidden="true" />
              <span className={isMobile ? 'sr-only' : undefined}>General</span>
            </TabsTrigger>
            <TabsTrigger value="accessibility" aria-label="Accessibility" className={TAB_TRIGGER_CLASS}>
              <Accessibility className="h-4 w-4" aria-hidden="true" />
              <span className={isMobile ? 'sr-only' : undefined}>Accessibility</span>
            </TabsTrigger>
            <TabsTrigger value="audio" aria-label="Audio" className={TAB_TRIGGER_CLASS}>
              <Volume2 className="h-4 w-4" aria-hidden="true" />
              <span className={isMobile ? 'sr-only' : undefined}>Audio</span>
            </TabsTrigger>
            <TabsTrigger value="appearance" aria-label="Appearance" className={TAB_TRIGGER_CLASS}>
              <Palette className="h-4 w-4" aria-hidden="true" />
              <span className={isMobile ? 'sr-only' : undefined}>Appearance</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">General Settings</h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <label htmlFor="setting-enhanced-powerups" className="text-sm font-medium">Enhanced Powerups</label>
                    <p id="setting-enhanced-powerups-desc" className="text-xs text-muted-foreground">
                      Adds 8 new tile types: Freeze, Decay, Mirror, Magnet, Bomb, Chain, Ghost, and Tax. Does not apply to Daily Challenge.
                    </p>
                  </div>
                  <Switch
                    id="setting-enhanced-powerups"
                    checked={enhancedPowerups}
                    onCheckedChange={handleEnhancedPowerupsToggle}
                    aria-describedby="setting-enhanced-powerups-desc"
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="accessibility" className="space-y-6">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Accessibility Settings</h2>

              <div className="space-y-6">
                <ColorBlindSettings />

                <Separator />

                <HighContrastToggle />

                <Separator />

                <div className="space-y-4">
                  <h3 className="font-medium">Keyboard Navigation</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Tab moves between buttons and controls</li>
                    <li>• Arrow keys move focus between board tiles</li>
                    <li>• Enter or Space selects the focused tile</li>
                    <li>• Type letters to build a path on the board</li>
                    <li>• Enter submits the current word</li>
                    <li>• Backspace removes the last letter</li>
                    <li>• Escape clears the current path</li>
                  </ul>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="audio" className="space-y-6">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Audio Settings</h2>
              <SoundSettings />
            </div>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-6">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Appearance Settings</h2>

              <div className="space-y-6">
                <TileSkinSelector />

                <Separator />

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <label htmlFor="setting-floating-tiles" className="text-sm font-medium">Floating Tiles Background</label>
                    <p id="setting-floating-tiles-desc" className="text-xs text-muted-foreground">
                      Animated letter tiles drifting behind menus. Always off when your device requests reduced motion.
                    </p>
                  </div>
                  <Switch
                    id="setting-floating-tiles"
                    checked={floatingTiles}
                    onCheckedChange={handleFloatingTilesToggle}
                    aria-describedby="setting-floating-tiles-desc"
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <label htmlFor="setting-theme" className="text-sm font-medium">Theme</label>
                  <Select value={theme} onValueChange={setTheme}>
                    <SelectTrigger id="setting-theme" className="w-full">
                      <SelectValue placeholder="Select theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="space-y-2">
                  <label htmlFor="setting-font-size" className="text-sm font-medium">Font Size</label>
                  <Select value={fontSize} onValueChange={(v) => handleFontSizeChange(v as FontSize)}>
                    <SelectTrigger id="setting-font-size" className="w-full">
                      <SelectValue placeholder="Select font size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                      <SelectItem value="extra-large">Extra Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>;
}
