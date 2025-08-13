import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ModernButton, FormField, toast } from '@/components/ui';
import { ArrowLeft, Eye, EyeOff, Github, Mail, X, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts';
import { normalizeApiError } from '@/utils';
import type { SignUpFormData, FormFieldError } from '@/types';

export const SignUpPage = React.memo(() => {
  const navigate = useNavigate();
  const { signup, isLoading: authLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState<SignUpFormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false,
  });
  const [errors, setErrors] = useState<FormFieldError>({});

  const passwordRequirements = [
    { text: 'At least 8 characters', test: (pwd: string) => pwd.length >= 8 },
    { text: 'Contains uppercase letter', test: (pwd: string) => /[A-Z]/.test(pwd) },
    { text: 'Contains lowercase letter', test: (pwd: string) => /[a-z]/.test(pwd) },
    { text: 'Contains number', test: (pwd: string) => /\d/.test(pwd) },
    { text: 'Contains special character', test: (pwd: string) => /[@$!%*?&]/.test(pwd) },
  ];

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Full name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    const unmetRequirements = passwordRequirements.filter(req => !req.test(formData.password));
    if (unmetRequirements.length > 0) {
      newErrors.password = 'Password does not meet all requirements';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!formData.agreeToTerms) {
      newErrors.terms = 'You must agree to the terms and conditions';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the errors below');
      return;
    }

    try {
      toast.loading('Creating your account...', { id: 'signup' });
      await signup({
        name: formData.name,
        email: formData.email,
        password: formData.password,
      });
      toast.success('Account created successfully! Welcome to AsyncStand!', { id: 'signup' });
      navigate('/dashboard');
    } catch (error) {
      const { message } = normalizeApiError(error, 'Something went wrong. Please try again.');
      toast.error(message, { id: 'signup' });
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleSocialSignup = (provider: string) => {
    toast.info(`${provider} signup coming soon!`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        {/* Back button */}
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-smooth mb-8 group"
          data-testid="back-to-home-button"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-200" />
          Back to home
        </motion.button>

        {/* Signup Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-border rounded-2xl p-8 shadow-card"
        >
          <div className="text-center mb-8">
            <div className="text-2xl font-semibold gradient-text mb-2">AsyncStand</div>
            <h1 className="text-2xl mb-2 font-light">Create your account</h1>
            <p className="text-muted-foreground">
              Join thousands of teams already using AsyncStand
            </p>
          </div>

          {/* Social Signup */}
          <div className="space-y-3 mb-6">
            <ModernButton
              variant="secondary"
              className="w-full justify-center gap-3"
              onClick={() => handleSocialSignup('Google')}
              data-testid="google-signup-button"
            >
              <Mail className="w-5 h-5" />
              Continue with Google
            </ModernButton>
            <ModernButton
              variant="secondary"
              className="w-full justify-center gap-3"
              onClick={() => handleSocialSignup('GitHub')}
              data-testid="github-signup-button"
            >
              <Github className="w-5 h-5" />
              Continue with GitHub
            </ModernButton>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-card px-4 text-muted-foreground">Or continue with email</span>
            </div>
          </div>

          {/* Signup Form */}
          <form onSubmit={handleSubmit} className="space-y-6" data-testid="signup-form">
            <FormField
              label="Full Name"
              id="name"
              placeholder="John Doe"
              value={formData.name}
              onChange={e => handleInputChange('name', e.target.value)}
              error={errors.name}
              required
              data-testid="name-input"
            />

            <FormField
              label="Work Email"
              id="email"
              type="email"
              placeholder="you@company.com"
              value={formData.email}
              onChange={e => handleInputChange('email', e.target.value)}
              error={errors.email}
              required
              data-testid="email-input"
            />

            <div className="space-y-2">
              <FormField
                label="Password"
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Create a strong password"
                value={formData.password}
                onChange={e => handleInputChange('password', e.target.value)}
                error={errors.password}
                data-testid="password-input"
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-muted-foreground hover:text-foreground transition-smooth"
                    data-testid="toggle-password-visibility"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                }
                required
              />

              {/* Password Requirements */}
              {formData.password && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-3 space-y-2"
                >
                  {passwordRequirements.map((req, index) => {
                    const isMet = req.test(formData.password);
                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-center gap-2 text-sm"
                      >
                        <div className="w-5 h-5 flex items-center justify-center">
                          <AnimatePresence mode="wait" initial={false}>
                            {isMet ? (
                              <motion.div
                                key="met"
                                initial={{ scale: 0.6, rotate: -90, opacity: 0 }}
                                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                                exit={{ scale: 0.6, rotate: 90, opacity: 0 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 24 }}
                                className="text-secondary"
                              >
                                <CheckCircle2 className="w-5 h-5" />
                              </motion.div>
                            ) : (
                              <motion.div
                                key="unmet"
                                initial={{ scale: 0.6, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.6, opacity: 0 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 24 }}
                              >
                                <div className="w-4 h-4 rounded-full flex items-center justify-center bg-muted">
                                  <X className="w-3 h-3 text-muted-foreground" />
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                        <span
                          className={`transition-colors duration-200 ${isMet ? 'text-secondary' : 'text-muted-foreground'}`}
                        >
                          {req.text}
                        </span>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </div>

            <FormField
              label="Confirm Password"
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Re-enter your password"
              value={formData.confirmPassword}
              onChange={e => handleInputChange('confirmPassword', e.target.value)}
              error={errors.confirmPassword}
              data-testid="confirm-password-input"
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="text-muted-foreground hover:text-foreground transition-smooth"
                  data-testid="toggle-confirm-password-visibility"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              }
              required
            />

            {/* Terms Agreement */}
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="terms"
                  checked={formData.agreeToTerms}
                  onChange={e => handleInputChange('agreeToTerms', e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-border bg-input text-primary focus:ring-2 focus:ring-primary/20"
                  data-testid="terms-checkbox"
                />
                <label htmlFor="terms" className="text-sm text-muted-foreground leading-relaxed">
                  I agree to the{' '}
                  <a
                    href="#"
                    className="text-primary hover:text-primary/80 transition-smooth"
                    data-testid="terms-link"
                  >
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a
                    href="#"
                    className="text-primary hover:text-primary/80 transition-smooth"
                    data-testid="privacy-policy-link"
                  >
                    Privacy Policy
                  </a>
                </label>
              </div>
              {errors.terms && <p className="text-sm text-destructive ml-7">{errors.terms}</p>}
            </div>

            <ModernButton
              type="submit"
              className="w-full"
              size="lg"
              isLoading={authLoading}
              disabled={!formData.agreeToTerms}
              data-testid="create-account-submit-button"
            >
              {authLoading ? 'Creating Account...' : 'Create Account'}
            </ModernButton>
          </form>

          <div className="text-center mt-6">
            <p className="text-muted-foreground">
              Already have an account?{' '}
              <button
                onClick={() => navigate('/login')}
                className="text-primary hover:text-primary/80 transition-smooth font-medium"
                data-testid="sign-in-link"
              >
                Sign in
              </button>
            </p>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center mt-8 text-sm text-muted-foreground"
        >
          Protected by enterprise-grade security
        </motion.div>
      </motion.div>
    </div>
  );
});
