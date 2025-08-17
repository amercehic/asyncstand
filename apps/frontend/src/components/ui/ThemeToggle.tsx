import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/contexts';
import { ModernButton } from '@/components/ui/ModernButton';

export const ThemeToggle = React.memo(() => {
  const { theme, setTheme, isLoaded } = useTheme();

  const handleThemeChange = () => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  };

  const getIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun className="w-4 h-4" />;
      case 'dark':
        return <Moon className="w-4 h-4" />;
      case 'system':
        return <Monitor className="w-4 h-4" />;
      default:
        return <Sun className="w-4 h-4" />;
    }
  };

  const getLabel = () => {
    switch (theme) {
      case 'light':
        return 'Light Theme';
      case 'dark':
        return 'Dark Theme';
      case 'system':
        return 'Auto Theme';
      default:
        return 'Light Theme';
    }
  };

  // Don't render until theme is loaded to prevent flash
  if (!isLoaded) {
    return <div className="w-6 h-6 bg-muted rounded-full animate-pulse" />;
  }

  return (
    <ModernButton
      variant="ghost"
      size="sm"
      onClick={handleThemeChange}
      className="focus:ring-0 focus:ring-transparent focus:outline-none w-full h-full rounded-full hover:bg-accent/80 p-0 flex items-center justify-center"
      title={`Switch theme - currently ${getLabel().toLowerCase()}`}
      data-testid="theme-toggle-button"
    >
      {getIcon()}
    </ModernButton>
  );
});
