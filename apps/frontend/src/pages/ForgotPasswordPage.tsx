import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { ModernButton, toast } from '@/components/ui';
import { authApi } from '@/lib/api';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('Please enter your email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      await authApi.forgotPassword(email);
      setIsSubmitted(true);
      toast.success('Password reset email sent!', {
        richContent: {
          title: 'Check your inbox',
          description: 'We sent you instructions to reset your password',
          metadata: email,
        },
      });
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errorMessage = (err as any)?.response?.data?.message || 'Failed to send reset email';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
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
            <h2 className="text-2xl font-bold text-center mb-3">Check Your Email</h2>
            <p className="text-muted-foreground text-center mb-6">
              We've sent password reset instructions to:
            </p>
            <div className="bg-muted/50 rounded-lg p-3 mb-6">
              <p className="text-center font-medium break-all">{email}</p>
            </div>

            {/* Additional Info */}
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-700 dark:text-yellow-400 mb-1">
                    Didn't receive the email?
                  </p>
                  <ul className="text-muted-foreground space-y-1">
                    <li>• Check your spam folder</li>
                    <li>• Make sure the email address is correct</li>
                    <li>• The link expires in 24 hours</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <ModernButton
                variant="secondary"
                onClick={() => {
                  setIsSubmitted(false);
                  setEmail('');
                }}
                className="w-full"
              >
                <Mail className="w-4 h-4 mr-2" />
                Try Another Email
              </ModernButton>
              <Link to="/login" className="block">
                <ModernButton variant="ghost" className="w-full">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Login
                </ModernButton>
              </Link>
            </div>
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
              <Mail className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Forgot Password?</h1>
            <p className="text-muted-foreground mt-2">
              No worries! Enter your email and we'll send you reset instructions.
            </p>
          </motion.div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email Address
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    setError('');
                  }}
                  placeholder="you@example.com"
                  className={`w-full px-4 py-3 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all ${
                    error ? 'border-red-500' : 'border-border'
                  }`}
                  disabled={isLoading}
                  autoComplete="email"
                  autoFocus
                />
                <Mail className="absolute right-3 top-3.5 w-5 h-5 text-muted-foreground" />
              </div>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-red-500 text-sm mt-2"
                >
                  {error}
                </motion.p>
              )}
            </motion.div>

            {/* Submit Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <ModernButton
                type="submit"
                variant="primary"
                className="w-full"
                disabled={isLoading}
                isLoading={isLoading}
              >
                {isLoading ? 'Sending...' : 'Send Reset Instructions'}
              </ModernButton>
            </motion.div>
          </form>

          {/* Back to Login */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
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

        {/* Info Box */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-6 bg-card/50 backdrop-blur-sm rounded-xl border border-border p-4"
        >
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-blue-500" />
            Security Note
          </h3>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Password reset links expire after 24 hours</li>
            <li>• You'll receive an email if the account exists</li>
            <li>• Check your spam folder if you don't see the email</li>
          </ul>
        </motion.div>
      </motion.div>
    </div>
  );
};
