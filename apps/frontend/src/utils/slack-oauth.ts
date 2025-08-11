import { toast } from 'sonner';

export interface SlackOAuthOptions {
  orgId: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

/**
 * Initiates Slack OAuth flow by opening a popup window
 */
export const startSlackOAuth = async ({ orgId, onSuccess, onError }: SlackOAuthOptions) => {
  try {
    // Open a popup window for OAuth
    const popup = window.open(
      '',
      'slack-oauth',
      'width=600,height=700,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no'
    );

    if (!popup) {
      throw new Error('Popup blocked by browser. Please allow popups for this site.');
    }

    // Start the OAuth flow - this will redirect the popup to Slack
    const oauthUrl = `/api/slack/oauth/start?orgId=${orgId}`;
    popup.location = oauthUrl;

    // Monitor the popup for completion
    let wasSuccessful = false;

    const checkClosed = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(checkClosed);

          // Only call success if we haven't already handled success/error
          if (!wasSuccessful) {
            // Since we can't reliably detect success from popup closure alone,
            // treat silent closure as a failure/cancel and notify caller
            onError?.('Authentication was cancelled or failed');
          }
        }
      } catch {
        // Cross-origin error means popup is still open on Slack domain
        console.debug('Popup still open on external domain');
      }
    }, 1000);

    // Set up message listener for proper success/error handling
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === 'slack-oauth-callback') {
        wasSuccessful = true;
        clearInterval(checkClosed);

        if (event.data.success) {
          onSuccess?.();
        } else {
          onError?.(event.data.message || 'OAuth authentication failed');
        }
      }
    };

    window.addEventListener('message', handleMessage);

    // Cleanup if window is still open after 10 minutes
    setTimeout(
      () => {
        clearInterval(checkClosed);
        window.removeEventListener('message', handleMessage);
        if (!popup.closed) {
          popup.close();
          if (!wasSuccessful) {
            onError?.('OAuth flow timed out');
          }
        }
      },
      10 * 60 * 1000
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start OAuth flow';
    onError?.(message);
    toast.error(message);
  }
};

/**
 * Handles OAuth callback and communicates with parent window
 * This would be used in a callback handler if we implement frontend-based callback handling
 */
export const handleOAuthCallback = (success: boolean, message?: string) => {
  if (window.opener) {
    // Send message to parent window
    window.opener.postMessage(
      {
        type: 'slack-oauth-callback',
        success,
        message,
      },
      window.location.origin
    );

    // Close the popup
    window.close();
  }
};

/**
 * Sets up OAuth callback message listener
 */
export const setupOAuthMessageListener = (
  onSuccess: () => void,
  onError: (message: string) => void
) => {
  const handleMessage = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;

    if (event.data?.type === 'slack-oauth-callback') {
      if (event.data.success) {
        onSuccess();
      } else {
        onError(event.data.message || 'OAuth failed');
      }
    }
  };

  window.addEventListener('message', handleMessage);

  return () => {
    window.removeEventListener('message', handleMessage);
  };
};
