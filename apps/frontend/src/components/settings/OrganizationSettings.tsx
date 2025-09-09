import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Building, Calendar, Users, Edit2, Save, X, Loader2 } from 'lucide-react';
import { ModernButton, toast } from '@/components/ui';
import { organizationApi } from '@/lib/api';
import type { Organization, OrgMember } from '@/lib/api';

interface OrganizationSettingsProps {
  organization: Organization | null;
  members: OrgMember[];
  canManageOrg: boolean;
  onOrganizationUpdate: (updatedOrg: Organization) => void;
}

export const OrganizationSettings = React.memo<OrganizationSettingsProps>(
  ({ organization, members, canManageOrg, onOrganizationUpdate }) => {
    const [isEditingOrg, setIsEditingOrg] = useState(false);
    const [orgName, setOrgName] = useState(organization?.name || '');
    const [isSaving, setIsSaving] = useState(false);

    const handleSaveOrgName = async () => {
      if (!orgName.trim()) {
        toast.error('Organization name cannot be empty');
        return;
      }

      try {
        setIsSaving(true);
        await organizationApi.updateOrganization({ name: orgName.trim() });
        const updatedOrg = organization ? { ...organization, name: orgName.trim() } : null;
        if (updatedOrg) {
          onOrganizationUpdate(updatedOrg);
        }
        setIsEditingOrg(false);
        toast.success('Organization name updated');
      } catch (error) {
        console.error('Failed to update organization:', error);
        toast.error('Failed to update organization name');
      } finally {
        setIsSaving(false);
      }
    };

    const handleCancelEdit = () => {
      setIsEditingOrg(false);
      setOrgName(organization?.name || '');
    };

    return (
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
                    data-testid="org-name-input"
                  />
                  <ModernButton
                    onClick={handleSaveOrgName}
                    disabled={isSaving}
                    className="gap-2 min-h-[44px] touch-manipulation"
                    data-testid="save-org-name-button"
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
                    onClick={handleCancelEdit}
                    className="min-h-[44px] touch-manipulation"
                    data-testid="cancel-edit-button"
                  >
                    <X className="w-4 h-4" />
                  </ModernButton>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-lg" data-testid="organization-name">
                    {organization?.name}
                  </span>
                  {canManageOrg && (
                    <ModernButton
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditingOrg(true)}
                      className="gap-2"
                      data-testid="edit-org-name-button"
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
                <div className="flex items-center gap-2 text-sm" data-testid="organization-created">
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
                <div className="flex items-center gap-2 text-sm" data-testid="organization-updated">
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
                <div
                  className="flex items-center gap-2 text-sm"
                  data-testid="organization-members-count"
                >
                  <Users className="w-4 h-4 text-muted-foreground" />
                  {(members || []).length} members
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }
);

OrganizationSettings.displayName = 'OrganizationSettings';
