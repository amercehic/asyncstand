import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { Building, Users, User, CreditCard, Shield, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts';
import { organizationApi } from '@/lib/api';
import type { Organization, OrgMember } from '@/lib/api';
import { useAllInvoices } from '@/hooks/useBillingData';
import { OrganizationSettings } from '@/components/settings/OrganizationSettings';
import { MembersSettings } from '@/components/settings/MembersSettings';
import { ProfileSettings } from '@/components/settings/ProfileSettings';
import { BillingSettings } from '@/components/settings/BillingSettings';

type TabType = 'organization' | 'members' | 'profile' | 'billing' | 'security';

export const SettingsPage = React.memo(() => {
  const { user, refreshUser } = useAuth();
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

  // Preload invoices as soon as user is authenticated (for faster billing tab access)
  useAllInvoices(!!user);

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

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [orgData, membersData] = await Promise.all([
        organizationApi.getOrganization(),
        organizationApi.getMembers(),
      ]);
      setOrganization(orgData);

      // Ensure membersData is an array
      if (Array.isArray(membersData)) {
        setMembers(membersData);
      } else {
        console.error('Members data is not an array:', membersData);
        setMembers([]);
      }
    } catch (error) {
      console.error('Failed to load settings data:', error);
      setMembers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOrganizationUpdate = (updatedOrg: Organization) => {
    setOrganization(updatedOrg);
  };

  const handleMembersUpdate = (updatedMembers: OrgMember[]) => {
    setMembers(updatedMembers);
  };

  const handleUserUpdate = async () => {
    await refreshUser();
  };

  const canManageOrg = user?.role === 'owner';
  const canManageMembers = user?.role === 'owner' || user?.role === 'admin';

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
                data-testid={`mobile-tab-${tab.id}`}
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
                data-testid={`desktop-tab-${tab.id}`}
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
              <OrganizationSettings
                key="organization"
                organization={organization}
                members={members}
                canManageOrg={canManageOrg}
                onOrganizationUpdate={handleOrganizationUpdate}
              />
            )}

            {activeTab === 'members' && (
              <MembersSettings
                key="members"
                members={members}
                canManageMembers={canManageMembers}
                currentUserId={user?.id}
                onMembersUpdate={handleMembersUpdate}
              />
            )}

            {activeTab === 'profile' && (
              <ProfileSettings key="profile" user={user} onUserUpdate={handleUserUpdate} />
            )}

            {activeTab === 'billing' && (
              <BillingSettings key="billing" isActive={activeTab === 'billing'} />
            )}

            {activeTab === 'security' && (
              <motion.div
                key="security"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="bg-card rounded-2xl border border-border p-6">
                  <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    Security Settings
                  </h2>
                  <div className="text-center py-12">
                    <Shield className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-muted-foreground mb-2">Coming Soon</h3>
                    <p className="text-sm text-muted-foreground">
                      Advanced security features will be available in a future update.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
});

SettingsPage.displayName = 'SettingsPage';
