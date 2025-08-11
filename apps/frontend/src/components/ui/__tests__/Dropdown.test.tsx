import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils';
import React from 'react';
import { Settings, Eye, Trash2 } from 'lucide-react';

import { Dropdown } from '@/components/ui/Dropdown';

describe('Dropdown', () => {
  const mockItems = [
    {
      label: 'View Details',
      icon: Eye,
      onClick: vi.fn(),
    },
    {
      label: 'Settings',
      icon: Settings,
      onClick: vi.fn(),
    },
    {
      label: 'Delete',
      icon: Trash2,
      onClick: vi.fn(),
      variant: 'destructive' as const,
    },
  ];

  const TriggerButton = () => <button data-testid="dropdown-trigger">Actions</button>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders trigger button', () => {
    render(<Dropdown trigger={<TriggerButton />} items={mockItems} />);

    expect(screen.getByTestId('dropdown-trigger')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('initially hides dropdown menu', () => {
    render(<Dropdown trigger={<TriggerButton />} items={mockItems} />);

    expect(screen.queryByText('View Details')).not.toBeInTheDocument();
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('shows dropdown menu when trigger is clicked', async () => {
    render(<Dropdown trigger={<TriggerButton />} items={mockItems} />);

    fireEvent.click(screen.getByTestId('dropdown-trigger'));

    await waitFor(() => {
      expect(screen.getByText('View Details')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });
  });

  it('hides dropdown menu when trigger is clicked again', async () => {
    render(<Dropdown trigger={<TriggerButton />} items={mockItems} />);

    // First click to open
    fireEvent.click(screen.getByTestId('dropdown-trigger'));
    await waitFor(() => {
      expect(screen.getByText('View Details')).toBeInTheDocument();
    });

    // Second click to close
    fireEvent.click(screen.getByTestId('dropdown-trigger'));
    await waitFor(() => {
      expect(screen.queryByText('View Details')).not.toBeInTheDocument();
    });
  });

  it('renders all menu items with correct labels and icons', async () => {
    render(<Dropdown trigger={<TriggerButton />} items={mockItems} />);

    fireEvent.click(screen.getByTestId('dropdown-trigger'));

    await waitFor(() => {
      expect(screen.getByText('View Details')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    // Check that icons are rendered (they should be in the DOM)
    const menuItems = screen.getAllByRole('button');
    expect(menuItems).toHaveLength(4); // 1 trigger + 3 menu items
  });

  it('calls onClick handler when menu item is clicked', async () => {
    render(<Dropdown trigger={<TriggerButton />} items={mockItems} />);

    fireEvent.click(screen.getByTestId('dropdown-trigger'));

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Settings'));

    expect(mockItems[1].onClick).toHaveBeenCalledTimes(1);
  });

  it('closes dropdown menu after menu item is clicked', async () => {
    render(<Dropdown trigger={<TriggerButton />} items={mockItems} />);

    fireEvent.click(screen.getByTestId('dropdown-trigger'));

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Settings'));

    await waitFor(() => {
      expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    });
  });

  it('applies destructive styling to destructive variant items', async () => {
    render(<Dropdown trigger={<TriggerButton />} items={mockItems} />);

    fireEvent.click(screen.getByTestId('dropdown-trigger'));

    await waitFor(() => {
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    const deleteButton = screen.getByText('Delete');
    expect(deleteButton).toHaveClass('text-red-600');
    expect(deleteButton).toHaveClass('hover:text-red-700');
  });

  it('applies correct alignment class for left alignment', async () => {
    render(<Dropdown trigger={<TriggerButton />} items={mockItems} align="left" />);

    fireEvent.click(screen.getByTestId('dropdown-trigger'));

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    // Check that the dropdown container has left alignment
    const dropdownMenu = screen.getByText('Settings').closest('div');
    expect(dropdownMenu?.parentElement).toHaveClass('left-0');
  });

  it('applies correct alignment class for right alignment (default)', async () => {
    render(<Dropdown trigger={<TriggerButton />} items={mockItems} />);

    fireEvent.click(screen.getByTestId('dropdown-trigger'));

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    // Check that the dropdown container has right alignment (default)
    const dropdownMenu = screen.getByText('Settings').closest('div');
    expect(dropdownMenu?.parentElement).toHaveClass('right-0');
  });

  it('closes dropdown when clicking outside', async () => {
    render(
      <div>
        <div data-testid="outside-element">Outside</div>
        <Dropdown trigger={<TriggerButton />} items={mockItems} />
      </div>
    );

    fireEvent.click(screen.getByTestId('dropdown-trigger'));

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    fireEvent.mouseDown(screen.getByTestId('outside-element'));

    await waitFor(() => {
      expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    });
  });

  it('prevents event propagation on trigger click', () => {
    const parentClickHandler = vi.fn();

    render(
      <div onClick={parentClickHandler} data-testid="parent">
        <Dropdown trigger={<TriggerButton />} items={mockItems} />
      </div>
    );

    fireEvent.click(screen.getByTestId('dropdown-trigger'));

    // Parent click handler should not be called due to stopPropagation
    expect(parentClickHandler).not.toHaveBeenCalled();
  });

  it('prevents event propagation on menu item click', async () => {
    const parentClickHandler = vi.fn();

    render(
      <div onClick={parentClickHandler} data-testid="parent">
        <Dropdown trigger={<TriggerButton />} items={mockItems} />
      </div>
    );

    fireEvent.click(screen.getByTestId('dropdown-trigger'));

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Settings'));

    // Parent click handler should not be called due to stopPropagation
    expect(parentClickHandler).not.toHaveBeenCalled();
  });

  it('handles empty items array gracefully', async () => {
    render(<Dropdown trigger={<TriggerButton />} items={[]} />);

    fireEvent.click(screen.getByTestId('dropdown-trigger'));

    // Should not crash and dropdown should be empty
    await waitFor(() => {
      const dropdownItems = screen.queryAllByRole('button');
      expect(dropdownItems).toHaveLength(1); // Only the trigger button
    });
  });

  it('renders items without icons correctly', async () => {
    const itemsWithoutIcons = [
      {
        label: 'Option 1',
        onClick: vi.fn(),
      },
      {
        label: 'Option 2',
        onClick: vi.fn(),
      },
    ];

    render(<Dropdown trigger={<TriggerButton />} items={itemsWithoutIcons} />);

    fireEvent.click(screen.getByTestId('dropdown-trigger'));

    await waitFor(() => {
      expect(screen.getByText('Option 1')).toBeInTheDocument();
      expect(screen.getByText('Option 2')).toBeInTheDocument();
    });
  });
});
