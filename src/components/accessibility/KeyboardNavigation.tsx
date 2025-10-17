import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface KeyboardNavigationProps {
  children: React.ReactNode;
  className?: string;
  onKeyDown?: (event: KeyboardEvent) => void;
  onKeyUp?: (event: KeyboardEvent) => void;
  focusable?: boolean;
  tabIndex?: number;
}

export function KeyboardNavigation({
  children,
  className,
  onKeyDown,
  onKeyUp,
  focusable = true,
  tabIndex = 0
}: KeyboardNavigationProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      onKeyDown?.(event);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      onKeyUp?.(event);
    };

    element.addEventListener('keydown', handleKeyDown);
    element.addEventListener('keyup', handleKeyUp);

    return () => {
      element.removeEventListener('keydown', handleKeyDown);
      element.removeEventListener('keyup', handleKeyUp);
    };
  }, [onKeyDown, onKeyUp]);

  return (
    <div
      ref={ref}
      className={cn(
        focusable && "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        className
      )}
      tabIndex={focusable ? tabIndex : -1}
    >
      {children}
    </div>
  );
}

// Focus trap for modals and overlays
interface FocusTrapProps {
  children: React.ReactNode;
  active?: boolean;
  className?: string;
}

export function FocusTrap({ children, active = true, className }: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    const container = containerRef.current;
    if (!container) return;

    // Store the previously focused element
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Get all focusable elements within the container
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus the first element
    if (firstElement) {
      firstElement.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        if (event.shiftKey) {
          // Shift + Tab
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement?.focus();
          }
        } else {
          // Tab
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement?.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus to the previously focused element
      previousActiveElement.current?.focus();
    };
  }, [active]);

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
}

// Skip link for keyboard navigation
interface SkipLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

export function SkipLink({ href, children, className }: SkipLinkProps) {
  return (
    <a
      href={href}
      className={cn(
        "sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4",
        "bg-primary text-primary-foreground px-4 py-2 rounded-md",
        "z-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        className
      )}
    >
      {children}
    </a>
  );
}

// Keyboard shortcuts hook
export function useKeyboardShortcuts(shortcuts: Record<string, () => void>) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const modifiers = {
        ctrl: event.ctrlKey,
        alt: event.altKey,
        shift: event.shiftKey,
        meta: event.metaKey
      };

      // Create shortcut key
      const shortcutKey = [
        modifiers.ctrl && 'ctrl',
        modifiers.alt && 'alt',
        modifiers.shift && 'shift',
        modifiers.meta && 'meta',
        key
      ].filter(Boolean).join('+');

      const handler = shortcuts[shortcutKey];
      if (handler) {
        event.preventDefault();
        handler();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}

// Accessible button with keyboard support
interface AccessibleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  className?: string;
}

export function AccessibleButton({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  disabled,
  ...props
}: AccessibleButtonProps) {
  const getVariantClasses = () => {
    switch (variant) {
      case 'primary':
        return 'bg-primary text-primary-foreground hover:bg-primary/90';
      case 'secondary':
        return 'bg-secondary text-secondary-foreground hover:bg-secondary/80';
      case 'outline':
        return 'border border-input bg-background hover:bg-accent hover:text-accent-foreground';
      case 'ghost':
        return 'hover:bg-accent hover:text-accent-foreground';
      default:
        return 'bg-primary text-primary-foreground hover:bg-primary/90';
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'h-9 px-3 text-sm';
      case 'md':
        return 'h-10 px-4 py-2';
      case 'lg':
        return 'h-11 px-8 text-lg';
      default:
        return 'h-10 px-4 py-2';
    }
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium',
        'transition-colors focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        getVariantClasses(),
        getSizeClasses(),
        className
      )}
      disabled={disabled || loading}
      aria-disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}

// Screen reader only text
interface ScreenReaderOnlyProps {
  children: React.ReactNode;
  className?: string;
}

export function ScreenReaderOnly({ children, className }: ScreenReaderOnlyProps) {
  return (
    <span className={cn('sr-only', className)}>
      {children}
    </span>
  );
}

// Live region for announcements
interface LiveRegionProps {
  children: React.ReactNode;
  politeness?: 'polite' | 'assertive' | 'off';
  className?: string;
}

export function LiveRegion({ 
  children, 
  politeness = 'polite', 
  className 
}: LiveRegionProps) {
  return (
    <div
      className={cn('sr-only', className)}
      role="status"
      aria-live={politeness}
      aria-atomic="true"
    >
      {children}
    </div>
  );
}
