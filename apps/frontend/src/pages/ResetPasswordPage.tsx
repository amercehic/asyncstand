import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, CheckCircle2, AlertCircle, Shield, ArrowLeft } from 'lucide-react';
import { ModernButton, toast } from '@/components/ui';
import { authApi } from '@/lib/api';

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  // Get token and email from URL params
  const token = searchParams.get('token');
  const email = searchParams.get('email');

  // Password validation states
  const [passwordValidation, setPasswordValidation] = useState({
    minLength: false,
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    hasSpecialChar: false,
  });

  useEffect(() => {
    // Check if token and email are present
    if (!token || !email) {
      toast.error('Invalid reset link', {
        richContent: {
          title: 'Invalid or Expired Link',
          description: 'Please request a new password reset',
        },
      });
      navigate('/forgot-password');
    }
  }, [token, email, navigate]);

  useEffect(() => {
    // Validate password requirements
    setPasswordValidation({
      minLength: password.length >= 8,
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    });
  }, [password]);

  const isPasswordValid = Object.values(passwordValidation).every(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (!isPasswordValid) {
      setError('Password does not meet all requirements');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!token || !email) {
      setError('Invalid reset link');
      return;
    }

    setIsLoading(true);

    try {
      await authApi.resetPassword(token, password, email);
      setIsSuccess(true);
      toast.success('Password reset successful!', {
        richContent: {
          title: 'Password Changed',
          description: 'You can now login with your new password',
        },
      });

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errorMessage = (err as any)?.response?.data?.message || 'Failed to reset password';
      setError(errorMessage);
      toast.error(errorMessage);

      // If token is expired or invalid, redirect to forgot password
      if (errorMessage.includes('expired') || errorMessage.includes('invalid')) {
        setTimeout(() => {
          navigate('/forgot-password');
        }, 3000);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md mx-auto"
        >
          <div className="bg-card/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-border p-6 sm:p-8">
            {/* Success Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </motion.div>

            {/* Success Message */}
            <h2 className="text-2xl font-bold text-center mb-3">Password Reset Successful!</h2>
            <p className="text-muted-foreground text-center mb-6">
              Your password has been changed successfully. Redirecting to login...
            </p>

            {/* Manual Login Button */}
            <Link to="/login">
              <ModernButton variant="primary" className="w-full">
                Go to Login
              </ModernButton>
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md mx-auto"
      >
        <div className="bg-card/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-border p-6 sm:p-8">
          {/* Logo/Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center mb-8"
          >
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Reset Your Password</h1>
            <p className="text-muted-foreground mt-2">
              Choose a strong password to secure your account
            </p>
          </motion.div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* New Password Field */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                New Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="Enter new password"
                  className={`w-full px-4 py-3 pr-12 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all ${
                    error && !isPasswordValid ? 'border-red-500' : 'border-border'
                  }`}
                  disabled={isLoading}
                  autoComplete="new-password"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </motion.div>

            {/* Password Requirements */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 }}
              className="bg-muted/50 rounded-lg p-3 space-y-2"
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
            </motion.div>

            {/* Confirm Password Field */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => {
                    setConfirmPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="Confirm new password"
                  className={`w-full px-4 py-3 pr-12 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all ${
                    error && password !== confirmPassword ? 'border-red-500' : 'border-border'
                  }`}
                  disabled={isLoading}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-red-500 text-sm mt-2"
                >
                  Passwords do not match
                </motion.p>
              )}
            </motion.div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/10 border border-red-500/20 rounded-lg p-3"
              >
                <p className="text-red-500 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </p>
              </motion.div>
            )}

            {/* Submit Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <ModernButton
                type="submit"
                variant="primary"
                className="w-full"
                disabled={isLoading || !isPasswordValid || password !== confirmPassword}
                isLoading={isLoading}
              >
                {isLoading ? 'Resetting...' : 'Reset Password'}
              </ModernButton>
            </motion.div>
          </form>

          {/* Back to Login */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-6 text-center"
          >
            <Link
              to="/login"
              className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

// Password Requirement Component
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
