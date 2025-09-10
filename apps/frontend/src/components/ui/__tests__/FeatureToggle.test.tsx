import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FeatureToggle } from '@/components/ui/FeatureToggle';

describe('FeatureToggle', () => {
  const mockOnToggle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render enabled toggle correctly', () => {
    render(<FeatureToggle enabled={true} onToggle={mockOnToggle} />);

    const toggle = screen.getByRole('switch');
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(toggle).not.toBeDisabled();
  });

  it('should render disabled toggle correctly', () => {
    render(<FeatureToggle enabled={false} onToggle={mockOnToggle} />);

    const toggle = screen.getByRole('switch');
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('should render with label when provided', () => {
    const label = 'Enable Analytics';
    render(<FeatureToggle enabled={false} onToggle={mockOnToggle} label={label} />);

    // Should find the visible label (not the sr-only one)
    expect(
      screen.getByText(label, { selector: '.text-sm.font-medium.text-foreground' })
    ).toBeInTheDocument();
    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-label', label);
  });

  it('should render with default aria-label when no label provided', () => {
    render(<FeatureToggle enabled={false} onToggle={mockOnToggle} />);

    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-label', 'Toggle feature');
  });

  it('should call onToggle when clicked', async () => {
    const user = userEvent.setup();
    render(<FeatureToggle enabled={false} onToggle={mockOnToggle} />);

    const toggle = screen.getByRole('switch');
    await user.click(toggle);

    expect(mockOnToggle).toHaveBeenCalledTimes(1);
    expect(mockOnToggle).toHaveBeenCalledWith(true);
  });

  it('should call onToggle with opposite state', async () => {
    const user = userEvent.setup();
    render(<FeatureToggle enabled={true} onToggle={mockOnToggle} />);

    const toggle = screen.getByRole('switch');
    await user.click(toggle);

    expect(mockOnToggle).toHaveBeenCalledWith(false);
  });

  it('should not call onToggle when disabled', async () => {
    const user = userEvent.setup();
    render(<FeatureToggle enabled={false} onToggle={mockOnToggle} disabled={true} />);

    const toggle = screen.getByRole('switch');
    expect(toggle).toBeDisabled();

    await user.click(toggle);
    expect(mockOnToggle).not.toHaveBeenCalled();
  });

  it('should not call onToggle when loading', async () => {
    const user = userEvent.setup();
    render(<FeatureToggle enabled={false} onToggle={mockOnToggle} loading={true} />);

    const toggle = screen.getByRole('switch');
    expect(toggle).toBeDisabled();

    await user.click(toggle);
    expect(mockOnToggle).not.toHaveBeenCalled();
  });

  it('should show loading spinner when loading', () => {
    render(<FeatureToggle enabled={false} onToggle={mockOnToggle} loading={true} />);

    const spinner = screen.getByRole('switch').querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('should handle async onToggle operations', async () => {
    const asyncOnToggle = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<FeatureToggle enabled={false} onToggle={asyncOnToggle} />);

    const toggle = screen.getByRole('switch');
    await user.click(toggle);

    expect(asyncOnToggle).toHaveBeenCalledWith(true);

    // Verify animation state is set and cleared
    await waitFor(() => {
      expect(toggle.querySelector('.animate-pulse')).toBeInTheDocument();
    });

    await waitFor(
      () => {
        expect(toggle.querySelector('.animate-pulse')).not.toBeInTheDocument();
      },
      { timeout: 500 }
    );
  });

  it('should render different sizes correctly', () => {
    const { rerender } = render(
      <FeatureToggle enabled={false} onToggle={mockOnToggle} size="sm" />
    );

    let toggle = screen.getByRole('switch');
    expect(toggle).toHaveClass('h-5', 'w-9');

    rerender(<FeatureToggle enabled={false} onToggle={mockOnToggle} size="md" />);
    toggle = screen.getByRole('switch');
    expect(toggle).toHaveClass('h-6', 'w-11');

    rerender(<FeatureToggle enabled={false} onToggle={mockOnToggle} size="lg" />);
    toggle = screen.getByRole('switch');
    expect(toggle).toHaveClass('h-7', 'w-12');
  });

  it('should apply custom className', () => {
    const customClass = 'my-custom-class';
    const { container } = render(
      <FeatureToggle enabled={false} onToggle={mockOnToggle} className={customClass} />
    );

    expect(container.firstChild).toHaveClass(customClass);
  });

  it('should have proper focus styles', () => {
    render(<FeatureToggle enabled={false} onToggle={mockOnToggle} />);

    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-primary');
  });

  it('should handle keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<FeatureToggle enabled={false} onToggle={mockOnToggle} />);

    const toggle = screen.getByRole('switch');

    // Focus on the toggle
    await user.tab();
    expect(toggle).toHaveFocus();

    // Press Enter to toggle
    await user.keyboard('{Enter}');
    expect(mockOnToggle).toHaveBeenCalledWith(true);

    vi.clearAllMocks();

    // Press Space to toggle
    await user.keyboard(' ');
    expect(mockOnToggle).toHaveBeenCalledWith(true);
  });

  it('should have proper accessibility attributes', () => {
    const label = 'Enable feature';
    render(<FeatureToggle enabled={true} onToggle={mockOnToggle} label={label} />);

    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('role', 'switch');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(toggle).toHaveAttribute('aria-label', label);

    // Check for screen reader text
    expect(screen.getByText(label, { selector: '.sr-only' })).toBeInTheDocument();
  });

  it('should handle error in onToggle gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorOnToggle = vi.fn().mockRejectedValue(new Error('Toggle failed'));
    const user = userEvent.setup();

    render(<FeatureToggle enabled={false} onToggle={errorOnToggle} />);

    const toggle = screen.getByRole('switch');

    // The component handles the error internally, so this won't throw
    await user.click(toggle);

    expect(errorOnToggle).toHaveBeenCalledWith(true);
    expect(consoleSpy).toHaveBeenCalledWith('Toggle operation failed:', expect.any(Error));

    // Should still handle the animation properly even with error
    await waitFor(
      () => {
        expect(toggle.querySelector('.animate-pulse')).not.toBeInTheDocument();
      },
      { timeout: 500 }
    );

    consoleSpy.mockRestore();
  });

  it('should show proper visual states for enabled/disabled', () => {
    const { rerender } = render(<FeatureToggle enabled={false} onToggle={mockOnToggle} />);

    let toggle = screen.getByRole('switch');
    expect(toggle).toHaveClass('bg-gray-200');

    rerender(<FeatureToggle enabled={true} onToggle={mockOnToggle} />);
    toggle = screen.getByRole('switch');
    expect(toggle).toHaveClass('bg-gradient-to-r', 'from-[#6366F1]', 'to-[#8B5CF6]');
  });

  it('should handle rapid clicking correctly', async () => {
    const user = userEvent.setup();
    render(<FeatureToggle enabled={false} onToggle={mockOnToggle} />);

    const toggle = screen.getByRole('switch');

    // Click multiple times rapidly - but the component doesn't actually prevent rapid clicking
    // It only prevents clicking during disabled/loading states
    await user.click(toggle);
    await user.click(toggle);
    await user.click(toggle);

    // Each click should call onToggle since the component isn't prevented from rapid clicks
    // The actual behavior shows all clicks go through
    expect(mockOnToggle).toHaveBeenCalledTimes(3);
  });
});
