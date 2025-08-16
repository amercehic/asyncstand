'use client';

import { toast } from 'sonner';
import { ModernButton } from '@/components/ui';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Heart,
  Mail,
  Settings,
  Trash2,
  Upload,
} from 'lucide-react';

export function ToastDemo() {
  const showSuccessToast = () => {
    toast.success('Account created successfully!', {
      description: 'Welcome to our platform. You can now access all features.',
      duration: 4000,
      icon: <CheckCircle className="w-5 h-5 text-green-500" />,
    });
  };

  const showErrorToast = () => {
    toast.error('Failed to save changes', {
      description: 'There was an error saving your data. Please try again.',
      duration: 5000,
      icon: <XCircle className="w-5 h-5 text-red-500" />,
      action: {
        label: 'Retry',
        onClick: () => toast.info('Retrying...'),
      },
    });
  };

  const showWarningToast = () => {
    toast.warning('Storage space running low', {
      description: 'You have less than 100MB of storage remaining.',
      duration: 6000,
      icon: <AlertTriangle className="w-5 h-5 text-orange-500" />,
      action: {
        label: 'Upgrade',
        onClick: () => toast.success('Redirecting to upgrade page...'),
      },
    });
  };

  const showInfoToast = () => {
    toast.info('New features available', {
      description: 'Check out the latest updates in your dashboard.',
      duration: 4000,
      icon: <Info className="w-5 h-5 text-blue-500" />,
    });
  };

  const showCustomToast = () => {
    toast.custom(t => (
      <div className="flex items-center gap-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4 rounded-lg shadow-lg min-w-80">
        <Heart className="w-6 h-6 text-white animate-pulse" />
        <div className="flex-1">
          <p className="font-medium">You're awesome!</p>
          <p className="text-sm opacity-90">Thanks for being part of our community.</p>
        </div>
        <button
          onClick={() => toast.dismiss(t)}
          className="text-white/80 hover:text-white transition-colors"
        >
          ×
        </button>
      </div>
    ));
  };

  const showPromiseToast = () => {
    const promise = new Promise<{ data: string }>(resolve => {
      setTimeout(() => resolve({ data: 'File uploaded successfully!' }), 3000);
    });

    toast.promise(promise, {
      loading: (
        <div className="flex items-center gap-2">
          <Upload className="w-4 h-4 animate-spin" />
          Uploading file...
        </div>
      ),
      success: (data: { data: string }) => (
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-500" />
          {data.data}
        </div>
      ),
      error: 'Upload failed',
    });
  };

  const showLoadingToast = () => {
    const toastId = toast.loading('Processing your request...', {
      description: 'This may take a few seconds',
    });

    setTimeout(() => {
      toast.success('Request completed!', {
        id: toastId,
        description: 'Your data has been processed successfully.',
      });
    }, 2500);
  };

  const showActionToast = () => {
    toast('File moved to trash', {
      description: 'The file has been moved to trash bin.',
      icon: <Trash2 className="w-4 h-4 text-gray-500" />,
      action: {
        label: 'Undo',
        onClick: () => toast.success('File restored!'),
      },
    });
  };

  const showRichToast = () => {
    toast.custom(t => (
      <div className="w-96 p-0 overflow-hidden shadow-lg border-0 bg-card rounded-lg">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 text-white">
          <div className="flex items-center gap-3">
            <Mail className="w-6 h-6" />
            <div>
              <h4 className="font-medium">New message received</h4>
              <p className="text-sm text-blue-100">From: john@example.com</p>
            </div>
          </div>
        </div>
        <div className="p-4">
          <p className="text-sm text-muted-foreground mb-3">
            "Hey! I wanted to follow up on our conversation about the project timeline..."
          </p>
          <div className="flex gap-2">
            <ModernButton
              size="sm"
              onClick={() => {
                toast.dismiss(t);
                toast.success('Message marked as read');
              }}
            >
              Read
            </ModernButton>
            <ModernButton size="sm" variant="outline" onClick={() => toast.dismiss(t)}>
              Dismiss
            </ModernButton>
          </div>
        </div>
      </div>
    ));
  };

  const showMultipleToasts = () => {
    toast.success('Task 1 completed');
    setTimeout(() => toast.success('Task 2 completed'), 500);
    setTimeout(() => toast.success('Task 3 completed'), 1000);
    setTimeout(() => toast.info('All tasks finished!'), 1500);
  };

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          Modern Toast Messages
        </h1>
        <p className="text-muted-foreground">
          Beautiful, animated notifications for your application
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-6 space-y-4 bg-card rounded-lg border">
          <div className="space-y-2">
            <h3 className="font-medium flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Success Messages
            </h3>
            <p className="text-sm text-muted-foreground">Celebrate successful actions</p>
          </div>
          <ModernButton onClick={showSuccessToast} className="w-full">
            Show Success
          </ModernButton>
        </div>

        <div className="p-6 space-y-4 bg-card rounded-lg border">
          <div className="space-y-2">
            <h3 className="font-medium flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" />
              Error Messages
            </h3>
            <p className="text-sm text-muted-foreground">Handle errors gracefully</p>
          </div>
          <ModernButton onClick={showErrorToast} variant="destructive" className="w-full">
            Show Error
          </ModernButton>
        </div>

        <div className="p-6 space-y-4 bg-card rounded-lg border">
          <div className="space-y-2">
            <h3 className="font-medium flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Warning Messages
            </h3>
            <p className="text-sm text-muted-foreground">Important alerts for users</p>
          </div>
          <ModernButton onClick={showWarningToast} variant="outline" className="w-full">
            Show Warning
          </ModernButton>
        </div>

        <div className="p-6 space-y-4 bg-card rounded-lg border">
          <div className="space-y-2">
            <h3 className="font-medium flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-500" />
              Info Messages
            </h3>
            <p className="text-sm text-muted-foreground">Helpful information</p>
          </div>
          <ModernButton onClick={showInfoToast} variant="secondary" className="w-full">
            Show Info
          </ModernButton>
        </div>

        <div className="p-6 space-y-4 bg-card rounded-lg border">
          <div className="space-y-2">
            <h3 className="font-medium flex items-center gap-2">
              <Heart className="w-5 h-5 text-pink-500" />
              Custom Design
            </h3>
            <p className="text-sm text-muted-foreground">Fully customizable toasts</p>
          </div>
          <ModernButton
            onClick={showCustomToast}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
          >
            Show Custom
          </ModernButton>
        </div>

        <div className="p-6 space-y-4 bg-card rounded-lg border">
          <div className="space-y-2">
            <h3 className="font-medium flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-500" />
              Promise Toasts
            </h3>
            <p className="text-sm text-muted-foreground">Loading states and results</p>
          </div>
          <ModernButton onClick={showPromiseToast} variant="outline" className="w-full">
            Show Promise
          </ModernButton>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-6 space-y-4 bg-card rounded-lg border">
          <div className="space-y-2">
            <h3 className="font-medium flex items-center gap-2">
              <Settings className="w-5 h-5 text-gray-500" />
              Loading Toast
            </h3>
            <p className="text-sm text-muted-foreground">Show progress and completion</p>
          </div>
          <ModernButton onClick={showLoadingToast} variant="outline" className="w-full">
            Show Loading
          </ModernButton>
        </div>

        <div className="p-6 space-y-4 bg-card rounded-lg border">
          <div className="space-y-2">
            <h3 className="font-medium flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-gray-500" />
              Action Toast
            </h3>
            <p className="text-sm text-muted-foreground">Includes action buttons</p>
          </div>
          <ModernButton onClick={showActionToast} variant="outline" className="w-full">
            Show Action
          </ModernButton>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-6 space-y-4 bg-card rounded-lg border">
          <div className="space-y-2">
            <h3 className="font-medium flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" />
              Rich Content
            </h3>
            <p className="text-sm text-muted-foreground">Complex layouts and content</p>
          </div>
          <ModernButton onClick={showRichToast} className="w-full">
            Show Rich Toast
          </ModernButton>
        </div>

        <div className="p-6 space-y-4 bg-card rounded-lg border">
          <div className="space-y-2">
            <h3 className="font-medium">Multiple Toasts</h3>
            <p className="text-sm text-muted-foreground">Sequential notifications</p>
          </div>
          <ModernButton onClick={showMultipleToasts} variant="outline" className="w-full">
            Show Multiple
          </ModernButton>
        </div>
      </div>

      <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="text-center space-y-4">
          <h3 className="font-medium text-lg">Ready to integrate?</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            These toast messages are built with Sonner and fully customizable. Copy the patterns you
            like and adapt them to your needs.
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <ModernButton size="sm" onClick={showSuccessToast}>
              ✨ Try Success
            </ModernButton>
            <ModernButton size="sm" variant="outline" onClick={showCustomToast}>
              🎨 Try Custom
            </ModernButton>
            <ModernButton size="sm" variant="secondary" onClick={showRichToast}>
              📧 Try Rich
            </ModernButton>
          </div>
        </div>
      </div>
    </div>
  );
}
