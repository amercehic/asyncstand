import React from 'react';
import { ModernButton } from '@/components/ui';
import { toast } from '@/components/ui';
import { Zap, Bell, Gift } from 'lucide-react';

export const ToastDemo: React.FC = () => {
  const demoApiCall = () => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        return Math.random() > 0.7 ? reject(new Error('Network error')) : resolve('Success!');
      }, 2000);
    });
  };

  const demoProgressToast = () => {
    let progress = 0;
    const toastId = toast.loading('Uploading file...', {
      progress: 0,
      persistent: true,
    });

    const interval = setInterval(() => {
      progress += Math.random() * 20;
      if (progress >= 100) {
        clearInterval(interval);
        toast.dismiss(toastId);
        toast.success('Upload completed!', {
          action: {
            label: 'View file',
            onClick: () => toast.info('File viewer opened!'),
          },
        });
      } else {
        console.log(`Progress: ${progress}%`);
      }
    }, 300);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Modern Toast Showcase</h2>
        <p className="text-muted-foreground mb-6">
          Try out our modern toast notification system with enhanced visuals and interactions.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Basic Toasts */}
        <div className="space-y-3">
          <h3 className="font-semibold text-lg">Basic Types</h3>
          <ModernButton
            variant="outline"
            onClick={() => toast.success('Operation completed successfully!')}
            className="w-full"
          >
            Success Toast
          </ModernButton>

          <ModernButton
            variant="outline"
            onClick={() => toast.error('Something went wrong. Please try again.')}
            className="w-full"
          >
            Error Toast
          </ModernButton>

          <ModernButton
            variant="outline"
            onClick={() => toast.warning('Please review your settings before continuing.')}
            className="w-full"
          >
            Warning Toast
          </ModernButton>

          <ModernButton
            variant="outline"
            onClick={() => toast.info('New updates are available for download.')}
            className="w-full"
          >
            Info Toast
          </ModernButton>

          <ModernButton
            variant="outline"
            onClick={() => toast.loading('Processing your request...', { persistent: true })}
            className="w-full"
          >
            Loading Toast
          </ModernButton>
        </div>

        {/* Rich Content Toasts */}
        <div className="space-y-3">
          <h3 className="font-semibold text-lg">Rich Content</h3>

          <ModernButton
            variant="outline"
            onClick={() => toast.teamCreated('Design Team')}
            className="w-full"
          >
            Team Created
          </ModernButton>

          <ModernButton
            variant="outline"
            onClick={() => toast.memberAdded('Alice Johnson', 'Development Team')}
            className="w-full"
          >
            Member Added
          </ModernButton>

          <ModernButton
            variant="outline"
            onClick={() => toast.integrationConnected('Slack')}
            className="w-full"
          >
            Integration Connected
          </ModernButton>

          <ModernButton
            variant="outline"
            onClick={() => toast.standupCompleted(85)}
            className="w-full"
          >
            Standup Completed
          </ModernButton>

          <ModernButton
            variant="outline"
            onClick={() => toast.favorite('Added to favorites', true)}
            className="w-full"
          >
            Favorite Toggle
          </ModernButton>
        </div>

        {/* Interactive Toasts */}
        <div className="space-y-3">
          <h3 className="font-semibold text-lg">Interactive</h3>

          <ModernButton
            variant="outline"
            onClick={() =>
              toast.success('Changes saved!', {
                action: {
                  label: 'Undo',
                  onClick: () => toast.info('Changes undone!'),
                },
              })
            }
            className="w-full"
          >
            With Action Button
          </ModernButton>

          <ModernButton
            variant="outline"
            onClick={() =>
              toast.info('You have 3 new notifications', {
                icon: <Bell className="w-5 h-5 text-blue-500" />,
                action: {
                  label: 'View all',
                  onClick: () => toast.success('Notifications opened!'),
                },
                persistent: true,
              })
            }
            className="w-full"
          >
            Persistent Toast
          </ModernButton>

          <ModernButton
            variant="outline"
            onClick={() =>
              toast.success('Gift sent successfully!', {
                icon: <Gift className="w-5 h-5 text-green-500" />,
                richContent: {
                  title: 'Gift Delivered',
                  description: 'Your gift has been sent to John Doe',
                  avatar: 'J',
                  metadata: '2 min ago',
                },
                action: {
                  label: 'Track delivery',
                  onClick: () => toast.info('Tracking information: #GF123456'),
                },
              })
            }
            className="w-full"
          >
            Rich + Action
          </ModernButton>

          <ModernButton variant="outline" onClick={demoProgressToast} className="w-full">
            Progress Toast
          </ModernButton>

          <ModernButton
            variant="outline"
            onClick={() => {
              toast.promise(demoApiCall(), {
                loading: 'Connecting to server...',
                success: 'Connected successfully!',
                error: 'Connection failed. Please try again.',
              });
            }}
            className="w-full"
          >
            Promise Toast
          </ModernButton>
        </div>
      </div>

      {/* Controls */}
      <div className="pt-6 border-t border-border">
        <h3 className="font-semibold text-lg mb-3">Controls</h3>
        <div className="flex gap-3">
          <ModernButton variant="secondary" onClick={() => toast.dismissAll()}>
            Dismiss All
          </ModernButton>

          <ModernButton
            variant="ghost"
            onClick={() =>
              toast.info('Toast notifications are working perfectly!', {
                richContent: {
                  title: 'System Status',
                  description: 'All notification systems are operational',
                  metadata: 'Last checked: Just now',
                },
                icon: <Zap className="w-5 h-5 text-blue-500" />,
              })
            }
          >
            Test System
          </ModernButton>
        </div>
      </div>
    </div>
  );
};
