import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Shield,
  Plus,
  Edit2,
  Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ModernButton } from '@/components/ui';
import { FeatureToggle } from '@/components/ui/FeatureToggle';
import { SuperAdminRoute } from '@/components/SuperAdminRoute';
import { featuresApi, type Feature } from '@/lib/api-client';
import { toast } from '@/components/ui';
import { AddFeatureModal } from '@/components/AdminFeatures/AddFeatureModal';
import { EditFeatureModal } from '@/components/AdminFeatures/EditFeatureModal';
import { DeleteConfirmationModal } from '@/components/AdminFeatures/DeleteConfirmationModal';

const AdminFeaturesPageContent = React.memo(() => {
  const navigate = useNavigate();
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>(''); // 'enabled', 'disabled'
  const [categories, setCategories] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);

  // Fetch features
  const fetchData = async () => {
    try {
      setLoading(true);
      const featuresResponse = await featuresApi.getAllFeatures();

      setFeatures(featuresResponse.features);

      // Extract unique categories
      const uniqueCategories = Array.from(
        new Set(featuresResponse.features.map(f => f.category).filter(Boolean))
      ) as string[];
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Failed to fetch features:', error);
      toast.error('Failed to load features');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle feature toggle
  const handleFeatureToggle = async (featureKey: string, enabled: boolean) => {
    try {
      await featuresApi.updateFeature(featureKey, { isEnabled: enabled });

      // Update local state
      setFeatures(prev =>
        prev.map(feature =>
          feature.key === featureKey ? { ...feature, isEnabled: enabled } : feature
        )
      );

      toast.success(`Feature ${enabled ? 'enabled' : 'disabled'} successfully`);
    } catch (error) {
      console.error('Failed to update feature:', error);
      toast.error('Failed to update feature');
    }
  };

  // Handle edit feature
  const handleEditFeature = (feature: Feature) => {
    setSelectedFeature(feature);
    setShowEditModal(true);
  };

  // Handle delete feature
  const handleDeleteFeature = (feature: Feature) => {
    setSelectedFeature(feature);
    setShowDeleteModal(true);
  };

  // Filter features
  const filteredFeatures = features.filter(feature => {
    const matchesSearch =
      feature.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      feature.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      feature.description?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = !categoryFilter || feature.category === categoryFilter;

    const matchesStatus =
      !statusFilter ||
      (statusFilter === 'enabled' && feature.isEnabled) ||
      (statusFilter === 'disabled' && !feature.isEnabled);

    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <ModernButton variant="ghost" onClick={() => navigate('/admin')} className="p-2">
              <ArrowLeft className="h-5 w-5" />
            </ModernButton>
            <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Feature Flags</h1>
              <p className="text-muted-foreground">
                Manage global feature flags for the entire application
              </p>
            </div>
          </div>
          <ModernButton onClick={() => setShowAddModal(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Feature
          </ModernButton>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-6 bg-card rounded-lg border border-border p-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <input
              type="text"
              placeholder="Search features..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="">All Status</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>

          {/* Results count */}
          <div className="flex items-center text-sm text-muted-foreground">
            Showing {filteredFeatures.length} of {features.length} features
          </div>
        </div>
      </motion.div>

      {/* Features Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid gap-4"
        >
          {filteredFeatures.map((feature, index) => (
            <motion.div
              key={feature.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * index }}
              className="bg-card rounded-lg border border-border p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-foreground truncate">
                      {feature.name}
                    </h3>
                    <span className="px-2 py-1 text-xs rounded-full bg-muted text-muted-foreground">
                      {feature.category || 'uncategorized'}
                    </span>
                    {feature.isPlanBased && (
                      <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                        Plan-based
                      </span>
                    )}
                    {feature.requiresAdmin && (
                      <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                        Admin Only
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Key: <code className="bg-muted px-1 py-0.5 rounded text-xs">{feature.key}</code>
                  </p>
                  {feature.description && (
                    <p className="text-sm text-muted-foreground mb-3">{feature.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Environments: {feature.environment.join(', ')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <div className="flex items-center gap-2">
                    {feature.isEnabled ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span
                      className={`text-sm font-medium ${
                        feature.isEnabled ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {feature.isEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ModernButton
                      variant="ghost"
                      onClick={() => handleEditFeature(feature)}
                      className="p-2 text-muted-foreground hover:text-blue-600 hover:bg-muted/50 transition-colors"
                      title="Edit feature"
                    >
                      <Edit2 className="h-4 w-4" />
                    </ModernButton>
                    <ModernButton
                      variant="ghost"
                      onClick={() => handleDeleteFeature(feature)}
                      className="p-2 text-muted-foreground hover:text-red-600 hover:bg-muted/50 transition-colors"
                      title="Delete feature"
                    >
                      <Trash2 className="h-4 w-4" />
                    </ModernButton>
                    <FeatureToggle
                      enabled={feature.isEnabled}
                      onToggle={enabled => handleFeatureToggle(feature.key, enabled)}
                      disabled={false}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}

          {filteredFeatures.length === 0 && !loading && (
            <div className="text-center py-12">
              <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No features found</h3>
              <p className="text-muted-foreground">
                Try adjusting your search criteria or filters.
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* Add Feature Modal */}
      <AddFeatureModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onFeatureAdded={() => {
          fetchData(); // Refresh the features list
        }}
      />

      {/* Edit Feature Modal */}
      <EditFeatureModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedFeature(null);
        }}
        onFeatureUpdated={() => {
          fetchData(); // Refresh the features list
        }}
        feature={selectedFeature}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedFeature(null);
        }}
        onFeatureDeleted={() => {
          fetchData(); // Refresh the features list
        }}
        feature={selectedFeature}
      />
    </div>
  );
});

AdminFeaturesPageContent.displayName = 'AdminFeaturesPageContent';

export const AdminFeaturesPage: React.FC = () => {
  return (
    <SuperAdminRoute>
      <AdminFeaturesPageContent />
    </SuperAdminRoute>
  );
};

AdminFeaturesPage.displayName = 'AdminFeaturesPage';

export default AdminFeaturesPage;
