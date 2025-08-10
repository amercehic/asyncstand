import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { ModernButton, FormField } from '@/components/ui';
import { ArrowLeft, Eye, EyeOff, Github, Mail } from 'lucide-react';
import { useAuth } from '@/contexts';
import type { LoginFormData, FormFieldError, FormSubmitHandler } from '@/types';

export const LoginPage = React.memo(() => {
  const navigate = useNavigate();
  const { login, isLoading: authLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<FormFieldError>({});

  const validateForm = useCallback((): boolean => {
    const newErrors: FormFieldError = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSubmit: FormSubmitHandler = useCallback(
    async e => {
      e.preventDefault();

      if (!validateForm()) {
        toast.error('Please fix the errors below');
        return;
      }

      try {
        toast.loading('Signing you in...', { id: 'login' });
        await login(formData.email, formData.password);
        toast.success('Welcome back!', { id: 'login' });
        navigate('/'); // Redirect to home page
      } catch {
        toast.error('Invalid email or password', { id: 'login' });
      }
    },
    [validateForm, login, formData.email, formData.password, navigate]
  );

  const handleInputChange = useCallback(
    (field: keyof LoginFormData, value: string) => {
      setFormData(prev => ({ ...prev, [field]: value }));
      if (errors[field]) {
        setErrors(prev => ({ ...prev, [field]: '' }));
      }
    },
    [errors]
  );

  const handleSocialLogin = (provider: string) => {
    toast.info(`${provider} login coming soon!`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
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
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-200" />
          Back to home
        </motion.button>

        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-border rounded-2xl p-8 shadow-card"
        >
          <div className="text-center mb-8">
            <div className="text-2xl font-semibold gradient-text mb-2">AsyncStand</div>
            <h1 className="text-2xl mb-2 font-light">Welcome back</h1>
            <p className="text-muted-foreground">Sign in to your account to continue</p>
          </div>

          {/* Social Login */}
          <div className="space-y-3 mb-6">
            <ModernButton
              variant="secondary"
              className="w-full justify-center gap-3"
              onClick={() => handleSocialLogin('Google')}
            >
              <Mail className="w-5 h-5" />
              Continue with Google
            </ModernButton>
            <ModernButton
              variant="secondary"
              className="w-full justify-center gap-3"
              onClick={() => handleSocialLogin('GitHub')}
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

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <FormField
              label="Email"
              id="email"
              type="email"
              placeholder="you@company.com"
              value={formData.email}
              onChange={e => handleInputChange('email', e.target.value)}
              error={errors.email}
              required
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Password
                </label>
                <button
                  type="button"
                  className="text-sm text-primary hover:text-primary/80 transition-smooth"
                >
                  Forgot password?
                </button>
              </div>
              <FormField
                label=""
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={formData.password}
                onChange={e => handleInputChange('password', e.target.value)}
                error={errors.password}
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-muted-foreground hover:text-foreground transition-smooth"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                }
                required
              />
            </div>

            <ModernButton type="submit" className="w-full" size="lg" isLoading={authLoading}>
              {authLoading ? 'Signing In...' : 'Sign In'}
            </ModernButton>
          </form>

          <div className="text-center mt-6">
            <p className="text-muted-foreground">
              Don't have an account?{' '}
              <button
                onClick={() => navigate('/signup')}
                className="text-primary hover:text-primary/80 transition-smooth font-medium"
              >
                Sign up
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
          By signing in, you agree to our{' '}
          <a href="#" className="text-primary hover:text-primary/80 transition-smooth">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="#" className="text-primary hover:text-primary/80 transition-smooth">
            Privacy Policy
          </a>
        </motion.div>
      </motion.div>
    </div>
  );
});
