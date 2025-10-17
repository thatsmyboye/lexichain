import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Settings, Accessibility, Volume2, Palette, Zap } from 'lucide-react';
import { SoundSettings } from '@/components/effects/SoundSystem';
import { ColorBlindSettings, HighContrastToggle } from '@/components/accessibility/ColorBlindSupport';
import { useSound } from '@/components/effects/SoundSystem';
import { useColorBlind } from '@/components/accessibility/ColorBlindSupport';

export function GameSettings() {
  const [activeTab, setActiveTab] = useState('general');
  const { playSound } = useSound();
  const { colorBlindType } = useColorBlind();

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    playSound('button_click');
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
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
              General
            </TabsTrigger>
            <TabsTrigger value="accessibility" className="flex items-center gap-2">
              <Accessibility className="h-4 w-4" />
              Accessibility
            </TabsTrigger>
            <TabsTrigger value="audio" className="flex items-center gap-2">
              <Volume2 className="h-4 w-4" />
              Audio
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Appearance
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
                  <input
                    type="checkbox"
                    defaultChecked
                    className="h-4 w-4 text-primary"
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">Notifications</label>
                    <p className="text-xs text-muted-foreground">
                      Show achievement and goal notifications
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    defaultChecked
                    className="h-4 w-4 text-primary"
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <label className="text-sm font-medium">Game Difficulty</label>
                  <select className="w-full p-2 border rounded-md">
                    <option value="easy">Easy</option>
                    <option value="medium" selected>Medium</option>
                    <option value="hard">Hard</option>
                    <option value="expert">Expert</option>
                  </select>
                </div>
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
              <h3 className="text-lg font-semibold">Audio Settings</h3>
              <SoundSettings />
            </div>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Appearance Settings</h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Theme</label>
                  <select className="w-full p-2 border rounded-md">
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="system">System</option>
                  </select>
                </div>

                <Separator />

                <div className="space-y-2">
                  <label className="text-sm font-medium">Font Size</label>
                  <select className="w-full p-2 border rounded-md">
                    <option value="small">Small</option>
                    <option value="medium" selected>Medium</option>
                    <option value="large">Large</option>
                    <option value="extra-large">Extra Large</option>
                  </select>
                </div>

                <Separator />

                <div className="space-y-2">
                  <label className="text-sm font-medium">Animation Speed</label>
                  <select className="w-full p-2 border rounded-md">
                    <option value="slow">Slow</option>
                    <option value="normal" selected>Normal</option>
                    <option value="fast">Fast</option>
                    <option value="none">None</option>
                  </select>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
