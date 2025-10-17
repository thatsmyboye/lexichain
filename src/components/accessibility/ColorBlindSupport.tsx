import React, { createContext, useContext, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

type ColorBlindType = 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'achromatopsia';

interface ColorBlindContextType {
  colorBlindType: ColorBlindType;
  setColorBlindType: (type: ColorBlindType) => void;
  getAccessibleColor: (color: string, context?: string) => string;
  getAccessibleIcon: (icon: string, context?: string) => string;
}

const ColorBlindContext = createContext<ColorBlindContextType | undefined>(undefined);

// Color transformations for different types of color blindness
const colorTransformations = {
  protanopia: {
    // Red-blind
    red: '#8B4513', // Brown
    green: '#32CD32', // Lime green
    blue: '#0000FF', // Blue
    yellow: '#FFD700', // Gold
    orange: '#FF8C00', // Dark orange
    purple: '#8A2BE2', // Blue violet
  },
  deuteranopia: {
    // Green-blind
    red: '#FF0000', // Red
    green: '#8B4513', // Brown
    blue: '#0000FF', // Blue
    yellow: '#FFD700', // Gold
    orange: '#FF8C00', // Dark orange
    purple: '#8A2BE2', // Blue violet
  },
  tritanopia: {
    // Blue-blind
    red: '#FF0000', // Red
    green: '#32CD32', // Lime green
    blue: '#8B4513', // Brown
    yellow: '#FFD700', // Gold
    orange: '#FF8C00', // Dark orange
    purple: '#8A2BE2', // Blue violet
  },
  achromatopsia: {
    // Monochrome
    red: '#808080', // Gray
    green: '#808080', // Gray
    blue: '#808080', // Gray
    yellow: '#808080', // Gray
    orange: '#808080', // Gray
    purple: '#808080', // Gray
  }
};

// Icon alternatives for color blind users
const iconAlternatives = {
  protanopia: {
    '🔴': '●', // Red circle -> filled circle
    '🟢': '▲', // Green circle -> triangle
    '🔵': '■', // Blue circle -> square
    '🟡': '★', // Yellow circle -> star
    '🟠': '◆', // Orange circle -> diamond
    '🟣': '♦', // Purple circle -> diamond
  },
  deuteranopia: {
    '🔴': '●', // Red circle -> filled circle
    '🟢': '▲', // Green circle -> triangle
    '🔵': '■', // Blue circle -> square
    '🟡': '★', // Yellow circle -> star
    '🟠': '◆', // Orange circle -> diamond
    '🟣': '♦', // Purple circle -> diamond
  },
  tritanopia: {
    '🔴': '●', // Red circle -> filled circle
    '🟢': '▲', // Green circle -> triangle
    '🔵': '■', // Blue circle -> square
    '🟡': '★', // Yellow circle -> star
    '🟠': '◆', // Orange circle -> diamond
    '🟣': '♦', // Purple circle -> diamond
  },
  achromatopsia: {
    '🔴': '●', // Red circle -> filled circle
    '🟢': '▲', // Green circle -> triangle
    '🔵': '■', // Blue circle -> square
    '🟡': '★', // Yellow circle -> star
    '🟠': '◆', // Orange circle -> diamond
    '🟣': '♦', // Purple circle -> diamond
  }
};

export function ColorBlindProvider({ children }: { children: React.ReactNode }) {
  const [colorBlindType, setColorBlindType] = useState<ColorBlindType>('none');

  useEffect(() => {
    // Load user preference
    const saved = localStorage.getItem('lexichain-colorblind-type');
    if (saved && saved in colorTransformations) {
      setColorBlindType(saved as ColorBlindType);
    }
  }, []);

  const handleSetColorBlindType = (type: ColorBlindType) => {
    setColorBlindType(type);
    localStorage.setItem('lexichain-colorblind-type', type);
  };

  const getAccessibleColor = (color: string, context?: string): string => {
    if (colorBlindType === 'none') return color;

    const transformation = colorTransformations[colorBlindType];
    if (!transformation) return color;

    // Map common colors to accessible alternatives
    const colorMap: Record<string, string> = {
      'red': transformation.red,
      'green': transformation.green,
      'blue': transformation.blue,
      'yellow': transformation.yellow,
      'orange': transformation.orange,
      'purple': transformation.purple,
      '#ef4444': transformation.red,
      '#22c55e': transformation.green,
      '#3b82f6': transformation.blue,
      '#eab308': transformation.yellow,
      '#f97316': transformation.orange,
      '#a855f7': transformation.purple,
    };

    return colorMap[color.toLowerCase()] || color;
  };

  const getAccessibleIcon = (icon: string, context?: string): string => {
    if (colorBlindType === 'none') return icon;

    const alternatives = iconAlternatives[colorBlindType];
    if (!alternatives) return icon;

    return alternatives[icon] || icon;
  };

  return (
    <ColorBlindContext.Provider
      value={{
        colorBlindType,
        setColorBlindType: handleSetColorBlindType,
        getAccessibleColor,
        getAccessibleIcon
      }}
    >
      {children}
    </ColorBlindContext.Provider>
  );
}

export function useColorBlind() {
  const context = useContext(ColorBlindContext);
  if (context === undefined) {
    throw new Error('useColorBlind must be used within a ColorBlindProvider');
  }
  return context;
}

// Accessible color component
interface AccessibleColorProps {
  color: string;
  children: React.ReactNode;
  className?: string;
  context?: string;
}

export function AccessibleColor({ 
  color, 
  children, 
  className, 
  context 
}: AccessibleColorProps) {
  const { getAccessibleColor } = useColorBlind();
  const accessibleColor = getAccessibleColor(color, context);

  return (
    <span
      className={className}
      style={{ color: accessibleColor }}
    >
      {children}
    </span>
  );
}

// Accessible icon component
interface AccessibleIconProps {
  icon: string;
  fallback?: string;
  className?: string;
  context?: string;
}

export function AccessibleIcon({ 
  icon, 
  fallback, 
  className, 
  context 
}: AccessibleIconProps) {
  const { getAccessibleIcon } = useColorBlind();
  const accessibleIcon = getAccessibleIcon(icon, context);

  return (
    <span className={className}>
      {accessibleIcon}
    </span>
  );
}

// Color blind settings component
export function ColorBlindSettings() {
  const { colorBlindType, setColorBlindType } = useColorBlind();

  const options = [
    { value: 'none', label: 'None', description: 'Normal color vision' },
    { value: 'protanopia', label: 'Protanopia', description: 'Red-blind (red appears dark)' },
    { value: 'deuteranopia', label: 'Deuteranopia', description: 'Green-blind (green appears dark)' },
    { value: 'tritanopia', label: 'Tritanopia', description: 'Blue-blind (blue appears dark)' },
    { value: 'achromatopsia', label: 'Achromatopsia', description: 'Monochrome (no color vision)' },
  ] as const;

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Color Vision</label>
        <p className="text-xs text-muted-foreground">
          Adjust colors for different types of color blindness
        </p>
      </div>
      
      <div className="space-y-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex items-center space-x-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50"
          >
            <input
              type="radio"
              name="colorblind-type"
              value={option.value}
              checked={colorBlindType === option.value}
              onChange={(e) => setColorBlindType(e.target.value as ColorBlindType)}
              className="h-4 w-4 text-primary"
            />
            <div className="flex-1">
              <div className="font-medium text-sm">{option.label}</div>
              <div className="text-xs text-muted-foreground">{option.description}</div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

// High contrast mode
interface HighContrastProps {
  children: React.ReactNode;
  className?: string;
}

export function HighContrast({ children, className }: HighContrastProps) {
  const [isHighContrast, setIsHighContrast] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('lexichain-high-contrast');
    setIsHighContrast(saved === 'true');
  }, []);

  useEffect(() => {
    if (isHighContrast) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
  }, [isHighContrast]);

  return (
    <div className={cn(isHighContrast && 'high-contrast', className)}>
      {children}
    </div>
  );
}

// High contrast toggle
export function HighContrastToggle() {
  const [isHighContrast, setIsHighContrast] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('lexichain-high-contrast');
    setIsHighContrast(saved === 'true');
  }, []);

  const toggleHighContrast = () => {
    const newValue = !isHighContrast;
    setIsHighContrast(newValue);
    localStorage.setItem('lexichain-high-contrast', newValue.toString());
    
    if (newValue) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
  };

  return (
    <button
      onClick={toggleHighContrast}
      className="flex items-center gap-2 p-2 rounded-lg border hover:bg-muted/50"
      aria-pressed={isHighContrast}
    >
      <div className={cn(
        "w-4 h-4 rounded border-2",
        isHighContrast ? "bg-primary border-primary" : "bg-background border-muted-foreground"
      )} />
      <span className="text-sm">High Contrast</span>
    </button>
  );
}
