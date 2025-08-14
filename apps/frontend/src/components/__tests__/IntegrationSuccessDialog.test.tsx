import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { IntegrationSuccessDialog } from '@/components/IntegrationSuccessDialog';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.ComponentProps<'div'>) => <div {...props}>{children}</div>,
    circle: ({ children, ...props }: React.ComponentProps<'circle'>) => (
      <circle {...props}>{children}</circle>
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => children,
}));

// Mock the SlackIcon component
vi.mock('@/components/icons/IntegrationIcons', () => ({
  SlackIcon: ({ className, size }: { className?: string; size?: number }) => (
    <div data-testid="slack-icon" className={className} data-size={size}>
      SlackIcon
    </div>
  ),
}));

describe('IntegrationSuccessDialog', () => {
  const mockOnClose = vi.fn();
  const mockOnConfigure = vi.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    integration: {
      name: 'Slack',
      type: 'slack' as const,
      workspaceName: 'Test Workspace',
    },
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog when open', () => {
    render(<IntegrationSuccessDialog {...defaultProps} />);

    expect(screen.getByText('Slack Connected!')).toBeInTheDocument();
    expect(screen.getByText('Test Workspace')).toBeInTheDocument();
    expect(screen.getByText(/workspace is now connected to AsyncStand/)).toBeInTheDocument();
    expect(
      screen.getByText(/Team members can start receiving standup notifications/)
    ).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<IntegrationSuccessDialog {...defaultProps} isOpen={false} />);

    expect(screen.queryByText('Slack Connected!')).not.toBeInTheDocument();
  });

  it('shows configure button when onConfigure is provided', () => {
    render(<IntegrationSuccessDialog {...defaultProps} onConfigure={mockOnConfigure} />);

    expect(screen.getByText('Configure Integration')).toBeInTheDocument();
  });

  it('does not show configure button when onConfigure is not provided', () => {
    render(<IntegrationSuccessDialog {...defaultProps} />);

    expect(screen.queryByText('Configure Integration')).not.toBeInTheDocument();
  });

  it('renders continue button', () => {
    render(<IntegrationSuccessDialog {...defaultProps} />);

    expect(screen.getByText('Continue')).toBeInTheDocument();
  });

  it('shows generic message when workspaceName is not provided', () => {
    render(
      <IntegrationSuccessDialog {...defaultProps} integration={{ name: 'Slack', type: 'slack' }} />
    );

    expect(screen.getByText(/Your workspace is now connected to AsyncStand/)).toBeInTheDocument();
    expect(screen.queryByText('Test Workspace')).not.toBeInTheDocument();
  });

  it('displays auto-close countdown', () => {
    render(<IntegrationSuccessDialog {...defaultProps} />);

    expect(screen.getByText(/Closing in \d+ seconds/)).toBeInTheDocument();
  });
});
