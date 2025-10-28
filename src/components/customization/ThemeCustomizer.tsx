import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Palette, 
  Eye, 
  Sparkles, 
  Moon, 
  Sun, 
  Monitor,
  Lock,
  CheckCircle,
  Download,
  Upload
} from 'lucide-react';
import { useSound } from '@/components/effects';

export interface ThemeConfig {
  id: string;
  name: string;
  description: string;
  category: 'preset' | 'custom';
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    muted: string;
  };
  particles: {
    enabled: boolean;
    intensity: number;
    color: string;
    type: 'sparkles' | 'bubbles' | 'stars' | 'hearts';
  };
  animations: {
    enabled: boolean;
    speed: number;
    easing: 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out';
  };
  unlockLevel?: number;
  isUnlocked: boolean;
}

const PRESET_THEMES: ThemeConfig[] = [
  {
    id: 'default',
    name: 'Classic',
    description: 'The original Lexichain theme',
    category: 'preset',
    colors: {
      primary: 'hsl(221, 83%, 53%)',
      secondary: 'hsl(210, 40%, 98%)',
      accent: 'hsl(47, 96%, 53%)',
      background: 'hsl(0, 0%, 100%)',
      surface: 'hsl(0, 0%, 98%)',
      text: 'hsl(222, 84%, 5%)',
      muted: 'hsl(215, 20%, 65%)'
    },
    particles: {
      enabled: true,
      intensity: 50,
      color: '#3b82f6',
      type: 'sparkles'
    },
    animations: {
      enabled: true,
      speed: 50,
      easing: 'ease-out'
    },
    isUnlocked: true
  },
  {
    id: 'dark',
    name: 'Dark Mode',
    description: 'Elegant dark theme for night gaming',
    category: 'preset',
    colors: {
      primary: 'hsl(221, 83%, 53%)',
      secondary: 'hsl(222, 84%, 5%)',
      accent: 'hsl(47, 96%, 53%)',
      background: 'hsl(222, 84%, 5%)',
      surface: 'hsl(215, 28%, 17%)',
      text: 'hsl(210, 40%, 98%)',
      muted: 'hsl(215, 20%, 65%)'
    },
    particles: {
      enabled: true,
      intensity: 70,
      color: '#60a5fa',
      type: 'stars'
    },
    animations: {
      enabled: true,
      speed: 40,
      easing: 'ease-in-out'
    },
    isUnlocked: true
  },
  {
    id: 'ocean',
    name: 'Ocean Depths',
    description: 'Calming blue tones inspired by the deep sea',
    category: 'preset',
    colors: {
      primary: 'hsl(200, 100%, 50%)',
      secondary: 'hsl(200, 100%, 95%)',
      accent: 'hsl(180, 100%, 50%)',
      background: 'hsl(200, 100%, 98%)',
      surface: 'hsl(200, 50%, 90%)',
      text: 'hsl(200, 100%, 10%)',
      muted: 'hsl(200, 30%, 60%)'
    },
    particles: {
      enabled: true,
      intensity: 60,
      color: '#0ea5e9',
      type: 'bubbles'
    },
    animations: {
      enabled: true,
      speed: 30,
      easing: 'ease-out'
    },
    unlockLevel: 5,
    isUnlocked: false
  },
  {
    id: 'forest',
    name: 'Forest Green',
    description: 'Natural green theme for nature lovers',
    category: 'preset',
    colors: {
      primary: 'hsl(120, 60%, 50%)',
      secondary: 'hsl(120, 60%, 95%)',
      accent: 'hsl(60, 100%, 50%)',
      background: 'hsl(120, 60%, 98%)',
      surface: 'hsl(120, 30%, 90%)',
      text: 'hsl(120, 100%, 10%)',
      muted: 'hsl(120, 20%, 60%)'
    },
    particles: {
      enabled: true,
      intensity: 45,
      color: '#22c55e',
      type: 'sparkles'
    },
    animations: {
      enabled: true,
      speed: 60,
      easing: 'ease'
    },
    unlockLevel: 10,
    isUnlocked: false
  },
  {
    id: 'sunset',
    name: 'Sunset Glow',
    description: 'Warm orange and pink tones of a beautiful sunset',
    category: 'preset',
    colors: {
      primary: 'hsl(30, 100%, 60%)',
      secondary: 'hsl(30, 100%, 95%)',
      accent: 'hsl(320, 100%, 60%)',
      background: 'hsl(30, 100%, 98%)',
      surface: 'hsl(30, 50%, 90%)',
      text: 'hsl(30, 100%, 10%)',
      muted: 'hsl(30, 30%, 60%)'
    },
    particles: {
      enabled: true,
      intensity: 80,
      color: '#f97316',
      type: 'hearts'
    },
    animations: {
      enabled: true,
      speed: 70,
      easing: 'ease-in'
    },
    unlockLevel: 15,
    isUnlocked: false
  },
  {
    id: 'cosmic',
    name: 'Cosmic Purple',
    description: 'Mystical purple theme for space adventurers',
    category: 'preset',
    colors: {
      primary: 'hsl(270, 100%, 60%)',
      secondary: 'hsl(270, 100%, 95%)',
      accent: 'hsl(300, 100%, 60%)',
      background: 'hsl(270, 100%, 98%)',
      surface: 'hsl(270, 50%, 90%)',
      text: 'hsl(270, 100%, 10%)',
      muted: 'hsl(270, 30%, 60%)'
    },
    particles: {
      enabled: true,
      intensity: 90,
      color: '#a855f7',
      type: 'stars'
    },
    animations: {
      enabled: true,
      speed: 20,
      easing: 'ease-in-out'
    },
    unlockLevel: 20,
    isUnlocked: false
  }
];

export function ThemeCustomizer({ 
  currentTheme,
  onThemeChange,
  userLevel = 1,
  unlockedThemes = new Set(['default', 'dark'])
}: {
  currentTheme: ThemeConfig;
  onThemeChange: (theme: ThemeConfig) => void;
  userLevel?: number;
  unlockedThemes?: Set<string>;
}) {
  const [activeTab, setActiveTab] = useState('presets');
  const [customTheme, setCustomTheme] = useState<ThemeConfig>(currentTheme);
  const [previewMode, setPreviewMode] = useState(false);
  const { playSound } = useSound();

  // Update unlocked themes based on user level
  const availableThemes = PRESET_THEMES.map(theme => ({
    ...theme,
    isUnlocked: unlockedThemes.has(theme.id) || (theme.unlockLevel ? userLevel >= theme.unlockLevel : true)
  }));

  const handleThemeSelect = (theme: ThemeConfig) => {
    if (!theme.isUnlocked) {
      playSound('error');
      return;
    }
    
    onThemeChange(theme);
    playSound('button_click');
  };

  const handleCustomThemeUpdate = (updates: Partial<ThemeConfig>) => {
    setCustomTheme(prev => ({ ...prev, ...updates }));
  };

  const handleSaveCustomTheme = () => {
    const newCustomTheme = {
      ...customTheme,
      id: 'custom',
      name: 'Custom Theme',
      category: 'custom' as const
    };
    onThemeChange(newCustomTheme);
    playSound('success');
  };

  const handleExportTheme = () => {
    const themeData = JSON.stringify(currentTheme, null, 2);
    const blob = new Blob([themeData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lexichain-theme-${currentTheme.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    playSound('success');
  };

  const handleImportTheme = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const themeData = JSON.parse(e.target?.result as string);
        onThemeChange(themeData);
        playSound('success');
      } catch (error) {
        playSound('error');
        console.error('Invalid theme file');
      }
    };
    reader.readAsText(file);
  };

  const getUnlockRequirement = (theme: ThemeConfig) => {
    if (theme.isUnlocked) return null;
    return `Level ${theme.unlockLevel}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-6">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-400))] to-[hsl(var(--brand-600))]">
            Theme Customizer
          </h1>
          <p className="text-muted-foreground mt-2">
            Personalize your Lexichain experience with custom themes
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="presets">Preset Themes</TabsTrigger>
            <TabsTrigger value="custom">Custom Theme</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Preset Themes Tab */}
          <TabsContent value="presets" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {availableThemes.map((theme) => {
                const isSelected = currentTheme.id === theme.id;
                const unlockReq = getUnlockRequirement(theme);
                
                return (
                  <Card 
                    key={theme.id}
                    className={`cursor-pointer transition-all duration-200 ${
                      isSelected 
                        ? 'ring-2 ring-primary shadow-lg scale-105' 
                        : 'hover:shadow-md hover:scale-102'
                    } ${
                      !theme.isUnlocked 
                        ? 'opacity-50 cursor-not-allowed' 
                        : ''
                    }`}
                    onClick={() => handleThemeSelect(theme)}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-8 h-8 rounded-lg border-2"
                            style={{ backgroundColor: theme.colors.primary }}
                          />
                          <div>
                            <CardTitle className="text-lg">{theme.name}</CardTitle>
                            <CardDescription className="text-sm">
                              {theme.description}
                            </CardDescription>
                          </div>
                        </div>
                        {!theme.isUnlocked && (
                          <Badge variant="outline" className="text-xs">
                            <Lock className="h-3 w-3 mr-1" />
                            {unlockReq}
                          </Badge>
                        )}
                        {isSelected && (
                          <CheckCircle className="h-5 w-5 text-primary" />
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {/* Color Preview */}
                        <div className="flex gap-1">
                          {Object.values(theme.colors).slice(0, 4).map((color, index) => (
                            <div
                              key={index}
                              className="w-6 h-6 rounded border"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                        
                        {/* Theme Features */}
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            Particles: {theme.particles.type}
                          </div>
                          <div className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            Animations: {theme.animations.enabled ? 'On' : 'Off'}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Custom Theme Tab */}
          <TabsContent value="custom" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Color Customization */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    Color Scheme
                  </CardTitle>
                  <CardDescription>
                    Customize the color palette for your theme
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(customTheme.colors).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-3">
                      <label className="w-20 text-sm font-medium capitalize">
                        {key}
                      </label>
                      <div className="flex items-center gap-2 flex-1">
                        <div
                          className="w-8 h-8 rounded border"
                          style={{ backgroundColor: value }}
                        />
                        <input
                          type="color"
                          value={value}
                          onChange={(e) => handleCustomThemeUpdate({
                            colors: { ...customTheme.colors, [key]: e.target.value }
                          })}
                          className="w-16 h-8 rounded border"
                        />
                        <span className="text-xs text-muted-foreground font-mono">
                          {value}
                        </span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Particle Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Particle Effects
                  </CardTitle>
                  <CardDescription>
                    Configure particle effects and animations
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Enable Particles</label>
                    <Switch
                      checked={customTheme.particles.enabled}
                      onCheckedChange={(checked) => handleCustomThemeUpdate({
                        particles: { ...customTheme.particles, enabled: checked }
                      })}
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Intensity: {customTheme.particles.intensity}%
                    </label>
                    <Slider
                      value={[customTheme.particles.intensity]}
                      onValueChange={([value]) => handleCustomThemeUpdate({
                        particles: { ...customTheme.particles, intensity: value }
                      })}
                      max={100}
                      step={10}
                      className="w-full"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">Particle Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['sparkles', 'bubbles', 'stars', 'hearts'].map((type) => (
                        <Button
                          key={type}
                          variant={customTheme.particles.type === type ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleCustomThemeUpdate({
                            particles: { ...customTheme.particles, type: type as any }
                          })}
                          className="capitalize"
                        >
                          {type}
                        </Button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium">Color</label>
                    <div
                      className="w-8 h-8 rounded border"
                      style={{ backgroundColor: customTheme.particles.color }}
                    />
                    <input
                      type="color"
                      value={customTheme.particles.color}
                      onChange={(e) => handleCustomThemeUpdate({
                        particles: { ...customTheme.particles, color: e.target.value }
                      })}
                      className="w-16 h-8 rounded border"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Animation Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    Animation Settings
                  </CardTitle>
                  <CardDescription>
                    Control animation behavior and timing
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Enable Animations</label>
                    <Switch
                      checked={customTheme.animations.enabled}
                      onCheckedChange={(checked) => handleCustomThemeUpdate({
                        animations: { ...customTheme.animations, enabled: checked }
                      })}
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Speed: {customTheme.animations.speed}%
                    </label>
                    <Slider
                      value={[customTheme.animations.speed]}
                      onValueChange={([value]) => handleCustomThemeUpdate({
                        animations: { ...customTheme.animations, speed: value }
                      })}
                      max={100}
                      step={10}
                      className="w-full"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">Easing</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['ease', 'ease-in', 'ease-out', 'ease-in-out'].map((easing) => (
                        <Button
                          key={easing}
                          variant={customTheme.animations.easing === easing ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleCustomThemeUpdate({
                            animations: { ...customTheme.animations, easing: easing as any }
                          })}
                        >
                          {easing}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Preview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    Theme Preview
                  </CardTitle>
                  <CardDescription>
                    See how your theme looks
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div 
                    className="p-4 rounded-lg border"
                    style={{ 
                      backgroundColor: customTheme.colors.background,
                      color: customTheme.colors.text
                    }}
                  >
                    <div className="space-y-3">
                      <div 
                        className="h-8 rounded"
                        style={{ backgroundColor: customTheme.colors.primary }}
                      />
                      <div 
                        className="h-4 rounded"
                        style={{ backgroundColor: customTheme.colors.surface }}
                      />
                      <div 
                        className="h-4 rounded w-3/4"
                        style={{ backgroundColor: customTheme.colors.muted }}
                      />
                      <div className="flex gap-2">
                        <div 
                          className="w-6 h-6 rounded"
                          style={{ backgroundColor: customTheme.colors.accent }}
                        />
                        <div 
                          className="w-6 h-6 rounded"
                          style={{ backgroundColor: customTheme.colors.secondary }}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <Button onClick={handleSaveCustomTheme} className="flex-1">
                      Save Custom Theme
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5" />
                    Export/Import
                  </CardTitle>
                  <CardDescription>
                    Share your themes with others
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button onClick={handleExportTheme} className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Export Current Theme
                  </Button>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Import Theme
                    </label>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportTheme}
                      className="w-full text-sm"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Monitor className="h-5 w-5" />
                    Display Settings
                  </CardTitle>
                  <CardDescription>
                    Configure how themes are applied
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Auto-apply themes</label>
                    <Switch defaultChecked />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Preview mode</label>
                    <Switch 
                      checked={previewMode}
                      onCheckedChange={setPreviewMode}
                    />
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    Preview mode allows you to test themes without saving them permanently.
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default ThemeCustomizer;

