import React from 'react';
import { cn } from '@/components/ui';
import { Label, Input } from '@/components/ui';

interface FormFieldProps {
  label?: string;
  id: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  maxLength?: number;
  className?: string;
  rightElement?: React.ReactNode;
  'data-testid'?: string;
}

export const FormField = React.memo<FormFieldProps>(function FormField({
  label,
  id,
  type = 'text',
  placeholder,
  value,
  onChange,
  error,
  required = false,
  disabled = false,
  maxLength,
  className,
  rightElement,
  'data-testid': dataTestId,
}: FormFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          className={cn(
            'bg-input border-border focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-lg h-12 transition-all duration-150',
            rightElement && 'pr-12',
            error && 'border-destructive focus:border-destructive focus:ring-destructive/20',
            className
          )}
          required={required}
          disabled={disabled}
          maxLength={maxLength}
          data-testid={dataTestId}
        />
        {rightElement && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightElement}</div>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
});
