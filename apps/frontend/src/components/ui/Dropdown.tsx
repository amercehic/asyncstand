import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface DropdownItem {
  label?: string;
  onClick?: () => void;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: 'default' | 'destructive';
  type?: 'item' | 'separator';
  className?: string;
}

interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
}

export const Dropdown: React.FC<DropdownProps> = ({ trigger, items, align = 'right' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleItemClick = (item: DropdownItem) => {
    if (item.type === 'separator' || !item.onClick) return;
    item.onClick();
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        onClick={e => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
      >
        {trigger}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.1 }}
            className={`absolute z-[9999] mt-2 min-w-[160px] bg-background border border-border rounded-lg shadow-lg ${
              align === 'right' ? 'right-0' : 'left-0'
            }`}
          >
            <div className="py-1">
              {items.map((item, index) =>
                item.type === 'separator' ? (
                  <div key={index} className="h-px bg-border my-1" />
                ) : (
                  <button
                    key={index}
                    onClick={e => {
                      e.stopPropagation();
                      handleItemClick(item);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-sm text-left hover:bg-muted transition-colors ${
                      item.variant === 'destructive' || item.className?.includes('text-red')
                        ? 'text-red-600 hover:text-red-700'
                        : 'text-foreground'
                    } ${item.className || ''}`}
                  >
                    {item.icon && <item.icon className="w-4 h-4" />}
                    {item.label}
                  </button>
                )
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
