import React, { createContext, useContext, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

// ARIA context for managing announcements
interface ARIAContextType {
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
  clearAnnouncements: () => void;
}

const ARIAContext = createContext<ARIAContextType | undefined>(undefined);

export function ARIAProvider({ children }: { children: React.ReactNode }) {
  const [announcements, setAnnouncements] = useState<Array<{
    id: string;
    message: string;
    priority: 'polite' | 'assertive';
  }>>([]);

  const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const id = Math.random().toString(36).substr(2, 9);
    setAnnouncements(prev => [...prev, { id, message, priority }]);
    
    // Remove announcement after 5 seconds
    setTimeout(() => {
      setAnnouncements(prev => prev.filter(a => a.id !== id));
    }, 5000);
  };

  const clearAnnouncements = () => {
    setAnnouncements([]);
  };

  return (
    <ARIAContext.Provider value={{ announce, clearAnnouncements }}>
      {children}
      {/* Live regions for announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcements
          .filter(a => a.priority === 'polite')
          .map(a => (
            <div key={a.id}>{a.message}</div>
          ))}
      </div>
      <div
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {announcements
          .filter(a => a.priority === 'assertive')
          .map(a => (
            <div key={a.id}>{a.message}</div>
          ))}
      </div>
    </ARIAContext.Provider>
  );
}

export function useARIA() {
  const context = useContext(ARIAContext);
  if (context === undefined) {
    throw new Error('useARIA must be used within an ARIAProvider');
  }
  return context;
}

// Accessible progress bar
interface AccessibleProgressProps {
  value: number;
  max?: number;
  label?: string;
  className?: string;
  showPercentage?: boolean;
}

export function AccessibleProgress({
  value,
  max = 100,
  label,
  className,
  showPercentage = true
}: AccessibleProgressProps) {
  const percentage = Math.round((value / max) * 100);
  const { announce } = useARIA();

  useEffect(() => {
    if (percentage === 100) {
      announce('Progress complete', 'polite');
    }
  }, [percentage, announce]);

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <div className="flex justify-between text-sm">
          <span>{label}</span>
          {showPercentage && <span>{percentage}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label || `Progress: ${percentage}%`}
        className="w-full bg-muted rounded-full h-2"
      >
        <div
          className="bg-primary h-2 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// Accessible toggle switch
interface AccessibleToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

export function AccessibleToggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  className
}: AccessibleToggleProps) {
  const { announce } = useARIA();

  const handleChange = () => {
    if (!disabled) {
      const newValue = !checked;
      onChange(newValue);
      announce(`${label} ${newValue ? 'enabled' : 'disabled'}`, 'polite');
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <label className="flex items-center space-x-3 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          className="sr-only"
          aria-describedby={description ? `${label}-description` : undefined}
        />
        <div
          className={cn(
            'relative w-12 h-6 rounded-full transition-colors',
            checked ? 'bg-primary' : 'bg-muted',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          onClick={handleChange}
          role="switch"
          aria-checked={checked}
          aria-label={label}
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              handleChange();
            }
          }}
        >
          <div
            className={cn(
              'absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform',
              checked && 'translate-x-6'
            )}
          />
        </div>
        <div>
          <div className="font-medium text-sm">{label}</div>
          {description && (
            <div id={`${label}-description`} className="text-xs text-muted-foreground">
              {description}
            </div>
          )}
        </div>
      </label>
    </div>
  );
}

// Accessible modal
interface AccessibleModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function AccessibleModal({
  isOpen,
  onClose,
  title,
  children,
  className
}: AccessibleModalProps) {
  const { announce } = useARIA();

  useEffect(() => {
    if (isOpen) {
      announce(`Modal opened: ${title}`, 'polite');
    }
  }, [isOpen, title, announce]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className={cn(
          'bg-background rounded-lg shadow-lg max-w-md w-full mx-4',
          className
        )}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 id="modal-title" className="text-lg font-semibold">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
}

// Accessible tooltip
interface AccessibleTooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export function AccessibleTooltip({
  content,
  children,
  position = 'top',
  className
}: AccessibleTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  const getPositionClasses = () => {
    switch (position) {
      case 'top':
        return 'bottom-full left-1/2 transform -translate-x-1/2 mb-2';
      case 'bottom':
        return 'top-full left-1/2 transform -translate-x-1/2 mt-2';
      case 'left':
        return 'right-full top-1/2 transform -translate-y-1/2 mr-2';
      case 'right':
        return 'left-full top-1/2 transform -translate-y-1/2 ml-2';
      default:
        return 'bottom-full left-1/2 transform -translate-x-1/2 mb-2';
    }
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          className={cn(
            'absolute z-50 px-2 py-1 text-sm text-white bg-gray-900 rounded shadow-lg',
            getPositionClasses(),
            className
          )}
          role="tooltip"
          aria-hidden="false"
        >
          {content}
        </div>
      )}
    </div>
  );
}

// Accessible table
interface AccessibleTableProps {
  caption?: string;
  headers: string[];
  rows: string[][];
  className?: string;
}

export function AccessibleTable({
  caption,
  headers,
  rows,
  className
}: AccessibleTableProps) {
  return (
    <table className={cn('w-full border-collapse', className)}>
      {caption && <caption className="text-left font-medium mb-2">{caption}</caption>}
      <thead>
        <tr>
          {headers.map((header, index) => (
            <th
              key={index}
              className="border border-border px-4 py-2 text-left font-medium"
              scope="col"
            >
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, cellIndex) => (
              <td
                key={cellIndex}
                className="border border-border px-4 py-2"
                scope={cellIndex === 0 ? 'row' : undefined}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Accessible form field
interface AccessibleFormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function AccessibleFormField({
  label,
  error,
  required = false,
  children,
  className
}: AccessibleFormFieldProps) {
  const fieldId = Math.random().toString(36).substr(2, 9);
  const errorId = `${fieldId}-error`;

  return (
    <div className={cn('space-y-2', className)}>
      <label
        htmlFor={fieldId}
        className="block text-sm font-medium"
      >
        {label}
        {required && <span className="text-destructive ml-1" aria-label="required">*</span>}
      </label>
      <div>
        {React.cloneElement(children as React.ReactElement, {
          id: fieldId,
          'aria-invalid': error ? 'true' : 'false',
          'aria-describedby': error ? errorId : undefined,
          required
        })}
      </div>
      {error && (
        <div
          id={errorId}
          className="text-sm text-destructive"
          role="alert"
          aria-live="polite"
        >
          {error}
        </div>
      )}
    </div>
  );
}
