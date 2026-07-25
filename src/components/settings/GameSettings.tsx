import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTheme } from 'next-themes';
import { getFontSize, setFontSize as persistFontSize, type FontSize } from '@/lib/appearance';
import { Settings, Accessibility, Volume2, Palette, Zap } from 'lucide-react';
import { SoundSettings } from '@/components/effects/SoundSystem';
import { ColorBlindSettings, HighContrastToggle } from '@/components/accessibility/ColorBlindSupport';
import { useSound } from '@/components/effects/SoundSystem';
import { useColorBlind } from '@/components/accessibility/ColorBlindSupport';
import { TileSkinSelector } from '@/components/settings/TileSkinSelector';
import { useIsMobile } from '@/hooks/use-mobile';
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
  const {
    colorBlindType
  } = useColorBlind();
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    playSound('button_click');
  };
  return <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Game Settings
        </CardTitle>
        <CardDescription>
          Customize your Lexichain experience
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              {!isMobile && <span>General</span>}
            </TabsTrigger>
            <TabsTrigger value="accessibility" className="flex items-center gap-2">
              <Accessibility className="h-4 w-4" />
              {!isMobile && <span>Accessibility</span>}
            </TabsTrigger>
            <TabsTrigger value="audio" className="flex items-center gap-2">
              <Volume2 className="h-4 w-4" />
              {!isMobile && <span>Audio</span>}
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              {!isMobile && <span>Appearance</span>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">General Settings</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">Auto-save</label>
                    <p className="text-xs text-muted-foreground">
                      Automatically save your progress
                    </p>
                  </div>
                  <input type="checkbox" defaultChecked className="h-4 w-4 text-primary" />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">Notifications</label>
                    <p className="text-xs text-muted-foreground">
                      Show achievement and goal notifications
                    </p>
                  </div>
                  <input type="checkbox" defaultChecked className="h-4 w-4 text-primary" />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">Enhanced Powerups</label>
                    <p className="text-xs text-muted-foreground">
                      Adds 8 new tile types: Freeze, Decay, Mirror, Magnet, Bomb, Chain, Ghost, and Tax. Does not apply to Daily Challenge.
                    </p>
                  </div>
                  <Switch checked={enhancedPowerups} onCheckedChange={handleEnhancedPowerupsToggle} />
                </div>

                <Separator />


              </div>
            </div>
          </TabsContent>

          <TabsContent value="accessibility" className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Accessibility Settings</h3>
              
              <div className="space-y-6">
                <ColorBlindSettings />
                
                <Separator />
                
                <HighContrastToggle />
                
                <Separator />
                
                <div className="space-y-4">
                  <h4 className="font-medium">Keyboard Navigation</h4>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>• Use Tab to navigate between elements</p>
                    <p>• Use Enter or Space to activate buttons</p>
                    <p>• Use Escape to close modals</p>
                    <p>• Use Arrow keys to navigate game board</p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="audio" className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Coming Soon</h3>
              
            </div>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Appearance Settings</h3>
              
              <div className="space-y-6">
                <TileSkinSelector />

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">Floating Tiles Background</label>
                    <p className="text-xs text-muted-foreground">
                      Animated letter tiles drifting across the title screen
                    </p>
                  </div>
                  <Switch checked={floatingTiles} onCheckedChange={handleFloatingTilesToggle} />
                </div>

                <Separator />

                <div className="space-y-2">
                  <label className="text-sm font-medium">Theme</label>
                  <Select value={theme} onValueChange={setTheme}>
                    <SelectTrigger className="w-full">
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
                  <label className="text-sm font-medium">Font Size</label>
                  <Select value={fontSize} onValueChange={(v) => handleFontSizeChange(v as FontSize)}>
                    <SelectTrigger className="w-full">
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

                <Separator />

                
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>;
}