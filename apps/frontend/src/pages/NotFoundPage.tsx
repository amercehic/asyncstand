import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ModernButton } from '@/components/ui';
import { Home, ArrowLeft, HelpCircle } from 'lucide-react';
import { usePerformanceMonitor } from '@/hooks';

export const NotFoundPage = React.memo(() => {
  const navigate = useNavigate();
  usePerformanceMonitor('NotFoundPage');

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-2xl mx-auto"
      >
        {/* 404 Animation */}
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-8"
        >
          <div className="text-9xl font-bold gradient-text mb-4">404</div>
          <div className="w-32 h-1 bg-gradient-to-r from-primary/50 via-primary to-primary/50 mx-auto rounded-full"></div>
        </motion.div>

        {/* Error Message */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-8"
        >
          <h1 className="text-3xl lg:text-4xl font-bold mb-4 text-foreground">
            Oops! Page Not Found
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed max-w-md mx-auto">
            The page you're looking for doesn't exist or has been moved to a different location.
          </p>
        </motion.div>

        {/* Suggestions */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="bg-card rounded-2xl p-6 border border-border mb-8"
        >
          <h2 className="text-lg font-semibold mb-4 flex items-center justify-center gap-2">
            <HelpCircle className="w-5 h-5" />
            What can you do?
          </h2>
          <div className="grid gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary/60"></div>
              Check if the URL is spelled correctly
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary/60"></div>
              Go back to the previous page
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary/60"></div>
              Visit our homepage to start fresh
            </div>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <ModernButton
            variant="primary"
            size="lg"
            onClick={() => navigate('/')}
            className="group"
            data-testid="go-home-button"
          >
            <Home className="w-5 h-5 mr-2" />
            Go to Homepage
          </ModernButton>

          <ModernButton
            variant="secondary"
            size="lg"
            onClick={() => window.history.back()}
            className="group"
            data-testid="go-back-button"
          >
            <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform duration-200" />
            Go Back
          </ModernButton>
        </motion.div>

        {/* Footer Help */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-12 text-sm text-muted-foreground"
        >
          Still having trouble?{' '}
          <button
            onClick={() => (window.location.href = 'mailto:support@asyncstand.com')}
            className="text-primary hover:text-primary/80 transition-smooth font-medium"
            data-testid="contact-support-button"
          >
            Contact Support
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
});
