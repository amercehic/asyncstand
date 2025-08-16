import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModernButton } from '@/components/ui/modern-button';

// Simple render without providers for isolated component testing
describe('ModernButton', () => {
  it('renders button with text', () => {
    render(<ModernButton>Click me</ModernButton>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('applies primary variant styles', () => {
    render(<ModernButton variant="primary">Primary</ModernButton>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-gradient-to-r');
    expect(button.className).toContain('from-');
    expect(button.className).toContain('to-');
  });

  it('applies secondary variant styles', () => {
    render(<ModernButton variant="secondary">Secondary</ModernButton>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-transparent', 'border', 'border-border');
  });

  it('applies ghost variant styles', () => {
    render(<ModernButton variant="ghost">Ghost</ModernButton>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('hover:bg-accent');
  });

  it('applies large size styles', () => {
    render(<ModernButton size="lg">Large</ModernButton>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('px-8', 'py-4', 'text-lg');
  });

  it('applies small size styles', () => {
    render(<ModernButton size="sm">Small</ModernButton>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('px-4', 'py-2', 'text-sm');
  });

  it('handles click events', () => {
    const handleClick = vi.fn();
    render(<ModernButton onClick={handleClick}>Click</ModernButton>);

    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is true', () => {
    render(<ModernButton disabled>Disabled</ModernButton>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button.className).toContain('disabled:opacity-50');
    expect(button.className).toContain('disabled:cursor-not-allowed');
  });

  it('applies custom className', () => {
    render(<ModernButton className="custom-class">Custom</ModernButton>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });
});
