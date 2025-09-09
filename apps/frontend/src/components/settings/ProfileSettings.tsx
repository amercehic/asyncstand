import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Crown, Edit2, Save, X, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';
import { ModernButton, toast } from '@/components/ui';
import { authApi } from '@/lib/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  updatedAt: string;
}

interface ProfileSettingsProps {
  user: User | null;
  onUserUpdate: () => void;
}

interface PasswordValidation {
  minLength: boolean;
  hasUpperCase: boolean;
  hasLowerCase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
}

const PasswordRequirement: React.FC<{ met: boolean; text: string }> = ({ met, text }) => (
  <div className="flex items-center gap-1.5">
    <div
      className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${
        met ? 'bg-green-500' : 'bg-muted-foreground/20'
      }`}
    >
      {met && <CheckCircle2 className="w-3 h-3 text-white" />}
    </div>
    <span className={`text-xs ${met ? 'text-green-600' : 'text-muted-foreground'}`}>{text}</span>
  </div>
);

export const ProfileSettings = React.memo<ProfileSettingsProps>(({ user, onUserUpdate }) => {
  // Password update state
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Password validation states
  const [passwordValidation, setPasswordValidation] = useState<PasswordValidation>({
    minLength: false,
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    hasSpecialChar: false,
  });

  // Validate password requirements
  useEffect(() => {
    setPasswordValidation({
      minLength: passwordForm.newPassword.length >= 8,
      hasUpperCase: /[A-Z]/.test(passwordForm.newPassword),
      hasLowerCase: /[a-z]/.test(passwordForm.newPassword),
      hasNumber: /\d/.test(passwordForm.newPassword),
      hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(passwordForm.newPassword),
    });
  }, [passwordForm.newPassword]);

  const isPasswordValid = Object.values(passwordValidation).every(Boolean);

  const handlePasswordUpdate = async () => {
    // Validation
    if (!passwordForm.currentPassword.trim()) {
      toast.error('Please enter your current password');
      return;
    }

    if (!passwordForm.newPassword.trim()) {
      toast.error('Please enter a new password');
      return;
    }

    if (!isPasswordValid) {
      toast.error('Password does not meet all requirements');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordForm.currentPassword === passwordForm.newPassword) {
      toast.error('New password must be different from current password');
      return;
    }

    try {
      setIsUpdatingPassword(true);
      await authApi.updatePassword(passwordForm.currentPassword, passwordForm.newPassword);

      // Refresh user data to get updated timestamp
      await onUserUpdate();

      toast.success('Password updated successfully');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setIsChangingPassword(false);
    } catch (error: unknown) {
      console.error('Failed to update password:', error);
      const apiError = error as {
        response?: {
          data?: {
            message?: string;
            detail?: string;
            response?: {
              message?: string;
            };
          };
        };
      };

      const errorMessage =
        apiError?.response?.data?.response?.message ||
        apiError?.response?.data?.message ||
        'Failed to update password';

      toast.error(errorMessage);
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleCancelPasswordChange = () => {
    setIsChangingPassword(false);
    setPasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  return (
    <motion.div
      key="profile"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      {/* Profile Information */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
          <User className="w-5 h-5 text-primary" />
          Your Profile
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Name</label>
            <input
              type="text"
              value={user?.name || ''}
              disabled
              className="w-full px-3 py-2 bg-background border border-border rounded-lg opacity-50 cursor-not-allowed"
              data-testid="profile-name-input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Email</label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full px-3 py-2 bg-background border border-border rounded-lg opacity-50 cursor-not-allowed"
              data-testid="profile-email-input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Role</label>
            <div className="flex items-center gap-2" data-testid="profile-role">
              {user?.role === 'owner' && <Crown className="w-4 h-4 text-yellow-500" />}
              <span className="capitalize">{user?.role}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Password Update */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">Password</h3>
          {!isChangingPassword && (
            <ModernButton
              variant="outline"
              onClick={() => setIsChangingPassword(true)}
              className="gap-2"
              data-testid="change-password-button"
            >
              <Edit2 className="w-4 h-4" />
              Change Password
            </ModernButton>
          )}
        </div>

        {isChangingPassword ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={passwordForm.currentPassword}
                  onChange={e =>
                    setPasswordForm(prev => ({
                      ...prev,
                      currentPassword: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 pr-10 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Enter your current password"
                  data-testid="current-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="toggle-current-password"
                >
                  {showCurrentPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={passwordForm.newPassword}
                  onChange={e =>
                    setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))
                  }
                  className="w-full px-3 py-2 pr-10 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Enter a new password (min 8 characters)"
                  minLength={8}
                  data-testid="new-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="toggle-new-password"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Password Requirements */}
              <div
                className="mt-3 bg-muted/50 rounded-lg p-3 space-y-2"
                data-testid="password-requirements"
              >
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Password Requirements:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <PasswordRequirement met={passwordValidation.minLength} text="8+ characters" />
                  <PasswordRequirement
                    met={passwordValidation.hasUpperCase}
                    text="Uppercase letter"
                  />
                  <PasswordRequirement
                    met={passwordValidation.hasLowerCase}
                    text="Lowercase letter"
                  />
                  <PasswordRequirement met={passwordValidation.hasNumber} text="Number" />
                  <PasswordRequirement
                    met={passwordValidation.hasSpecialChar}
                    text="Special character"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={passwordForm.confirmPassword}
                  onChange={e =>
                    setPasswordForm(prev => ({
                      ...prev,
                      confirmPassword: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 pr-10 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Confirm your new password"
                  data-testid="confirm-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="toggle-confirm-password"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {passwordForm.confirmPassword &&
                passwordForm.newPassword !== passwordForm.confirmPassword && (
                  <p
                    className="text-xs text-destructive mt-1"
                    data-testid="password-mismatch-error"
                  >
                    Passwords do not match
                  </p>
                )}
            </div>

            <div className="flex gap-3 pt-2">
              <ModernButton
                onClick={handlePasswordUpdate}
                disabled={
                  isUpdatingPassword ||
                  !isPasswordValid ||
                  passwordForm.newPassword !== passwordForm.confirmPassword ||
                  !passwordForm.currentPassword.trim()
                }
                className="gap-2"
                data-testid="update-password-button"
              >
                {isUpdatingPassword ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Update Password
              </ModernButton>
              <ModernButton
                variant="outline"
                onClick={handleCancelPasswordChange}
                disabled={isUpdatingPassword}
                data-testid="cancel-password-button"
              >
                <X className="w-4 h-4" />
                Cancel
              </ModernButton>
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground" data-testid="password-info">
            <p className="text-sm">
              Keep your account secure by using a strong password and changing it regularly.
            </p>
            <p className="text-xs mt-2">
              Last updated:{' '}
              {user?.updatedAt
                ? (() => {
                    // Ensure the timestamp is properly treated as UTC
                    const utcDate = new Date(
                      user.updatedAt.endsWith('Z') ? user.updatedAt : user.updatedAt + 'Z'
                    );

                    return utcDate.toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZoneName: 'short',
                    });
                  })()
                : 'Unknown'}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
});

ProfileSettings.displayName = 'ProfileSettings';
