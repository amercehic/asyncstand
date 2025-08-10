import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/contexts';
import { ModernButton } from '@/components/ui/modern-button';

export const ThemeToggle = React.memo(() => {
  const { theme, setTheme } = useTheme();

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

  return (
    <ModernButton
      variant="ghost"
      size="sm"
      onClick={handleThemeChange}
      className="gap-2"
      title={`Switch theme - currently ${getLabel().toLowerCase()}`}
    >
      {getIcon()}
      <span className="hidden sm:inline">{getLabel()}</span>
    </ModernButton>
  );
});
