import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, AlertCircle } from 'lucide-react';
import { ModernButton } from '@/components/ui';
import { featuresApi, type Feature } from '@/lib/api-client';
import { toast } from '@/components/ui';
import { useModal } from '@/contexts/ModalContext';

interface EditFeatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFeatureUpdated: () => void;
  feature: Feature | null;
}

const ENVIRONMENTS = ['development', 'staging', 'production'];
const CATEGORIES = ['core', 'integration', 'billing', 'analytics'];

interface UpdateFeatureData {
  name: string;
  description?: string;
  isEnabled: boolean;
  environment: string[];
  category?: string;
  isPlanBased: boolean;
  requiresAdmin: boolean;
  rolloutType?: string;
}

export const EditFeatureModal: React.FC<EditFeatureModalProps> = ({
  isOpen,
  onClose,
  onFeatureUpdated,
  feature,
}) => {
  const { setModalOpen } = useModal();
  const [formData, setFormData] = useState<UpdateFeatureData>({
    name: '',
    description: '',
    isEnabled: true,
    environment: ['development'],
    category: 'core',
    isPlanBased: false,
    requiresAdmin: false,
    rolloutType: 'boolean',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen && !loading) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
    return undefined;
  }, [isOpen, loading]);

  // Track modal open/close state
  useEffect(() => {
    setModalOpen(isOpen);
  }, [isOpen, setModalOpen]);

  // Update form data when feature changes
  useEffect(() => {
    if (feature) {
      setFormData({
        name: feature.name,
        description: feature.description || '',
        isEnabled: feature.isEnabled,
        environment: feature.environment,
        category: feature.category || 'core',
        isPlanBased: feature.isPlanBased,
        requiresAdmin: feature.requiresAdmin,
        rolloutType: feature.rolloutType || 'boolean',
      });
    }
  }, [feature]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name?.trim()) {
      newErrors.name = 'Feature name is required';
    }

    if (!formData.description?.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.trim().length < 1 || formData.description.trim().length > 500) {
      newErrors.description = 'Description must be between 1-500 characters';
    }

    if (formData.environment.length === 0) {
      newErrors.environment = 'At least one environment must be selected';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!feature || !validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await featuresApi.updateFeature(feature.key, formData);
      toast.success('Feature updated successfully');
      onFeatureUpdated();
      onClose();
      setErrors({});
    } catch (error: unknown) {
      console.error('Failed to update feature:', error);

      // Handle different error types
      let errorMessage = 'Failed to update feature';

      if (error && typeof error === 'object' && 'response' in error) {
        const response = error.response as {
          status?: number;
          data?: {
            title?: string;
            message?: string;
            response?: {
              message?: string | string[];
            };
          };
        };

        if (response?.status === 400 && response?.data?.response?.message) {
          // Handle validation errors from backend
          const messages = response.data.response.message;
          if (Array.isArray(messages)) {
            errorMessage = messages[0]; // Show first validation error
          } else if (typeof messages === 'string') {
            errorMessage = messages;
          }
        } else if (response?.data?.message) {
          // Handle other API errors
          errorMessage = String(response.data.message);
        } else if (response?.data?.title) {
          // Handle problem+json format
          errorMessage = String(response.data.title);
        }
      }

      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    onClose();
    setErrors({});
  };

  const handleEnvironmentToggle = (env: string) => {
    setFormData(prev => ({
      ...prev,
      environment: prev.environment.includes(env)
        ? prev.environment.filter(e => e !== env)
        : [...prev.environment, env],
    }));
  };

  return (
    <AnimatePresence>
      {isOpen && feature && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-card rounded-lg border border-border shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Edit Feature</h2>
                <p className="text-sm text-muted-foreground">
                  Key: <code className="bg-muted px-1 py-0.5 rounded text-xs">{feature.key}</code>
                </p>
              </div>
              <ModernButton
                variant="ghost"
                onClick={handleClose}
                className="p-2"
                disabled={loading}
              >
                <X className="h-5 w-5" />
              </ModernButton>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Feature Name */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Feature Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Advanced Analytics"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  disabled={loading}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {errors.name}
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Description *
                </label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what this feature does..."
                  rows={3}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  disabled={loading}
                />
                {errors.description && (
                  <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {errors.description}
                  </p>
                )}
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Category</label>
                <select
                  value={formData.category}
                  onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  disabled={loading}
                >
                  {CATEGORIES.map(category => (
                    <option key={category} value={category}>
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Environments */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Environments *
                </label>
                <div className="flex flex-wrap gap-2">
                  {ENVIRONMENTS.map(env => (
                    <label key={env} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.environment.includes(env)}
                        onChange={() => handleEnvironmentToggle(env)}
                        className="rounded border-border focus:ring-2 focus:ring-primary"
                        disabled={loading}
                      />
                      <span className="text-sm text-foreground capitalize">{env}</span>
                    </label>
                  ))}
                </div>
                {errors.environment && (
                  <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {errors.environment}
                  </p>
                )}
              </div>

              {/* Toggles */}
              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isEnabled}
                    onChange={e => setFormData(prev => ({ ...prev, isEnabled: e.target.checked }))}
                    className="rounded border-border focus:ring-2 focus:ring-primary"
                    disabled={loading}
                  />
                  <div>
                    <div className="text-sm font-medium text-foreground">Enable Feature</div>
                    <div className="text-xs text-muted-foreground">
                      Feature will be globally enabled
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isPlanBased}
                    onChange={e =>
                      setFormData(prev => ({ ...prev, isPlanBased: e.target.checked }))
                    }
                    className="rounded border-border focus:ring-2 focus:ring-primary"
                    disabled={loading}
                  />
                  <div>
                    <div className="text-sm font-medium text-foreground">Plan-Based Feature</div>
                    <div className="text-xs text-muted-foreground">
                      Feature availability depends on subscription plan
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.requiresAdmin}
                    onChange={e =>
                      setFormData(prev => ({ ...prev, requiresAdmin: e.target.checked }))
                    }
                    className="rounded border-border focus:ring-2 focus:ring-primary"
                    disabled={loading}
                  />
                  <div>
                    <div className="text-sm font-medium text-foreground">Requires Admin</div>
                    <div className="text-xs text-muted-foreground">
                      Feature requires admin privileges to access
                    </div>
                  </div>
                </label>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <ModernButton
                  type="button"
                  variant="ghost"
                  onClick={handleClose}
                  disabled={loading}
                >
                  Cancel
                </ModernButton>
                <ModernButton
                  type="submit"
                  disabled={
                    loading ||
                    !formData.name?.trim() ||
                    !formData.description?.trim() ||
                    formData.environment.length === 0
                  }
                  className="flex items-center gap-2"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {loading ? 'Updating...' : 'Update Feature'}
                </ModernButton>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
