import { integrationsApi } from '@/lib/api-client/integrations/slack';

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
    // Use NGROK_URL if available for OAuth flow, otherwise use relative URL
    const ngrokUrl = import.meta.env.VITE_NGROK_URL;
    const baseUrl = ngrokUrl || '';
    const oauthUrl = `${baseUrl}/slack/oauth/start?orgId=${orgId}`;
    popup.location = oauthUrl;

    // Monitor the popup for completion
    let wasHandled = false;

    const checkClosed = setInterval(async () => {
      try {
        if (popup.closed) {
          clearInterval(checkClosed);

          // Don't call onError if we've already handled the result
          // The popup might close naturally after success
          if (!wasHandled) {
            // Last-chance detection: check if integration exists now
            try {
              const integrations = await integrationsApi.getSlackIntegrations();
              if (integrations.length > 0) {
                wasHandled = true;
                onSuccess?.();
              } else {
                // No integration detected – treat as cancellation and inform the user
                wasHandled = true;
                onError?.('Slack connection was canceled before completion');
              }
            } catch {
              // Ignore API errors during polling
            }
          }
        }
      } catch {
        // Cross-origin error means popup is still open on Slack domain
      }
    }, 1000);

    // Set up message listener for proper success/error handling
    const handleMessage = (event: MessageEvent) => {
      // Only accept messages from the popup we opened. This avoids fragile origin checks
      const isFromPopup = event.source === popup;
      if (!isFromPopup) {
        return;
      }

      if (event.data?.type === 'slack-oauth-callback') {
        wasHandled = true;
        clearInterval(checkClosed);
        window.removeEventListener('message', handleMessage);

        if (event.data.success) {
          try {
            popup.close();
          } catch {
            // Ignore errors when closing popup
          }
          onSuccess?.();
        } else {
          try {
            popup.close();
          } catch {
            // Ignore errors when closing popup
          }
          onError?.(event.data.message || 'OAuth authentication failed');
        }
      }
    };

    window.addEventListener('message', handleMessage);

    // Fallback: poll backend for integration presence in case postMessage is blocked
    const fallbackStart = Date.now();
    const fallbackPoll = setInterval(async () => {
      if (wasHandled) {
        clearInterval(fallbackPoll);
        return;
      }

      const elapsed = Date.now() - fallbackStart;
      // Stop polling after 45 seconds
      if (elapsed > 45_000) {
        clearInterval(fallbackPoll);
        if (!wasHandled) {
          wasHandled = true;
          try {
            popup.close();
          } catch {
            // Ignore errors when closing popup
          }
          onError?.('Slack connection timed out');
        }
        return;
      }

      try {
        const integrations = await integrationsApi.getSlackIntegrations();
        if (integrations.length > 0) {
          wasHandled = true;
          clearInterval(checkClosed);
          clearInterval(fallbackPoll);
          window.removeEventListener('message', handleMessage);
          try {
            popup.close();
          } catch {
            // Ignore errors when closing popup
          }
          onSuccess?.();
        }
      } catch {
        // Ignore transient errors during polling
      }
    }, 1200);

    // Cleanup if window is still open after 10 minutes
    setTimeout(
      () => {
        clearInterval(checkClosed);
        try {
          clearInterval(fallbackPoll);
        } catch {
          // Ignore errors when clearing interval
        }
        window.removeEventListener('message', handleMessage);
        if (!popup.closed) {
          popup.close();
          if (!wasHandled) {
            onError?.('OAuth flow timed out');
          }
        }
      },
      10 * 60 * 1000
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start OAuth flow';
    onError?.(message);
    // Don't show toast here - let the onError callback handle it
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
