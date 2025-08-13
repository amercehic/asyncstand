'use client';

import { useTheme } from 'next-themes';
import { Toaster as Sonner, ToasterProps } from 'sonner';

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      position="top-right"
      expand={true}
      visibleToasts={4}
      closeButton={true}
      richColors={true}
      style={
        {
          '--normal-bg': 'hsl(var(--card))',
          '--normal-border': 'hsl(var(--border))',
          '--normal-text': 'hsl(var(--card-foreground))',
          '--success-bg': 'hsl(var(--card))',
          '--success-border': 'hsl(142 76% 36%)',
          '--success-text': 'hsl(var(--card-foreground))',
          '--error-bg': 'hsl(var(--card))',
          '--error-border': 'hsl(0 84% 60%)',
          '--error-text': 'hsl(var(--card-foreground))',
          '--warning-bg': 'hsl(var(--card))',
          '--warning-border': 'hsl(38 92% 50%)',
          '--warning-text': 'hsl(var(--card-foreground))',
          '--info-bg': 'hsl(var(--card))',
          '--info-border': 'hsl(221 83% 53%)',
          '--info-text': 'hsl(var(--card-foreground))',
        } as React.CSSProperties
      }
      toastOptions={{
        style: {
          background: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          color: 'hsl(var(--card-foreground))',
          borderRadius: '0.75rem',
          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
          backdropFilter: 'blur(8px)',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
