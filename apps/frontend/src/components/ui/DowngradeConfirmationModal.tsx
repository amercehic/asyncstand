import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  X,
  Users,
  Settings,
  Loader2,
} from 'lucide-react';
import { ModernButton } from '@/components/ui';
import type { BillingPlan, CurrentUsage } from '@/lib/api-client/billing';

interface DowngradeConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: BillingPlan;
  targetPlan: BillingPlan;
  currentUsage: CurrentUsage | null;
  onConfirm: () => Promise<void>;
  isProcessing?: boolean;
}

interface UsageWarning {
  type: 'teams' | 'members' | 'standupConfigs' | 'standupsPerMonth';
  current: number;
  newLimit: number;
  icon: React.ReactNode;
  label: string;
  severity: 'warning' | 'error';
  description: string;
}

export function DowngradeConfirmationModal({
  isOpen,
  onClose,
  currentPlan,
  targetPlan,
  currentUsage,
  onConfirm,
  isProcessing = false,
}: DowngradeConfirmationModalProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  if (!isOpen) return null;

  const formatLimit = (limit: number): string => {
    if (limit === -1 || limit === 0) return 'Unlimited';
    return limit.toString();
  };

  const getUsageWarnings = (): UsageWarning[] => {
    if (!currentUsage) return [];

    const warnings: UsageWarning[] = [];

    // Check teams
    if (targetPlan.limits.teams !== -1 && currentUsage.teams.used > targetPlan.limits.teams) {
      warnings.push({
        type: 'teams',
        current: currentUsage.teams.used,
        newLimit: targetPlan.limits.teams,
        icon: <Users className="w-4 h-4" />,
        label: 'Teams',
        severity: 'error',
        description: `You currently have ${currentUsage.teams.used} teams but the ${targetPlan.name} allows only ${targetPlan.limits.teams}.`,
      });
    }

    // Check members
    if (targetPlan.limits.members !== -1 && currentUsage.members.used > targetPlan.limits.members) {
      warnings.push({
        type: 'members',
        current: currentUsage.members.used,
        newLimit: targetPlan.limits.members,
        icon: <Users className="w-4 h-4" />,
        label: 'Team Members',
        severity: 'error',
        description: `You currently have ${currentUsage.members.used} team members but the ${targetPlan.name} allows only ${targetPlan.limits.members}.`,
      });
    }

    // Check standup configs
    if (
      targetPlan.limits.standupConfigs !== -1 &&
      currentUsage.standupConfigs.used > targetPlan.limits.standupConfigs
    ) {
      warnings.push({
        type: 'standupConfigs',
        current: currentUsage.standupConfigs.used,
        newLimit: targetPlan.limits.standupConfigs,
        icon: <Settings className="w-4 h-4" />,
        label: 'Standup Configurations',
        severity: 'error',
        description: `You currently have ${currentUsage.standupConfigs.used} standup configurations but the ${targetPlan.name} allows only ${targetPlan.limits.standupConfigs}.`,
      });
    }

    return warnings;
  };

  const usageWarnings = getUsageWarnings();
  const hasBlockingWarnings = usageWarnings.some(w => w.severity === 'error');

  const isDowngrade = targetPlan.price < currentPlan.price;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-card rounded-xl border border-border max-w-lg w-full max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-warning/10 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-warning" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  {isDowngrade ? 'Confirm Downgrade' : 'Change Plan'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {currentPlan.name} → {targetPlan.name}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Plan Comparison */}
          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="font-medium text-foreground mb-3">Plan Changes</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Current Plan</div>
                <div className="font-medium text-foreground">{currentPlan.name}</div>
                <div className="text-sm text-muted-foreground">
                  €{(currentPlan.price / 100).toFixed(2)}/month
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">New Plan</div>
                <div className="font-medium text-foreground">{targetPlan.name}</div>
                <div className="text-sm text-muted-foreground">
                  {targetPlan.price === 0
                    ? 'Free'
                    : `€${(targetPlan.price / 100).toFixed(2)}/month`}
                </div>
              </div>
            </div>
          </div>

          {/* Usage Warnings */}
          {usageWarnings.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-foreground flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                Usage Impact
              </h4>
              <div className="space-y-2">
                {usageWarnings.map((warning, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border ${
                      warning.severity === 'error'
                        ? 'bg-destructive/5 border-destructive/20'
                        : 'bg-warning/5 border-warning/20'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {warning.icon}
                      <span className="font-medium text-sm">{warning.label}</span>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          warning.severity === 'error'
                            ? 'bg-destructive/10 text-destructive'
                            : 'bg-warning/10 text-warning'
                        }`}
                      >
                        {warning.severity === 'error' ? 'Action Required' : 'Warning'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{warning.description}</p>
                    {warning.severity === 'error' && (
                      <p className="text-xs text-destructive mt-1">
                        You need to reduce your {warning.label.toLowerCase()} before downgrading.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Feature Changes */}
          <div>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              {showDetails ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              View detailed plan comparison
            </button>
            {showDetails && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="mt-3 space-y-3 overflow-hidden"
              >
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="font-medium text-foreground mb-2">Current Limits</div>
                    <div className="space-y-1 text-muted-foreground">
                      <div>Teams: {formatLimit(currentPlan.limits.teams)}</div>
                      <div>Members: {formatLimit(currentPlan.limits.members)}</div>
                      <div>Standup Configs: {formatLimit(currentPlan.limits.standupConfigs)}</div>
                      <div>
                        Monthly Standups: {formatLimit(currentPlan.limits.standupsPerMonth)}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-foreground mb-2">New Limits</div>
                    <div className="space-y-1 text-muted-foreground">
                      <div>Teams: {formatLimit(targetPlan.limits.teams)}</div>
                      <div>Members: {formatLimit(targetPlan.limits.members)}</div>
                      <div>Standup Configs: {formatLimit(targetPlan.limits.standupConfigs)}</div>
                      <div>Monthly Standups: {formatLimit(targetPlan.limits.standupsPerMonth)}</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Acknowledgment */}
          {(isDowngrade || usageWarnings.length > 0) && (
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="acknowledge"
                checked={acknowledged}
                onChange={e => setAcknowledged(e.target.checked)}
                className="mt-1"
              />
              <label htmlFor="acknowledge" className="text-sm text-muted-foreground">
                I understand the limitations and potential impact of this plan change.
                {isDowngrade && ' My billing will be adjusted at the next billing cycle.'}
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border">
          <div className="flex gap-3">
            <ModernButton variant="outline" onClick={onClose} disabled={isProcessing}>
              Cancel
            </ModernButton>
            <ModernButton
              onClick={onConfirm}
              disabled={hasBlockingWarnings || !acknowledged || isProcessing}
              className="flex items-center gap-2"
            >
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
              {isDowngrade ? 'Confirm Downgrade' : 'Change Plan'}
            </ModernButton>
          </div>
          {hasBlockingWarnings && (
            <p className="text-xs text-destructive mt-2">
              Please address the usage issues above before proceeding.
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
