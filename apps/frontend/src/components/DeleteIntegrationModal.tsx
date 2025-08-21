import { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  Button,
  Input,
} from '@/components/ui';
import { useAuth } from '@/contexts';
import type { SlackIntegration } from '@/lib/api';

interface DeleteIntegrationModalProps {
  integration: SlackIntegration | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (integrationId: string) => Promise<void>;
}

export function DeleteIntegrationModal({
  integration,
  isOpen,
  onClose,
  onConfirm,
}: DeleteIntegrationModalProps) {
  const { user } = useAuth();
  const [confirmationInput, setConfirmationInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const workspaceId = integration?.externalTeamId || '';
  const isConfirmationValid = confirmationInput === workspaceId;
  const canDelete = user?.role === 'owner';

  const handleConfirm = async () => {
    if (isConfirmationValid && integration && canDelete) {
      try {
        setIsSubmitting(true);
        await onConfirm(integration.id);
        setConfirmationInput('');
        onClose();
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setConfirmationInput('');
    onClose();
  };

  if (!integration) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md p-6 [&>button]:hidden">
        <DialogTitle className="sr-only">Delete Integration</DialogTitle>
        <DialogDescription className="sr-only">
          Confirm deletion of the Slack workspace integration by entering the workspace ID.
        </DialogDescription>

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-foreground">Delete Integration</h2>
              <p className="text-sm text-muted-foreground">This action cannot be undone</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="h-8 w-8 p-0 hover:bg-muted"
            disabled={isSubmitting}
          >
            ×
          </Button>
        </div>

        {/* Permission Check */}
        {!canDelete ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <div>
                <p className="text-sm font-medium text-yellow-800">Insufficient Permissions</p>
                <p className="text-xs text-yellow-700 mt-1">
                  Only organization owners can delete integrations.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Warning Box */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-sm font-medium text-destructive mb-3">
                This will permanently delete:
              </p>
              <ul className="space-y-2 text-sm text-destructive">
                <li className="flex items-start gap-2">
                  <span className="w-1 h-1 bg-destructive rounded-full mt-2 flex-shrink-0"></span>
                  <span>The Slack workspace integration "{workspaceId}"</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1 h-1 bg-destructive rounded-full mt-2 flex-shrink-0"></span>
                  <span>All associated teams and their configurations</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1 h-1 bg-destructive rounded-full mt-2 flex-shrink-0"></span>
                  <span>All standup schedules and responses</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1 h-1 bg-destructive rounded-full mt-2 flex-shrink-0"></span>
                  <span>All sync history and channel mappings</span>
                </li>
              </ul>
            </div>

            {/* Confirmation Section */}
            <div className="space-y-3 mb-6">
              <p className="text-sm text-foreground">Enter the workspace ID to confirm deletion:</p>
              <p className="text-sm text-muted-foreground">
                Workspace ID: <span className="font-mono">{workspaceId}</span>
              </p>
              <Input
                type="text"
                placeholder="Enter workspace ID"
                value={confirmationInput}
                onChange={e => setConfirmationInput(e.target.value)}
                className="bg-input-background"
                disabled={isSubmitting}
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={handleClose}
                className="flex-1"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirm}
                disabled={!isConfirmationValid || isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Integration
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
