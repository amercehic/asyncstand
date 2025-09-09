import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Building,
  Users,
  User,
  CreditCard,
  Shield,
  Mail,
  Calendar,
  Crown,
  UserPlus,
  Edit2,
  Trash2,
  Save,
  X,
  Loader2,
  Search,
  Filter,
  ChevronDown,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Package,
  TrendingUp,
  Plus,
  ArrowUp,
  ArrowDown,
  FileText,
  Download,
  XCircle,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { ModernButton, toast, ConfirmationModal } from '@/components/ui';
import { useAuth, useModal } from '@/contexts';
import { organizationApi, authApi } from '@/lib/api';
import type { Organization, OrgMember, OrgRole } from '@/lib/api';
import {
  useBillingData,
  useAllInvoices,
  useDownloadInvoice,
  useRemovePaymentMethod,
  useCancelSubscription,
  useReactivateSubscription,
} from '@/hooks/useBillingData';
import type { BillingPlan } from '@/lib/api-client/billing';
import { AddPaymentMethodModal } from '@/components/billing/AddPaymentMethodModal';
import { PaymentMethodCard, AddPaymentMethodCard } from '@/components/billing/PaymentMethodCard';

type TabType = 'organization' | 'members' | 'profile' | 'billing' | 'security';

interface InviteMemberForm {
  email: string;
  role: OrgRole;
}

// Email validation utility
const isValidEmail = (email: string): boolean => {
  if (!email.trim()) return false;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

export const SettingsPage = React.memo(() => {
  const { user, refreshUser } = useAuth();
  const { setModalOpen } = useModal();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get active tab from URL params or default to 'organization'
  const getActiveTabFromUrl = (): TabType => {
    const tab = searchParams.get('tab');
    const validTabs: TabType[] = ['organization', 'members', 'profile', 'billing', 'security'];
    return validTabs.includes(tab as TabType) ? (tab as TabType) : 'organization';
  };

  const [activeTab, setActiveTab] = useState<TabType>(getActiveTabFromUrl());
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Organization edit state
  const [isEditingOrg, setIsEditingOrg] = useState(false);
  const [orgName, setOrgName] = useState('');

  // Member management state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteMemberForm>({
    email: '',
    role: 'member' as OrgRole,
  });
  const [isInviting, setIsInviting] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);

  // Member filtering and pagination state
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<OrgRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'invited'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'role' | 'joinedAt'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [showFilters, setShowFilters] = useState(false);

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
  const [passwordValidation, setPasswordValidation] = useState({
    minLength: false,
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    hasSpecialChar: false,
  });

  // Member deletion state
  const [memberToDelete, setMemberToDelete] = useState<OrgMember | null>(null);
  const [isDeletingMember, setIsDeletingMember] = useState(false);

  // Billing state
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [invoicePage, setInvoicePage] = useState(1);
  const invoiceLimit = 3; // Smaller page size for faster loading

  // Billing hooks (only when user is authenticated and billing tab is active)
  const {
    subscription,
    usage,
    invoices,
    paymentMethods,
    plans,
    isLoading: isBillingLoading,
    queries: billingQueries,
  } = useBillingData(!!user && activeTab === 'billing', invoicePage, invoiceLimit);

  // Preload invoices as soon as user is authenticated (for faster billing tab access)
  useAllInvoices(!!user);

  const downloadInvoice = useDownloadInvoice();
  const removePaymentMethod = useRemovePaymentMethod();
  const cancelSubscription = useCancelSubscription();
  const reactivateSubscription = useReactivateSubscription();

  // Track which payment method is being deleted
  const [deletingPaymentMethodId, setDeletingPaymentMethodId] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  // Reset deleting state when mutation completes
  useEffect(() => {
    if (!removePaymentMethod.isPending && deletingPaymentMethodId) {
      setDeletingPaymentMethodId(null);
    }
  }, [removePaymentMethod.isPending, deletingPaymentMethodId]);

  // Handle invite modal open/close with modal context notification
  const handleInviteModalToggle = (open: boolean) => {
    setShowInviteModal(open);
    setModalOpen(open);
    if (!open) {
      // Reset form and validation state when closing modal
      setInviteForm({ email: '', role: 'member' as OrgRole });
      setEmailTouched(false);
    }
  };

  // Handle tab change with URL update
  const handleTabChange = (tabId: TabType) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  };

  // Sync activeTab with URL parameters
  useEffect(() => {
    const tabFromUrl = getActiveTabFromUrl();
    if (tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  // Load organization and members data
  useEffect(() => {
    loadData();
  }, []);

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

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [orgData, membersData] = await Promise.all([
        organizationApi.getOrganization(),
        organizationApi.getMembers(),
      ]);
      setOrganization(orgData);
      setOrgName(orgData?.name || '');

      // Ensure membersData is an array
      if (Array.isArray(membersData)) {
        setMembers(membersData);
      } else {
        console.error('Members data is not an array:', membersData);
        setMembers([]);
        toast.error('Failed to load members data');
      }
    } catch (error) {
      console.error('Failed to load settings data:', error);
      toast.error('Failed to load settings');
      setMembers([]); // Ensure members is always an array
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveOrgName = async () => {
    if (!orgName.trim()) {
      toast.error('Organization name cannot be empty');
      return;
    }

    try {
      setIsSaving(true);
      await organizationApi.updateOrganization({ name: orgName.trim() });
      setOrganization(prev => (prev ? { ...prev, name: orgName.trim() } : null));
      setIsEditingOrg(false);
      toast.success('Organization name updated');
    } catch (error) {
      console.error('Failed to update organization:', error);
      toast.error('Failed to update organization name');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInviteMember = async () => {
    if (!inviteForm.email.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    if (!isValidEmail(inviteForm.email)) {
      toast.error('Please provide a valid email address (e.g., user@example.com)');
      return;
    }

    try {
      setIsInviting(true);
      await organizationApi.inviteMember(inviteForm.email, inviteForm.role);
      toast.success(`Invitation sent to ${inviteForm.email}`);
      handleInviteModalToggle(false);
      // Reload members to show pending invitation
      const updatedMembers = await organizationApi.getMembers();
      setMembers(updatedMembers);
    } catch (error: unknown) {
      console.error('Failed to invite member:', error);

      // Extract error message from API response
      const apiError = error as {
        response?: {
          data?: {
            title?: string;
            message?: string;
            response?: {
              message?: string;
            };
          };
        };
      };

      const errorMessage =
        apiError?.response?.data?.title ||
        apiError?.response?.data?.response?.message ||
        apiError?.response?.data?.message ||
        'Failed to send invitation';

      toast.error(errorMessage);
    } finally {
      setIsInviting(false);
    }
  };

  const handleUpdateMemberRole = async (memberId: string, newRole: OrgRole) => {
    try {
      await organizationApi.updateMemberRole(memberId, newRole);
      toast.success('Member role updated');
      setMembers(prev => prev.map(m => (m.id === memberId ? { ...m, role: newRole } : m)));
    } catch (error) {
      console.error('Failed to update member role:', error);
      toast.error('Failed to update member role');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    const member = members.find(m => m.id === memberId);
    if (member) {
      setMemberToDelete(member);
    }
  };

  const handleConfirmRemoveMember = async () => {
    if (!memberToDelete) return;

    try {
      setIsDeletingMember(true);
      await organizationApi.removeMember(memberToDelete.id);
      toast.success('Member removed');
      setMembers(prev => prev.filter(m => m.id !== memberToDelete.id));
      setMemberToDelete(null);
    } catch (error) {
      console.error('Failed to remove member:', error);
      toast.error('Failed to remove member');
    } finally {
      setIsDeletingMember(false);
    }
  };

  const handleCancelRemoveMember = () => {
    setMemberToDelete(null);
    setIsDeletingMember(false);
  };

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
      await refreshUser();

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

  const canManageOrg = user?.role === 'owner';
  const canManageMembers = user?.role === 'owner' || user?.role === 'admin';

  // Filtered and paginated members
  const { filteredMembers, totalPages, displayedMembers } = useMemo(() => {
    const filtered = (members || []).filter(member => {
      // Search filter
      const matchesSearch =
        searchQuery === '' ||
        member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.email.toLowerCase().includes(searchQuery.toLowerCase());

      // Role filter
      const matchesRole = roleFilter === 'all' || member.role === roleFilter;

      // Status filter
      const matchesStatus = statusFilter === 'all' || member.status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });

    // Sorting
    filtered.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'role':
          aValue = a.role;
          bValue = b.role;
          break;
        case 'joinedAt':
          aValue = a.joinedAt ? new Date(a.joinedAt).getTime() : 0;
          bValue = b.joinedAt ? new Date(b.joinedAt).getTime() : 0;
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const displayedMembers = filtered.slice(startIndex, startIndex + itemsPerPage);

    return { filteredMembers: filtered, totalPages, displayedMembers };
  }, [
    members,
    searchQuery,
    roleFilter,
    statusFilter,
    sortBy,
    sortOrder,
    currentPage,
    itemsPerPage,
  ]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter, statusFilter, sortBy, sortOrder]);

  const tabs = [
    { id: 'organization' as TabType, label: 'Organization', icon: Building },
    { id: 'members' as TabType, label: 'Members', icon: Users },
    { id: 'profile' as TabType, label: 'Profile', icon: User },
    { id: 'billing' as TabType, label: 'Billing', icon: CreditCard },
    { id: 'security' as TabType, label: 'Security', icon: Shield, comingSoon: true },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto px-4 sm:px-6 py-8"
    >
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">Manage your organization and account settings</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-8">
        {/* Mobile Tab Navigation */}
        <div className="lg:hidden">
          <nav className="flex overflow-x-auto scrollbar-hide space-x-2 pb-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => !tab.comingSoon && handleTabChange(tab.id)}
                disabled={tab.comingSoon}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors min-h-[44px] touch-manipulation ${
                  activeTab === tab.id
                    ? 'bg-primary/10 text-primary'
                    : tab.comingSoon
                      ? 'text-muted-foreground/50 cursor-not-allowed'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                }`}
              >
                <tab.icon className="w-4 h-4 flex-shrink-0" />
                <span>{tab.label}</span>
                {tab.comingSoon && (
                  <span className="text-xs bg-muted px-2 py-0.5 rounded">Soon</span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Desktop Sidebar */}
        <div className="hidden lg:block w-64 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => !tab.comingSoon && handleTabChange(tab.id)}
                disabled={tab.comingSoon}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary/10 text-primary'
                    : tab.comingSoon
                      ? 'text-muted-foreground/50 cursor-not-allowed'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="flex-1 text-left">{tab.label}</span>
                {tab.comingSoon && (
                  <span className="text-xs bg-muted px-2 py-0.5 rounded">Soon</span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            {activeTab === 'organization' && (
              <motion.div
                key="organization"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="bg-card rounded-2xl border border-border p-6">
                  <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <Building className="w-5 h-5 text-primary" />
                    Organization Information
                  </h2>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Organization Name
                      </label>
                      {isEditingOrg ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={orgName}
                            onChange={e => setOrgName(e.target.value)}
                            className="flex-1 px-3 py-3 sm:py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px] touch-manipulation"
                            placeholder="Enter organization name"
                          />
                          <ModernButton
                            onClick={handleSaveOrgName}
                            disabled={isSaving}
                            className="gap-2 min-h-[44px] touch-manipulation"
                          >
                            {isSaving ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Save className="w-4 h-4" />
                            )}
                            Save
                          </ModernButton>
                          <ModernButton
                            variant="outline"
                            onClick={() => {
                              setIsEditingOrg(false);
                              setOrgName(organization?.name || '');
                            }}
                            className="min-h-[44px] touch-manipulation"
                          >
                            <X className="w-4 h-4" />
                          </ModernButton>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="text-lg">{organization?.name}</span>
                          {canManageOrg && (
                            <ModernButton
                              variant="outline"
                              size="sm"
                              onClick={() => setIsEditingOrg(true)}
                              className="gap-2"
                            >
                              <Edit2 className="w-3 h-3" />
                              Edit
                            </ModernButton>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4">
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">
                          Created
                        </label>
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          {organization?.createdAt
                            ? new Date(organization.createdAt)
                                .toLocaleDateString('en-US', {
                                  day: 'numeric',
                                  weekday: 'short',
                                  month: 'short',
                                  year: 'numeric',
                                })
                                .replace(/(\d+), (\w{3}), (\w{3}) (\d+)/, '$1, $2, $3, $4')
                            : 'N/A'}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">
                          Last Updated
                        </label>
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          {organization?.updatedAt
                            ? new Date(organization.updatedAt)
                                .toLocaleDateString('en-US', {
                                  day: 'numeric',
                                  weekday: 'short',
                                  month: 'short',
                                  year: 'numeric',
                                })
                                .replace(/(\d+), (\w{3}), (\w{3}) (\d+)/, '$1, $2, $3, $4')
                            : 'N/A'}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 pt-4">
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">
                          Total Members
                        </label>
                        <div className="flex items-center gap-2 text-sm">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          {(members || []).length} members
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'members' && (
              <motion.div
                key="members"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="bg-card rounded-2xl border border-border p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Users className="w-5 h-5 text-primary" />
                        Team Members
                      </h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        {filteredMembers.length} of {(members || []).length} members
                      </p>
                    </div>
                    {canManageMembers && (
                      <ModernButton onClick={() => handleInviteModalToggle(true)} className="gap-2">
                        <UserPlus className="w-4 h-4" />
                        Invite Member
                      </ModernButton>
                    )}
                  </div>

                  {/* Search and Filters */}
                  <div className="space-y-4 mb-6">
                    <div className="flex flex-col sm:flex-row gap-4">
                      {/* Search */}
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Search members..."
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          className="w-full h-10 pl-10 pr-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                      </div>

                      {/* Filter Button */}
                      <ModernButton
                        variant="outline"
                        onClick={() => setShowFilters(!showFilters)}
                        className="gap-2 h-10"
                      >
                        <Filter className="w-4 h-4" />
                        Filters
                        <ChevronDown
                          className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`}
                        />
                      </ModernButton>
                    </div>

                    {/* Expanded Filters */}
                    <AnimatePresence>
                      {showFilters && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="flex flex-col sm:flex-row gap-4 p-4 bg-background rounded-lg border border-border">
                            {/* Role Filter */}
                            <div className="flex flex-col gap-2">
                              <label className="text-sm font-medium text-muted-foreground">
                                Role
                              </label>
                              <select
                                value={roleFilter}
                                onChange={e => setRoleFilter(e.target.value as OrgRole | 'all')}
                                className="px-3 py-2 bg-background border border-border rounded-md text-sm"
                              >
                                <option value="all">All Roles</option>
                                <option value="owner">Owner</option>
                                <option value="admin">Admin</option>
                                <option value="member">Member</option>
                              </select>
                            </div>

                            {/* Status Filter */}
                            <div className="flex flex-col gap-2">
                              <label className="text-sm font-medium text-muted-foreground">
                                Status
                              </label>
                              <select
                                value={statusFilter}
                                onChange={e =>
                                  setStatusFilter(e.target.value as 'all' | 'active' | 'invited')
                                }
                                className="px-3 py-2 bg-background border border-border rounded-md text-sm"
                              >
                                <option value="all">All Status</option>
                                <option value="active">Active</option>
                                <option value="invited">Invited</option>
                              </select>
                            </div>

                            {/* Sort Options */}
                            <div className="flex flex-col gap-2">
                              <label className="text-sm font-medium text-muted-foreground">
                                Sort By
                              </label>
                              <div className="flex gap-2">
                                <select
                                  value={sortBy}
                                  onChange={e =>
                                    setSortBy(e.target.value as 'name' | 'role' | 'joinedAt')
                                  }
                                  className="px-3 py-2 bg-background border border-border rounded-md text-sm"
                                >
                                  <option value="name">Name</option>
                                  <option value="role">Role</option>
                                  <option value="joinedAt">Join Date</option>
                                </select>
                                <ModernButton
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                  className="gap-1"
                                >
                                  <ArrowUpDown className="w-3 h-3" />
                                  {sortOrder === 'asc' ? 'Asc' : 'Desc'}
                                </ModernButton>
                              </div>
                            </div>

                            {/* Clear Filters */}
                            <div className="flex flex-col gap-2 sm:justify-end">
                              <ModernButton
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSearchQuery('');
                                  setRoleFilter('all');
                                  setStatusFilter('all');
                                  setSortBy('name');
                                  setSortOrder('asc');
                                  setCurrentPage(1);
                                }}
                                className="text-muted-foreground mt-auto"
                              >
                                Clear All
                              </ModernButton>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Members Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                            Member
                          </th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                            Status
                          </th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                            Role
                          </th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                            Date
                          </th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedMembers.map(member => (
                          <tr
                            key={member.id}
                            className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                          >
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                                  <User className="w-4 h-4 text-primary" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{member.name}</span>
                                    {member.id === user?.id && (
                                      <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                        You
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {member.email}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <span
                                className={`inline-flex text-xs px-2 py-1 rounded-full font-medium ${
                                  member.status === 'active'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-yellow-100 text-yellow-700'
                                }`}
                              >
                                {member.status === 'active' ? 'Active' : 'Invited'}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <select
                                value={member.role}
                                onChange={e =>
                                  handleUpdateMemberRole(member.id, e.target.value as OrgRole)
                                }
                                disabled={
                                  !canManageMembers ||
                                  member.id === user?.id ||
                                  member.role === 'owner'
                                }
                                className="w-full px-2 py-1 bg-background border border-border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {member.role === 'owner' && <option value="owner">Owner</option>}
                                <option value="admin">Admin</option>
                                <option value="member">Member</option>
                              </select>
                            </td>
                            <td className="py-4 px-4">
                              <div className="text-sm">
                                {member.status === 'active' && member.joinedAt ? (
                                  <div>
                                    <div className="font-medium">
                                      {new Date(member.joinedAt).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                      })}
                                    </div>
                                    <div className="text-xs text-muted-foreground">Joined</div>
                                  </div>
                                ) : member.status === 'invited' ? (
                                  <div>
                                    <div className="font-medium">
                                      {member.invitedAt
                                        ? new Date(member.invitedAt).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric',
                                          })
                                        : 'Recently'}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      Invited
                                      {member.invitedBy ? ` by ${member.invitedBy.name}` : ''}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              {canManageMembers &&
                                member.id !== user?.id &&
                                member.role !== 'owner' && (
                                  <ModernButton
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveMember(member.id)}
                                    className="text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </ModernButton>
                                )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-6 pt-6 border-t border-border">
                      <div className="text-sm text-muted-foreground">
                        Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
                        {Math.min(currentPage * itemsPerPage, filteredMembers.length)} of{' '}
                        {filteredMembers.length} members
                      </div>

                      <div className="flex items-center gap-2">
                        <ModernButton
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                          className="gap-1"
                        >
                          <ChevronLeft className="w-3 h-3" />
                          Previous
                        </ModernButton>

                        <div className="flex items-center gap-1">
                          {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter(page => {
                              // Show first page, last page, current page, and pages around current page
                              return (
                                page === 1 ||
                                page === totalPages ||
                                Math.abs(page - currentPage) <= 1
                              );
                            })
                            .map((page, index, pages) => {
                              // Add ellipsis if there's a gap
                              const prevPage = pages[index - 1];
                              const showEllipsis = prevPage && page - prevPage > 1;

                              return (
                                <React.Fragment key={page}>
                                  {showEllipsis && (
                                    <span className="px-2 text-muted-foreground">...</span>
                                  )}
                                  <button
                                    onClick={() => setCurrentPage(page)}
                                    className={`w-8 h-8 rounded-md text-sm font-medium transition-colors ${
                                      currentPage === page
                                        ? 'bg-primary text-primary-foreground'
                                        : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                                    }`}
                                  >
                                    {page}
                                  </button>
                                </React.Fragment>
                              );
                            })}
                        </div>

                        <ModernButton
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                          disabled={currentPage === totalPages}
                          className="gap-1"
                        >
                          Next
                          <ChevronRight className="w-3 h-3" />
                        </ModernButton>
                      </div>
                    </div>
                  )}

                  {/* Empty State */}
                  {displayedMembers.length === 0 && (
                    <div className="text-center py-12">
                      <Users className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-muted-foreground mb-2">
                        {searchQuery || roleFilter !== 'all' || statusFilter !== 'all'
                          ? 'No members found'
                          : 'No team members yet'}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {searchQuery || roleFilter !== 'all' || statusFilter !== 'all'
                          ? 'Try adjusting your search or filters'
                          : 'Invite your first team member to get started'}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'profile' && (
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
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Name
                      </label>
                      <input
                        type="text"
                        value={user?.name || ''}
                        disabled
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg opacity-50 cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        value={user?.email || ''}
                        disabled
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg opacity-50 cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Role
                      </label>
                      <div className="flex items-center gap-2">
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
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {showNewPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        {/* Password Requirements */}
                        <div className="mt-3 bg-muted/50 rounded-lg p-3 space-y-2">
                          <p className="text-xs font-medium text-muted-foreground mb-2">
                            Password Requirements:
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <PasswordRequirement
                              met={passwordValidation.minLength}
                              text="8+ characters"
                            />
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
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
                            <p className="text-xs text-destructive mt-1">Passwords do not match</p>
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
                          onClick={() => {
                            setIsChangingPassword(false);
                            setPasswordForm({
                              currentPassword: '',
                              newPassword: '',
                              confirmPassword: '',
                            });
                            setShowCurrentPassword(false);
                            setShowNewPassword(false);
                            setShowConfirmPassword(false);
                          }}
                          disabled={isUpdatingPassword}
                        >
                          <X className="w-4 h-4" />
                          Cancel
                        </ModernButton>
                      </div>
                    </div>
                  ) : (
                    <div className="text-muted-foreground">
                      <p className="text-sm">
                        Keep your account secure by using a strong password and changing it
                        regularly.
                      </p>
                      <p className="text-xs mt-2">
                        Last updated:{' '}
                        {user?.updatedAt
                          ? (() => {
                              // Debug: Log the actual timestamp value
                              console.log('Raw updatedAt from user:', user.updatedAt);

                              // Ensure the timestamp is properly treated as UTC
                              const utcDate = new Date(
                                user.updatedAt.endsWith('Z') ? user.updatedAt : user.updatedAt + 'Z'
                              );

                              console.log(user);

                              console.log('Parsed UTC date:', utcDate.toString());
                              console.log(
                                'Formatted result:',
                                utcDate.toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  timeZoneName: 'short',
                                })
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
            )}

            {activeTab === 'billing' && (
              <motion.div
                key="billing"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {isBillingLoading ? (
                  <div className="flex items-center justify-center min-h-[60vh]">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <>
                    {/* Subscription Overview */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Plan Card */}
                      <div className="bg-card rounded-2xl border border-border p-6">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                          <Package className="w-5 h-5 text-primary" />
                          Current Plan
                        </h3>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-2xl font-bold">
                              {(() => {
                                // If we have an active subscription, try to get the plan price
                                if (subscription?.subscription && plans && plans.length > 0) {
                                  const currentPlan = plans.find(
                                    (p: BillingPlan) => p.id === subscription.subscription?.planId
                                  );
                                  if (currentPlan && currentPlan.price > 0) {
                                    return new Intl.NumberFormat('de-DE', {
                                      style: 'currency',
                                      currency: 'EUR',
                                    }).format(currentPlan.price / 100);
                                  }
                                }

                                // Fallback to usage data plan pricing if available
                                if (
                                  usage?.usage &&
                                  !usage.usage.isFreePlan &&
                                  plans &&
                                  plans.length > 0
                                ) {
                                  const planByName = plans.find(
                                    (p: BillingPlan) =>
                                      p.name.toLowerCase() === usage.usage.planName.toLowerCase()
                                  );
                                  if (planByName && planByName.price > 0) {
                                    return new Intl.NumberFormat('de-DE', {
                                      style: 'currency',
                                      currency: 'EUR',
                                    }).format(planByName.price / 100);
                                  }
                                }

                                // Default to free plan
                                return '€0,00';
                              })()}
                              <span className="text-sm text-muted-foreground font-normal">
                                /month
                              </span>
                            </span>
                            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                              {(() => {
                                // Try to get plan name from subscription data first
                                if (subscription?.subscription && plans && plans.length > 0) {
                                  const currentPlan = plans.find(
                                    (p: BillingPlan) => p.id === subscription.subscription?.planId
                                  );
                                  if (currentPlan?.name) {
                                    return currentPlan.name.toUpperCase();
                                  }
                                }

                                // Fallback to usage data plan name
                                if (usage?.usage?.planName && !usage.usage.isFreePlan) {
                                  return usage.usage.planName.toUpperCase();
                                }

                                // Fallback to subscription plan string or FREE
                                return subscription?.plan?.toUpperCase() || 'FREE';
                              })()}
                            </span>
                          </div>

                          {/* Plan Details */}
                          {subscription?.subscription && (
                            <div className="space-y-2 text-sm text-muted-foreground">
                              <div className="flex justify-between">
                                <span>Status:</span>
                                <span
                                  className={`font-medium ${
                                    subscription.subscription.status === 'active'
                                      ? 'text-green-600'
                                      : subscription.subscription.status === 'canceled'
                                        ? 'text-red-600'
                                        : 'text-yellow-600'
                                  }`}
                                >
                                  {subscription.subscription.status?.charAt(0).toUpperCase() +
                                    subscription.subscription.status?.slice(1)}
                                </span>
                              </div>
                              {subscription.subscription.currentPeriodEnd && (
                                <div className="flex justify-between">
                                  <span>Next billing:</span>
                                  <span className="font-medium">
                                    {format(
                                      new Date(subscription.subscription.currentPeriodEnd),
                                      'MMM dd, yyyy'
                                    )}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Action Buttons */}
                          {(() => {
                            const isActiveSubscription =
                              subscription?.subscription?.status === 'active';
                            const isCanceled =
                              subscription?.subscription?.cancelAtPeriodEnd || false;
                            const planKey =
                              subscription?.subscription?.planKey || subscription?.plan || 'free';
                            const isEnterprisePlan = planKey?.toLowerCase() === 'enterprise';

                            if (isActiveSubscription && !isCanceled) {
                              return (
                                <div className="space-y-2">
                                  <ModernButton
                                    className="w-full gap-2"
                                    onClick={() => navigate('/upgrade-plan')}
                                  >
                                    {isEnterprisePlan ? (
                                      <>
                                        <ArrowDown className="w-4 h-4" />
                                        Downgrade to Starter Plan
                                      </>
                                    ) : (
                                      <>
                                        <ArrowUp className="w-4 h-4" />
                                        Upgrade Plan
                                      </>
                                    )}
                                  </ModernButton>
                                  <ModernButton
                                    variant="outline"
                                    className="w-full gap-2 border-gray-300 hover:bg-gray-50 text-gray-700 hover:text-gray-900"
                                    onClick={() => setShowCancelDialog(true)}
                                    disabled={cancelSubscription.isPending}
                                  >
                                    <XCircle className="w-4 h-4" />
                                    Cancel Subscription
                                  </ModernButton>
                                </div>
                              );
                            } else if (isCanceled && isActiveSubscription) {
                              return (
                                <div className="space-y-3">
                                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                    <p className="text-sm text-amber-800 font-medium flex items-center gap-2">
                                      <AlertCircle className="w-4 h-4" />
                                      Subscription ends on{' '}
                                      {subscription?.subscription?.currentPeriodEnd &&
                                        format(
                                          new Date(subscription.subscription.currentPeriodEnd),
                                          'MMMM d, yyyy'
                                        )}
                                    </p>
                                  </div>
                                  <ModernButton
                                    className="w-full gap-2"
                                    onClick={() => reactivateSubscription.mutate()}
                                    disabled={reactivateSubscription.isPending}
                                  >
                                    <RefreshCw
                                      className={`w-4 h-4 ${reactivateSubscription.isPending ? 'animate-spin' : ''}`}
                                    />
                                    {reactivateSubscription.isPending
                                      ? 'Reactivating...'
                                      : 'Reactivate Subscription'}
                                  </ModernButton>
                                </div>
                              );
                            } else {
                              return (
                                <ModernButton
                                  className="w-full gap-2"
                                  onClick={() => navigate('/upgrade-plan')}
                                >
                                  <ArrowUp className="w-4 h-4" />
                                  Upgrade to Starter Plan
                                </ModernButton>
                              );
                            }
                          })()}
                        </div>
                      </div>

                      {/* Usage Card */}
                      <div className="bg-card rounded-2xl border border-border p-6">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                          <TrendingUp className="w-5 h-5 text-primary" />
                          Usage Summary
                        </h3>
                        <div className="space-y-4">
                          {/* Team Members */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span>Team Members</span>
                              <span className="text-muted-foreground">
                                {usage?.usage?.members?.used || 0} /{' '}
                                {usage?.usage?.members?.limit || 10}
                              </span>
                            </div>
                            <div className="h-2 bg-accent rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary transition-all duration-500"
                                style={{
                                  width: `${Math.min(((usage?.usage?.members?.used || 0) / (usage?.usage?.members?.limit || 10)) * 100, 100)}%`,
                                }}
                              />
                            </div>
                          </div>

                          {/* Teams */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span>Teams</span>
                              <span className="text-muted-foreground">
                                {usage?.usage?.teams?.used || 0} / {usage?.usage?.teams?.limit || 5}
                              </span>
                            </div>
                            <div className="h-2 bg-accent rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary transition-all duration-500"
                                style={{
                                  width: `${Math.min(((usage?.usage?.teams?.used || 0) / (usage?.usage?.teams?.limit || 5)) * 100, 100)}%`,
                                }}
                              />
                            </div>
                          </div>

                          {/* Standup Configs */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span>Standup Configs</span>
                              <span className="text-muted-foreground">
                                {usage?.usage?.standupConfigs?.used || 0} /{' '}
                                {usage?.usage?.standupConfigs?.limit || 3}
                              </span>
                            </div>
                            <div className="h-2 bg-accent rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary transition-all duration-500"
                                style={{
                                  width: `${Math.min(((usage?.usage?.standupConfigs?.used || 0) / (usage?.usage?.standupConfigs?.limit || 3)) * 100, 100)}%`,
                                }}
                              />
                            </div>
                          </div>

                          {/* Standup Instances This Month */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span>Standups This Month</span>
                              <span className="text-muted-foreground">
                                {usage?.usage?.standupsThisMonth?.used || 0} /{' '}
                                {usage?.usage?.standupsThisMonth?.limit || 100}
                              </span>
                            </div>
                            <div className="h-2 bg-accent rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary transition-all duration-500"
                                style={{
                                  width: `${Math.min(((usage?.usage?.standupsThisMonth?.used || 0) / (usage?.usage?.standupsThisMonth?.limit || 100)) * 100, 100)}%`,
                                }}
                              />
                            </div>
                          </div>

                          {/* Next Reset Date */}
                          {usage?.usage?.nextResetDate && (
                            <div className="pt-2 border-t border-border">
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>Usage resets on:</span>
                                <span className="font-medium">
                                  {format(new Date(usage.usage.nextResetDate), 'MMM dd, yyyy')}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Payment Methods */}
                    <div className="bg-card rounded-2xl border border-border p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          <CreditCard className="w-5 h-5 text-primary" />
                          Payment Methods
                        </h3>
                        <ModernButton
                          variant="secondary"
                          size="sm"
                          onClick={() => setShowAddPayment(true)}
                          className="gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Add Payment Method
                        </ModernButton>
                      </div>

                      {billingQueries?.paymentMethods?.isLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                      ) : paymentMethods && paymentMethods.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {paymentMethods.map(method => (
                            <PaymentMethodCard
                              key={method.id}
                              method={method}
                              onSetDefault={() => {
                                // TODO: Implement set default functionality
                                toast.success('Set as default payment method');
                              }}
                              onRemove={id => {
                                setDeletingPaymentMethodId(id);
                                removePaymentMethod.mutate({ paymentMethodId: id });
                              }}
                              isLoading={removePaymentMethod.isPending}
                              isDeleting={deletingPaymentMethodId === method.id}
                            />
                          ))}
                          <AddPaymentMethodCard onClick={() => setShowAddPayment(true)} />
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <AddPaymentMethodCard onClick={() => setShowAddPayment(true)} />
                        </div>
                      )}
                    </div>

                    {/* Billing History */}
                    <div className="bg-card rounded-2xl border border-border p-6">
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-primary" />
                        Billing History
                      </h3>

                      {billingQueries?.invoices?.isLoading && invoicePage === 1 ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                      ) : invoices && invoices.invoices && invoices.invoices.length > 0 ? (
                        <div className="relative">
                          {billingQueries?.invoices?.isFetching && invoicePage > 1 && (
                            <div className="absolute inset-0 bg-background/50 rounded-lg flex items-center justify-center z-10">
                              <Loader2 className="w-5 h-5 animate-spin text-primary" />
                            </div>
                          )}
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b border-border text-sm text-muted-foreground">
                                  <th className="text-left py-2">Date</th>
                                  <th className="text-left py-2">Description</th>
                                  <th className="text-left py-2">Amount</th>
                                  <th className="text-left py-2">Status</th>
                                  <th className="text-center py-2">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {invoices.invoices.map(invoice => (
                                  <tr key={invoice.id} className="text-sm">
                                    <td className="py-3">
                                      {format(new Date(invoice.date), 'MMM dd, yyyy')}
                                    </td>
                                    <td className="py-3">
                                      {(() => {
                                        // Clean up description by removing unwanted patterns
                                        let desc = invoice.description || '';
                                        // Remove quantity prefix like "1 × "
                                        desc = desc.replace(/^\d+ × /, '');
                                        // Remove date patterns like " - 9/4/2025" or " - Sep 4, 2025" or similar date suffixes
                                        desc = desc.replace(/ - \d{1,2}\/\d{1,2}\/\d{4}$/, '');
                                        desc = desc.replace(/ - \w{3} \d{1,2}, \d{4}$/, '');
                                        desc = desc.replace(/ - \d{4}-\d{2}-\d{2}$/, '');
                                        return desc;
                                      })()}
                                    </td>
                                    <td className="py-3 font-medium">
                                      {new Intl.NumberFormat('de-DE', {
                                        style: 'currency',
                                        currency: 'EUR',
                                      }).format(invoice.amount / 100)}
                                    </td>
                                    <td className="py-3">
                                      <span
                                        className={`px-2 py-1 rounded text-xs font-medium ${
                                          invoice.status === 'paid'
                                            ? 'bg-green-100 text-green-800'
                                            : invoice.status === 'failed'
                                              ? 'bg-red-100 text-red-800'
                                              : 'bg-yellow-100 text-yellow-800'
                                        }`}
                                      >
                                        {invoice.status?.charAt(0).toUpperCase() +
                                          invoice.status?.slice(1)}
                                      </span>
                                    </td>
                                    <td className="py-3 text-center">
                                      {invoice.status === 'paid' && (
                                        <button
                                          onClick={() =>
                                            downloadInvoice.mutate({
                                              invoiceId: invoice.id,
                                              invoiceUrl: invoice.invoiceUrl,
                                            })
                                          }
                                          className="inline-flex items-center justify-center w-8 h-8 text-primary hover:text-primary/80 hover:bg-primary/10 rounded-lg transition-colors"
                                          disabled={downloadInvoice.isPending}
                                          title="Download Invoice"
                                        >
                                          <Download className="w-4 h-4" />
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Pagination Controls */}
                          {invoices.pagination && invoices.pagination.totalPages > 1 && (
                            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                              <div className="text-sm text-muted-foreground">
                                Showing {(invoicePage - 1) * invoiceLimit + 1}-
                                {Math.min(invoicePage * invoiceLimit, invoices.pagination.total)} of{' '}
                                {invoices.pagination.total} invoices
                              </div>
                              <div className="flex items-center gap-2">
                                <ModernButton
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setInvoicePage(prev => Math.max(1, prev - 1))}
                                  disabled={
                                    invoicePage === 1 || billingQueries?.invoices?.isFetching
                                  }
                                  className="gap-1"
                                >
                                  <ChevronLeft className="w-4 h-4" />
                                  Previous
                                </ModernButton>

                                <div className="flex items-center gap-1">
                                  {(() => {
                                    const totalPages = invoices.pagination.totalPages;
                                    const current = invoicePage;
                                    const pages: (number | string)[] = [];

                                    if (totalPages <= 7) {
                                      // Show all pages if 7 or fewer
                                      for (let i = 1; i <= totalPages; i++) {
                                        pages.push(i);
                                      }
                                    } else {
                                      // Always show first page
                                      pages.push(1);

                                      if (current <= 4) {
                                        // Near beginning: 1 2 3 4 5 ... last
                                        for (let i = 2; i <= 5; i++) {
                                          pages.push(i);
                                        }
                                        pages.push('ellipsis1');
                                        pages.push(totalPages);
                                      } else if (current >= totalPages - 3) {
                                        // Near end: 1 ... (last-4) (last-3) (last-2) (last-1) last
                                        pages.push('ellipsis1');
                                        for (let i = totalPages - 4; i <= totalPages; i++) {
                                          pages.push(i);
                                        }
                                      } else {
                                        // Middle: 1 ... (current-1) current (current+1) ... last
                                        pages.push('ellipsis1');
                                        for (let i = current - 1; i <= current + 1; i++) {
                                          pages.push(i);
                                        }
                                        pages.push('ellipsis2');
                                        pages.push(totalPages);
                                      }
                                    }

                                    return pages.map(page => {
                                      if (typeof page === 'string') {
                                        return (
                                          <span key={page} className="px-2 text-muted-foreground">
                                            ...
                                          </span>
                                        );
                                      }

                                      return (
                                        <button
                                          key={page}
                                          onClick={() => setInvoicePage(page)}
                                          disabled={billingQueries?.invoices?.isFetching}
                                          className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                                            page === current
                                              ? 'bg-primary text-primary-foreground'
                                              : 'hover:bg-accent'
                                          }`}
                                        >
                                          {page}
                                        </button>
                                      );
                                    });
                                  })()}
                                </div>

                                <ModernButton
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setInvoicePage(prev =>
                                      Math.min(invoices.pagination.totalPages, prev + 1)
                                    )
                                  }
                                  disabled={
                                    invoicePage === invoices.pagination.totalPages ||
                                    billingQueries?.invoices?.isFetching
                                  }
                                  className="gap-1"
                                >
                                  Next
                                  <ChevronRight className="w-4 h-4" />
                                </ModernButton>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>No billing history yet</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Cancel Subscription Confirmation Dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Cancel Subscription?</h3>
            <p className="text-sm text-gray-600 mb-4">
              Your subscription will remain active until{' '}
              {subscription?.subscription?.currentPeriodEnd &&
                format(new Date(subscription.subscription.currentPeriodEnd), 'MMMM d, yyyy')}
              . After that, you'll be downgraded to the free plan.
            </p>
            <div className="flex gap-3">
              <ModernButton
                variant="secondary"
                className="flex-1"
                onClick={() => setShowCancelDialog(false)}
              >
                Keep Subscription
              </ModernButton>
              <ModernButton
                variant="outline"
                className="flex-1 border-red-300 hover:bg-red-50 text-red-700 hover:text-red-800"
                onClick={() => {
                  cancelSubscription.mutate({ immediate: false });
                  setShowCancelDialog(false);
                }}
                disabled={cancelSubscription.isPending}
              >
                {cancelSubscription.isPending ? 'Canceling...' : 'Yes, Cancel'}
              </ModernButton>
            </div>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      <AnimatePresence>
        {showInviteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => handleInviteModalToggle(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card rounded-2xl border border-border p-6 max-w-md w-full"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary" />
                Invite Team Member
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={inviteForm.email}
                    onChange={e => {
                      setInviteForm(prev => ({ ...prev, email: e.target.value }));
                      setEmailTouched(true);
                    }}
                    onBlur={() => setEmailTouched(true)}
                    className={`w-full px-3 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                      emailTouched && inviteForm.email && !isValidEmail(inviteForm.email)
                        ? 'border-red-500 focus:ring-red-500/50'
                        : emailTouched && isValidEmail(inviteForm.email)
                          ? 'border-green-500 focus:ring-green-500/50'
                          : 'border-border focus:ring-primary/50'
                    }`}
                    placeholder="colleague@example.com"
                  />
                  {emailTouched && inviteForm.email && !isValidEmail(inviteForm.email) && (
                    <p className="text-red-500 text-xs mt-1">
                      Please provide a valid email address (e.g., user@example.com)
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Role
                  </label>
                  <select
                    value={inviteForm.role}
                    onChange={e =>
                      setInviteForm(prev => ({ ...prev, role: e.target.value as OrgRole }))
                    }
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {inviteForm.role === 'admin'
                      ? 'Can manage teams, standups, and invite members'
                      : 'Can participate in standups and view reports'}
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <ModernButton
                    onClick={handleInviteMember}
                    disabled={isInviting || !isValidEmail(inviteForm.email)}
                    className="flex-1 gap-2"
                  >
                    {isInviting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Mail className="w-4 h-4" />
                    )}
                    Send Invitation
                  </ModernButton>
                  <ModernButton
                    variant="outline"
                    onClick={() => handleInviteModalToggle(false)}
                    disabled={isInviting}
                  >
                    Cancel
                  </ModernButton>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Member Deletion Modal */}
      <ConfirmationModal
        isOpen={!!memberToDelete}
        onClose={handleCancelRemoveMember}
        onConfirm={handleConfirmRemoveMember}
        title="Remove Team Member"
        description={`Are you sure you want to remove ${memberToDelete?.name} from the organization? This action cannot be undone and they will lose access to all organizational resources.`}
        confirmText="Remove Member"
        isLoading={isDeletingMember}
        variant="danger"
      />

      {/* Add Payment Method Modal */}
      <AddPaymentMethodModal
        isOpen={showAddPayment}
        onClose={() => setShowAddPayment(false)}
        onSuccess={() => {
          if (billingQueries?.paymentMethods) {
            billingQueries.paymentMethods.refetch();
          }
          setShowAddPayment(false);
          toast.success('Payment method added successfully');
        }}
      />
    </motion.div>
  );
});

SettingsPage.displayName = 'SettingsPage';

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
