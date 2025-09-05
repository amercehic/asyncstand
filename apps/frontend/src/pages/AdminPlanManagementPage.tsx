import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  Edit2,
  Trash2,
  CreditCard,
  Users,
  Calendar,
  Layers,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Save,
  Loader2,
  AlertCircle,
  Sparkles,
  Package,
  Shield,
  Database,
  Link,
  FolderOpen,
  Activity,
} from 'lucide-react';
import { SuperAdminRoute } from '@/components/SuperAdminRoute';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/Toast';
import {
  adminApi,
  Plan,
  Feature,
  CreatePlanData,
  UpdatePlanData,
  PlanAnalytics,
} from '@/lib/api-client/admin';

const PlanManagementContent: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [analytics, setAnalytics] = useState<PlanAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Form states
  const [formData, setFormData] = useState<CreatePlanData>({
    key: '',
    name: '',
    displayName: '',
    description: '',
    price: 0,
    interval: 'month',
    stripePriceId: '',
    isActive: true,
    sortOrder: 0,
    memberLimit: undefined,
    teamLimit: undefined,
    standupConfigLimit: undefined,
    standupLimit: undefined,
    storageLimit: undefined,
    integrationLimit: undefined,
    features: [],
  });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [plansResult, featuresResult, analyticsResult] = await Promise.all([
        adminApi.getAllPlans(),
        adminApi.getAvailableFeatures(),
        adminApi.getPlanAnalytics(),
      ]);

      setPlans(plansResult.plans);
      setFeatures(featuresResult.features);
      setAnalytics(analyticsResult.analytics);
    } catch (error) {
      console.error('Failed to load plan data:', error);
      toast.error('Failed to load plan data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = async () => {
    if (!formData.key || !formData.name || !formData.displayName) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      await adminApi.createPlan(formData);
      toast.success('Plan created successfully');
      setShowCreateDialog(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Failed to create plan:', error);
      const message = error instanceof Error ? error.message : 'Failed to create plan';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdatePlan = async () => {
    if (!editingPlan) return;

    try {
      setSubmitting(true);
      const updateData: UpdatePlanData = {
        name: formData.name,
        displayName: formData.displayName,
        description: formData.description,
        price: formData.price,
        interval: formData.interval,
        stripePriceId: formData.stripePriceId,
        isActive: formData.isActive,
        sortOrder: formData.sortOrder,
        memberLimit: formData.memberLimit,
        teamLimit: formData.teamLimit,
        standupConfigLimit: formData.standupConfigLimit,
        standupLimit: formData.standupLimit,
        storageLimit: formData.storageLimit,
        integrationLimit: formData.integrationLimit,
        features: formData.features,
      };

      await adminApi.updatePlan(editingPlan.id, updateData);
      toast.success('Plan updated successfully');
      setEditingPlan(null);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Failed to update plan:', error);
      const message = error instanceof Error ? error.message : 'Failed to update plan';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePlan = async (plan: Plan) => {
    if (plan.subscriptionCount > 0) {
      toast.error(
        `Cannot delete ${plan.name} as it has ${plan.subscriptionCount} active subscriptions`
      );
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to delete the "${plan.name}" plan? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await adminApi.deletePlan(plan.id);
      toast.success('Plan deleted successfully');
      loadData();
    } catch (error) {
      console.error('Failed to delete plan:', error);
      const message = error instanceof Error ? error.message : 'Failed to delete plan';
      toast.error(message);
    }
  };

  const startEditing = (plan: Plan) => {
    setEditingPlan(plan);
    setFormData({
      key: plan.key,
      name: plan.name,
      displayName: plan.displayName,
      description: plan.description,
      price: plan.price,
      interval: plan.interval,
      stripePriceId: plan.stripePriceId,
      isActive: plan.isActive,
      sortOrder: plan.sortOrder,
      memberLimit: plan.memberLimit || undefined,
      teamLimit: plan.teamLimit || undefined,
      standupConfigLimit: plan.standupConfigLimit || undefined,
      standupLimit: plan.standupLimit || undefined,
      storageLimit: plan.storageLimit || undefined,
      integrationLimit: plan.integrationLimit || undefined,
      features: plan.features,
    });
  };

  const resetForm = () => {
    setFormData({
      key: '',
      name: '',
      displayName: '',
      description: '',
      price: 0,
      interval: 'month',
      stripePriceId: '',
      isActive: true,
      sortOrder: 0,
      memberLimit: undefined,
      teamLimit: undefined,
      standupConfigLimit: undefined,
      standupLimit: undefined,
      storageLimit: undefined,
      integrationLimit: undefined,
      features: [],
    });
    setEditingPlan(null);
  };

  const formatPrice = (priceInCents: number) => {
    return `€${(priceInCents / 100).toFixed(2)}`;
  };

  const formatLimit = (limit: number | null | undefined) => {
    if (limit === null || limit === undefined || limit === 0) return 'Unlimited';
    return limit.toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg shadow-lg">
              <Layers className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Plan Management</h1>
              <p className="text-muted-foreground">Manage subscription plans and pricing</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setShowAnalytics(!showAnalytics)}
              variant="outline"
              className="flex items-center gap-2"
            >
              <TrendingUp className="h-4 w-4" />
              Analytics
            </Button>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Create Plan
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Plan</DialogTitle>
                </DialogHeader>
                <PlanForm
                  formData={formData}
                  setFormData={setFormData}
                  features={features}
                  onSubmit={handleCreatePlan}
                  onCancel={() => {
                    setShowCreateDialog(false);
                    resetForm();
                  }}
                  submitting={submitting}
                  isEditing={false}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </motion.div>

      {/* Analytics Section */}
      {showAnalytics && analytics && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-8 p-6 bg-card rounded-lg border border-border"
        >
          <h2 className="text-xl font-semibold mb-4">Plan Analytics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-lg border border-blue-200 dark:border-blue-800/30">
              <Activity className="h-5 w-5 mx-auto mb-2 text-blue-500" />
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {analytics.totalSubscriptions}
              </div>
              <div className="text-sm text-muted-foreground">Total Subscriptions</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/10 dark:to-green-900/10 rounded-lg border border-emerald-200 dark:border-emerald-800/30">
              <TrendingUp className="h-5 w-5 mx-auto mb-2 text-emerald-500" />
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatPrice(analytics.totalRevenue)}
              </div>
              <div className="text-sm text-muted-foreground">Monthly Revenue</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/10 dark:to-pink-900/10 rounded-lg border border-purple-200 dark:border-purple-800/30">
              <Package className="h-5 w-5 mx-auto mb-2 text-purple-500" />
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {analytics.plans.length}
              </div>
              <div className="text-sm text-muted-foreground">Active Plans</div>
            </div>
          </div>
          <div className="space-y-2">
            {analytics.plans.map(plan => (
              <div
                key={plan.id}
                className="flex items-center justify-between p-3 bg-background rounded border"
              >
                <div className="flex items-center gap-3">
                  <div className="font-medium">{plan.name}</div>
                  <div className="text-sm text-muted-foreground">
                    ({plan.subscriptionCount} subscriptions)
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="font-medium">{formatPrice(plan.revenue)}/mo</div>
                    <div className="text-sm text-muted-foreground">
                      {plan.percentage.toFixed(1)}%
                    </div>
                  </div>
                  <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: `${plan.percentage}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Plans Grid */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6"
      >
        {plans.map((plan, index) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * index }}
            className={`relative bg-card rounded-lg border transition-all duration-200 hover:shadow-lg ${
              editingPlan?.id === plan.id ? 'border-primary shadow-lg' : 'border-border'
            }`}
          >
            <div className="p-6">
              {/* Plan Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-lg shadow-md">
                    <CreditCard className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{plan.displayName}</h3>
                    <p className="text-sm text-muted-foreground">({plan.key})</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {plan.isActive ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700/30 dark:text-gray-400">
                      <XCircle className="h-3 w-3 mr-1" />
                      Inactive
                    </span>
                  )}
                </div>
              </div>

              {/* Pricing */}
              <div className="mb-4">
                <div className="text-2xl font-bold text-foreground">
                  {formatPrice(plan.price)}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{plan.interval}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
              </div>

              {/* Limits */}
              <div className="space-y-2 mb-4">
                <div className="text-sm font-medium mb-2 flex items-center gap-1">
                  <Shield className="h-3 w-3 text-slate-500" />
                  Limits
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      Members
                    </span>
                    <span className="font-medium">{formatLimit(plan.memberLimit)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <FolderOpen className="h-3 w-3" />
                      Teams
                    </span>
                    <span className="font-medium">{formatLimit(plan.teamLimit)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Layers className="h-3 w-3" />
                      Configs
                    </span>
                    <span className="font-medium">{formatLimit(plan.standupConfigLimit)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Monthly
                    </span>
                    <span className="font-medium">{formatLimit(plan.standupLimit)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Database className="h-3 w-3" />
                      Storage
                    </span>
                    <span className="font-medium">{formatLimit(plan.storageLimit)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Link className="h-3 w-3" />
                      Integrations
                    </span>
                    <span className="font-medium">{formatLimit(plan.integrationLimit)}</span>
                  </div>
                </div>
              </div>

              {/* Features */}
              <div className="mb-4">
                <div className="text-sm font-medium mb-2 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-amber-500" />
                  Features ({plan.features.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {plan.features.slice(0, 3).map(feature => {
                    const featureInfo = features.find(f => f.key === feature.featureKey);
                    return (
                      <span
                        key={feature.featureKey}
                        className="inline-flex items-center px-2 py-1 rounded text-xs bg-violet-100 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400"
                      >
                        {featureInfo?.name || feature.featureKey}
                      </span>
                    );
                  })}
                  {plan.features.length > 3 && (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 font-medium">
                      +{plan.features.length - 3} more
                    </span>
                  )}
                </div>
              </div>

              {/* Subscription Count */}
              <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>{plan.subscriptionCount} active subscriptions</span>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => startEditing(plan)}
                  className="flex-1"
                >
                  <Edit2 className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeletePlan(plan)}
                  disabled={plan.subscriptionCount > 0}
                  className={`flex-1 ${
                    plan.subscriptionCount > 0
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:bg-red-50 hover:text-red-600 hover:border-red-300 dark:hover:bg-red-900/20'
                  }`}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete
                </Button>
              </div>
            </div>

            {/* Warning for plans with subscriptions */}
            {plan.subscriptionCount > 0 && (
              <div className="px-6 pb-4">
                <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/10 px-3 py-2 rounded-md">
                  <AlertCircle className="h-3 w-3" />
                  <span>Cannot delete - has active subscriptions</span>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </motion.div>

      {/* Edit Plan Dialog */}
      {editingPlan && (
        <Dialog open={!!editingPlan} onOpenChange={() => resetForm()}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Plan: {editingPlan.displayName}</DialogTitle>
            </DialogHeader>
            <PlanForm
              formData={formData}
              setFormData={setFormData}
              features={features}
              onSubmit={handleUpdatePlan}
              onCancel={resetForm}
              submitting={submitting}
              isEditing={true}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

// Plan Form Component
interface PlanFormProps {
  formData: CreatePlanData;
  setFormData: React.Dispatch<React.SetStateAction<CreatePlanData>>;
  features: Feature[];
  onSubmit: () => void;
  onCancel: () => void;
  submitting: boolean;
  isEditing: boolean;
}

const PlanForm: React.FC<PlanFormProps> = ({
  formData,
  setFormData,
  features,
  onSubmit,
  onCancel,
  submitting,
  isEditing,
}) => {
  const handleInputChange = (
    field: keyof CreatePlanData,
    value: CreatePlanData[keyof CreatePlanData]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFeatureToggle = (featureKey: string, enabled: boolean) => {
    setFormData(prev => ({
      ...prev,
      features: enabled
        ? [...(prev.features || []), { featureKey, enabled: true, value: undefined }]
        : (prev.features || []).filter(f => f.featureKey !== featureKey),
    }));
  };

  const isFeatureEnabled = (featureKey: string) => {
    return formData.features?.some(f => f.featureKey === featureKey) || false;
  };

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Basic Information</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="key">Plan Key*</Label>
            <Input
              id="key"
              value={formData.key}
              onChange={e => handleInputChange('key', e.target.value)}
              placeholder="e.g., starter, pro"
              disabled={isEditing}
            />
          </div>
          <div>
            <Label htmlFor="displayName">Display Name*</Label>
            <Input
              id="displayName"
              value={formData.displayName}
              onChange={e => handleInputChange('displayName', e.target.value)}
              placeholder="e.g., Starter"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="name">Full Name*</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={e => handleInputChange('name', e.target.value)}
            placeholder="e.g., Starter Plan"
          />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={e => handleInputChange('description', e.target.value)}
            placeholder="Describe what this plan offers..."
            rows={3}
          />
        </div>
      </div>

      {/* Pricing */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Pricing</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="price">Price (in cents)*</Label>
            <Input
              id="price"
              type="number"
              value={formData.price}
              onChange={e => handleInputChange('price', parseInt(e.target.value) || 0)}
              placeholder="0"
              min="0"
            />
            <p className="text-xs text-muted-foreground mt-1">
              €{((formData.price || 0) / 100).toFixed(2)} per {formData.interval}
            </p>
          </div>
          <div>
            <Label htmlFor="interval">Interval</Label>
            <select
              id="interval"
              value={formData.interval}
              onChange={e => handleInputChange('interval', e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
            >
              <option value="month">Monthly</option>
              <option value="year">Yearly</option>
            </select>
          </div>
          <div>
            <Label htmlFor="sortOrder">Sort Order</Label>
            <Input
              id="sortOrder"
              type="number"
              value={formData.sortOrder}
              onChange={e => handleInputChange('sortOrder', parseInt(e.target.value) || 0)}
              placeholder="0"
              min="0"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="stripePriceId">Stripe Price ID</Label>
          <Input
            id="stripePriceId"
            value={formData.stripePriceId}
            onChange={e => handleInputChange('stripePriceId', e.target.value)}
            placeholder="price_..."
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isActive"
            checked={formData.isActive}
            onChange={e => handleInputChange('isActive', e.target.checked)}
            className="rounded"
          />
          <Label htmlFor="isActive">Plan is active</Label>
        </div>
      </div>

      {/* Limits */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Limits</h3>
        <p className="text-sm text-muted-foreground">Leave empty or 0 for unlimited</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="memberLimit">Member Limit</Label>
            <Input
              id="memberLimit"
              type="number"
              value={formData.memberLimit || ''}
              onChange={e =>
                handleInputChange('memberLimit', parseInt(e.target.value) || undefined)
              }
              placeholder="Unlimited"
              min="1"
            />
          </div>
          <div>
            <Label htmlFor="teamLimit">Team Limit</Label>
            <Input
              id="teamLimit"
              type="number"
              value={formData.teamLimit || ''}
              onChange={e => handleInputChange('teamLimit', parseInt(e.target.value) || undefined)}
              placeholder="Unlimited"
              min="1"
            />
          </div>
          <div>
            <Label htmlFor="standupConfigLimit">Standup Config Limit</Label>
            <Input
              id="standupConfigLimit"
              type="number"
              value={formData.standupConfigLimit || ''}
              onChange={e =>
                handleInputChange('standupConfigLimit', parseInt(e.target.value) || undefined)
              }
              placeholder="Unlimited"
              min="1"
            />
          </div>
          <div>
            <Label htmlFor="standupLimit">Standups per Month</Label>
            <Input
              id="standupLimit"
              type="number"
              value={formData.standupLimit || ''}
              onChange={e =>
                handleInputChange('standupLimit', parseInt(e.target.value) || undefined)
              }
              placeholder="Unlimited"
              min="1"
            />
          </div>
          <div>
            <Label htmlFor="storageLimit">Storage Limit (MB)</Label>
            <Input
              id="storageLimit"
              type="number"
              value={formData.storageLimit || ''}
              onChange={e =>
                handleInputChange('storageLimit', parseInt(e.target.value) || undefined)
              }
              placeholder="Unlimited"
              min="1"
            />
          </div>
          <div>
            <Label htmlFor="integrationLimit">Integration Limit</Label>
            <Input
              id="integrationLimit"
              type="number"
              value={formData.integrationLimit || ''}
              onChange={e =>
                handleInputChange('integrationLimit', parseInt(e.target.value) || undefined)
              }
              placeholder="Unlimited"
              min="1"
            />
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Features</h3>
        <p className="text-sm text-muted-foreground">
          Select which features are available in this plan
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-md p-4">
          {features.map(feature => (
            <div key={feature.key} className="flex items-center gap-3 p-2 hover:bg-muted rounded">
              <input
                type="checkbox"
                id={`feature-${feature.key}`}
                checked={isFeatureEnabled(feature.key)}
                onChange={e => handleFeatureToggle(feature.key, e.target.checked)}
                className="rounded"
              />
              <div className="flex-1">
                <Label htmlFor={`feature-${feature.key}`} className="font-medium">
                  {feature.name}
                </Label>
                <p className="text-xs text-muted-foreground">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t">
        <Button onClick={onCancel} variant="outline" className="flex-1">
          Cancel
        </Button>
        <Button onClick={onSubmit} disabled={submitting} className="flex-1">
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {isEditing ? 'Updating...' : 'Creating...'}
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              {isEditing ? 'Update Plan' : 'Create Plan'}
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export const AdminPlanManagementPage: React.FC = () => {
  return (
    <SuperAdminRoute>
      <PlanManagementContent />
    </SuperAdminRoute>
  );
};

export default AdminPlanManagementPage;
