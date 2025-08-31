import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  RefreshCw,
  Download,
  Activity,
  Plus,
  Search,
  Filter,
  SortAsc,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Inbox,
  Building2,
  X,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  Bell,
  MessageSquare,
} from 'lucide-react';
import { ModernButton, Dropdown, Avatar, toast } from '@/components/ui';
import { MemberDetailsView } from '@/components/MemberDetailsView';
import { SmartReminderModal } from '@/components/SmartReminderModal';
import { ResponseDetailsModal } from '@/components/ResponseDetailsModal';
import { useTeams } from '@/contexts/TeamsContext';
import { useStandups } from '@/contexts/StandupsContext';
import { standupsApi } from '@/lib/api';
import type { ActiveStandup, Standup, StandupMember, DetailedStandupResponse } from '@/types';

type FilterType = 'all' | 'active' | 'completed' | 'overdue' | 'favorites';
type SortType = 'date' | 'team' | 'progress' | 'activity';
type ViewType = 'configs' | 'instances' | 'responses';

interface StandupConfigWithInstances extends Standup {
  instances: ActiveStandup[];
  recentInstance?: ActiveStandup;
}

interface SelectedInstance {
  instance: ActiveStandup;
  configName: string;
}

export const StandupsPage = () => {
  const navigate = useNavigate();
  const { teams, selectedTeam, selectTeam, fetchTeams } = useTeams();
  const { fetchStandupsByTeam } = useStandups();

  const [standupConfigs, setStandupConfigs] = useState<StandupConfigWithInstances[]>([]);
  const [activeInstances, setActiveInstances] = useState<ActiveStandup[]>([]);
  const [isLoadingInstances, setIsLoadingInstances] = useState(false);
  const [isLoadingConfigs, setIsLoadingConfigs] = useState(false);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sortType, setSortType] = useState<SortType>('date');
  const [favoriteStandups, setFavoriteStandups] = useState<string[]>([]);

  // Hierarchical view states
  const [expandedConfigs, setExpandedConfigs] = useState<Set<string>>(new Set());
  const [selectedInstance, setSelectedInstance] = useState<SelectedInstance | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('configs');

  // Modal states
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [isMemberDetailsOpen, setIsMemberDetailsOpen] = useState(false);
  const [isSmartReminderOpen, setIsSmartReminderOpen] = useState(false);

  // Response modal states
  const [selectedMember, setSelectedMember] = useState<StandupMember | null>(null);
  const [memberResponse, setMemberResponse] = useState<DetailedStandupResponse | null>(null);
  const [isResponseModalOpen, setIsResponseModalOpen] = useState(false);
  const [currentStandupConfig, setCurrentStandupConfig] = useState<Standup | null>(null);

  // Trigger New button states
  const [triggeringConfigs, setTriggeringConfigs] = useState<Set<string>>(new Set());

  // Load favorites from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('favoriteStandups');
    if (stored) {
      setFavoriteStandups(JSON.parse(stored));
    }
  }, []);

  // Save favorites to localStorage
  useEffect(() => {
    localStorage.setItem('favoriteStandups', JSON.stringify(favoriteStandups));
  }, [favoriteStandups]);

  // Load team data
  useEffect(() => {
    if (teams.length === 0) {
      fetchTeams();
    }
  }, [teams, fetchTeams]);

  const fetchStandupConfigs = useCallback(async (teamId: string) => {
    setIsLoadingConfigs(true);
    try {
      const configs = await standupsApi.getTeamStandups(teamId);
      const instances = await standupsApi.getActiveStandupsDetailed({ teamId });

      // Group instances by config - match instances to configs by comparing config properties
      const configsWithInstances: StandupConfigWithInstances[] = configs.map(config => {
        const configInstances = instances.filter(instance => {
          if (instance.teamId !== config.teamId) return false;

          // Match by questions array (most reliable identifier)
          if (instance.questions && config.questions) {
            const instanceQuestions = JSON.stringify(instance.questions.sort());
            const configQuestions = JSON.stringify(config.questions.sort());
            if (instanceQuestions === configQuestions) return true;
          }

          // Fallback: match by time + delivery type + channel
          const timeMatch = instance.timeLocal === config.schedule?.time;
          const deliveryMatch = instance.deliveryType === config.deliveryType;
          const channelMatch = instance.targetChannelId === config.targetChannelId;

          return timeMatch && deliveryMatch && channelMatch;
        });

        const recentInstance = configInstances.sort(
          (a, b) => new Date(b.targetDate).getTime() - new Date(a.targetDate).getTime()
        )[0];

        return {
          ...config,
          instances: configInstances,
          recentInstance,
        };
      });

      setStandupConfigs(configsWithInstances);
    } catch {
      toast.error('Failed to load standup configurations');
    } finally {
      setIsLoadingConfigs(false);
    }
  }, []);

  const fetchActiveInstances = useCallback(async (teamId?: string) => {
    setIsLoadingInstances(true);
    try {
      // Try to get detailed instances with member information
      let instances;
      try {
        instances = await standupsApi.getActiveStandupsDetailed({ teamId });
      } catch {
        // Fallback to basic instances if detailed endpoint fails
        instances = await standupsApi.getActiveStandups({ teamId });
      }

      setActiveInstances(instances);
    } catch {
      toast.error('Failed to load standup instances');
    } finally {
      setIsLoadingInstances(false);
    }
  }, []);

  // Auto-select first team if none selected
  useEffect(() => {
    if (!selectedTeam && teams.length > 0) {
      selectTeam(teams[0]);
    }
  }, [teams, selectedTeam, selectTeam]);

  // Fetch standups when team changes
  useEffect(() => {
    if (selectedTeam) {
      // Reset loaded state when team changes
      setHasInitiallyLoaded(false);

      const loadData = async () => {
        try {
          await Promise.all([
            fetchStandupsByTeam(selectedTeam.id),
            fetchActiveInstances(selectedTeam.id),
            fetchStandupConfigs(selectedTeam.id),
          ]);
        } finally {
          setHasInitiallyLoaded(true);
        }
      };
      loadData();
    }
  }, [selectedTeam, fetchStandupsByTeam, fetchActiveInstances, fetchStandupConfigs]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (selectedTeam) {
        await Promise.all([
          fetchStandupsByTeam(selectedTeam.id),
          fetchActiveInstances(selectedTeam.id),
          fetchStandupConfigs(selectedTeam.id),
        ]);
      }
      toast.success('Data refreshed successfully');
    } catch {
      toast.error('Failed to refresh data');
    } finally {
      setIsRefreshing(false);
    }
  }, [selectedTeam, fetchStandupsByTeam, fetchActiveInstances, fetchStandupConfigs]);

  const handleExportReport = () => {
    toast.info('Export feature coming soon!');
  };

  // const handleSendReminder = async (instanceId: string) => {
  //   try {
  //     toast.loading('Sending reminder...', { id: `reminder-${instanceId}` });
  //     await standupsApi.triggerReminderForInstance(instanceId);
  //     toast.success('Reminder sent successfully!', { id: `reminder-${instanceId}` });
  //   } catch {
  //     toast.error('Failed to send reminder', { id: `reminder-${instanceId}` });
  //   }
  // };

  // Hierarchical navigation handlers
  const toggleConfigExpansion = (configId: string) => {
    const newExpanded = new Set(expandedConfigs);
    if (newExpanded.has(configId)) {
      newExpanded.delete(configId);
    } else {
      newExpanded.add(configId);
    }
    setExpandedConfigs(newExpanded);
  };

  const handleViewResponses = (instance: ActiveStandup, configName: string) => {
    setSelectedInstance({ instance, configName });
    setCurrentView('responses');
  };

  const handleBackToConfigs = () => {
    setCurrentView('configs');
    setSelectedInstance(null);
  };

  const handleSendReminders = async (instance: ActiveStandup, userIds?: string[]) => {
    try {
      const request = {
        instanceId: instance.id,
        userIds,
        type: userIds ? 'individual' : 'broadcast',
        deliveryMethod: instance.deliveryType === 'channel' ? 'channel_mention' : 'direct_message',
      } as const;

      toast.loading('Sending reminders...', { id: `reminder-${instance.id}` });
      await standupsApi.sendIndividualReminder(request);
      toast.success('Reminders sent successfully!', { id: `reminder-${instance.id}` });

      // Refresh data
      if (selectedTeam) {
        await fetchStandupConfigs(selectedTeam.id);
      }
    } catch {
      toast.error('Failed to send reminders', { id: `reminder-${instance.id}` });
    }
  };

  // Handle viewing member responses
  const handleViewMemberResponse = async (
    member: StandupMember,
    instance: ActiveStandup,
    configName: string
  ) => {
    console.log('handleViewMemberResponse called:', { member, instance, configName });

    try {
      // Find the standup config for questions
      const config = standupConfigs.find(c => c.name === configName);
      console.log('Found config:', config);

      if (!config) {
        console.error('Standup configuration not found for:', configName);
        toast.error('Standup configuration not found');
        return;
      }

      console.log('Setting modal state...');

      // Use React.startTransition to ensure state is set properly
      React.startTransition(() => {
        setSelectedMember(member);
        setCurrentStandupConfig(config);
        setIsResponseModalOpen(true);
      });

      // Always try to fetch detailed response data for completed members
      if (member.status === 'completed') {
        console.log('Member is completed, fetching response...');

        try {
          console.log('Calling getMemberResponse with:', {
            instanceId: instance.id,
            memberId: member.id,
          });
          const detailedResponse = await standupsApi.getMemberResponse(instance.id, member.id);
          console.log('Got response:', detailedResponse);

          setMemberResponse(detailedResponse);
        } catch (error) {
          console.error('Failed to load response details:', error);
          // Show error only if needed, but don't show loading toast
          console.warn('Response details not available, modal will show with basic info');
          // Modal stays open with basic member info
          setMemberResponse(null);
        }
      } else {
        console.log('Member not completed, setting null response');
        setMemberResponse(null);
      }
    } catch (error) {
      console.error('Error in handleViewMemberResponse:', error);
      toast.error('Failed to open response details');
    }
  };

  const handleCloseResponseModal = () => {
    console.log('Closing response modal');
    setIsResponseModalOpen(false);
    setSelectedMember(null);
    setMemberResponse(null);
    setCurrentStandupConfig(null);
  };

  // Render standup configurations list
  const renderStandupConfigsList = () => {
    // Don't render anything if still in initial loading phase
    if (!hasInitiallyLoaded && (isLoadingConfigs || isLoadingInstances)) {
      return null; // Let the main loading screen handle this
    }

    if (filteredAndSortedConfigs.length === 0) {
      if (standupConfigs.length === 0) {
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="bg-card rounded-xl border border-border p-8"
          >
            <div className="max-w-md mx-auto text-center">
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4"
              >
                <Calendar className="w-8 h-8 text-primary" />
              </motion.div>

              <h3 className="text-xl font-bold mb-2">No Standup Configurations</h3>
              <p className="text-muted-foreground mb-6">
                Create your first standup configuration to start collecting team updates
              </p>

              <div className="flex gap-3 justify-center">
                <ModernButton
                  variant="primary"
                  onClick={handleCreateStandup}
                  className="group shadow-lg shadow-primary/20"
                >
                  <Plus className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform" />
                  Setup Standup
                </ModernButton>
              </div>
            </div>
          </motion.div>
        );
      } else {
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl border border-border p-12 text-center"
          >
            <Inbox className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No configurations found</h3>
            <p className="text-muted-foreground mb-4">Try adjusting your search or filters</p>
            <ModernButton
              variant="secondary"
              onClick={() => {
                setSearchQuery('');
                setFilterType('all');
              }}
            >
              Clear filters
            </ModernButton>
          </motion.div>
        );
      }
    }

    return (
      <div className="space-y-4">
        {filteredAndSortedConfigs.map((config: StandupConfigWithInstances) => (
          <motion.div
            key={config.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl border border-border overflow-hidden"
          >
            {/* Configuration Header */}
            <div
              className="p-6 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => toggleConfigExpansion(config.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    {expandedConfigs.has(config.id) ? (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    )}
                    <Calendar className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{config.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedTeam?.name} • {config.schedule.days.length} days/week •{' '}
                      {config.schedule.time}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Configuration Stats */}
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">
                      {config.instances.length} instance{config.instances.length !== 1 ? 's' : ''}
                    </div>
                    {config.recentInstance && (
                      <div className="text-xs text-muted-foreground">
                        Latest: {new Date(config.recentInstance.targetDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  {/* Status indicator */}
                  {config.recentInstance && (
                    <div className="flex items-center gap-2">
                      {config.recentInstance.state === 'collecting' && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                          <Clock className="w-3 h-3" />
                          Active
                        </div>
                      )}
                      {config.recentInstance.state === 'completed' && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                          <CheckCircle2 className="w-3 h-3" />
                          Complete
                        </div>
                      )}
                      <div className="text-sm font-medium text-foreground">
                        {config.recentInstance.respondedMembers}/
                        {config.recentInstance.totalMembers}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Instances List (when expanded) */}
            <AnimatePresence>
              {expandedConfigs.has(config.id) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="border-t border-border"
                >
                  <div className="p-6 bg-muted/20">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-md font-medium text-foreground">Recent Instances</h4>
                      {(() => {
                        const triggerStatus = canTriggerToday(config);
                        const isTriggering = triggeringConfigs.has(config.id);

                        return (
                          <div className="relative group">
                            <ModernButton
                              variant="ghost"
                              size="sm"
                              onClick={() => handleTriggerNew(config)}
                              disabled={!triggerStatus.canTrigger || isTriggering}
                              className={`${
                                !triggerStatus.canTrigger
                                  ? 'opacity-50 cursor-not-allowed'
                                  : 'hover:bg-green-50 hover:text-green-600'
                              }`}
                            >
                              {isTriggering ? (
                                <>
                                  <div className="w-4 h-4 mr-1 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                  Triggering...
                                </>
                              ) : (
                                <>
                                  <Plus className="w-4 h-4 mr-1" />
                                  Trigger New
                                </>
                              )}
                            </ModernButton>

                            {/* Tooltip for disabled state */}
                            {!triggerStatus.canTrigger && (
                              <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50">
                                {triggerStatus.reason}
                                <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {config.instances.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No instances yet</p>
                        <p className="text-xs">Trigger a standup to create the first instance</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {config.instances
                          .sort(
                            (a: ActiveStandup, b: ActiveStandup) =>
                              new Date(b.targetDate).getTime() - new Date(a.targetDate).getTime()
                          )
                          .slice(0, 7)
                          .map((instance: ActiveStandup) => (
                            <div
                              key={instance.id}
                              className="flex items-center justify-between p-4 bg-card border border-border/50 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer"
                              onClick={() => handleViewResponses(instance, config.name)}
                            >
                              <div className="flex items-center gap-3">
                                <div className="text-sm font-medium text-foreground">
                                  {new Date(instance.targetDate).toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                  })}
                                </div>
                                <div className="flex items-center gap-2">
                                  {instance.state === 'collecting' && (
                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                  )}
                                  {instance.state === 'completed' && (
                                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                  )}
                                  <span className="text-sm text-muted-foreground capitalize">
                                    {instance.state}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-4">
                                <div className="text-sm text-muted-foreground">
                                  {instance.respondedMembers}/{instance.totalMembers} responses (
                                  {Math.round(
                                    (instance.respondedMembers / instance.totalMembers) * 100
                                  )}
                                  %)
                                </div>

                                <div className="flex gap-1">
                                  {instance.state === 'collecting' && (
                                    <ModernButton
                                      variant="ghost"
                                      size="sm"
                                      onClick={e => {
                                        e.stopPropagation();
                                        handleSendReminders(instance);
                                      }}
                                    >
                                      <Bell className="w-4 h-4" />
                                    </ModernButton>
                                  )}
                                  <ModernButton
                                    variant="ghost"
                                    size="sm"
                                    onClick={e => {
                                      e.stopPropagation();
                                      handleViewResponses(instance, config.name);
                                    }}
                                  >
                                    <MessageSquare className="w-4 h-4" />
                                  </ModernButton>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    );
  };

  // Render instance details with member responses
  const renderInstanceDetails = () => {
    if (!selectedInstance) return null;

    const { instance, configName } = selectedInstance;

    return (
      <div className="space-y-6">
        {/* Header with back button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <ModernButton
            variant="ghost"
            onClick={handleBackToConfigs}
            className="flex items-center gap-2"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            Back to Configurations
          </ModernButton>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-foreground">
              {configName} - {new Date(instance.targetDate).toLocaleDateString()}
            </h2>
            <p className="text-muted-foreground">
              {instance.respondedMembers}/{instance.totalMembers} responses •{' '}
              {Math.round((instance.respondedMembers / instance.totalMembers) * 100)}% complete
            </p>
          </div>

          <div className="flex gap-2">
            {instance.state === 'collecting' && (
              <ModernButton
                variant="secondary"
                onClick={() => handleSendReminders(instance)}
                className="flex items-center gap-2"
              >
                <Bell className="w-4 h-4" />
                Send Reminders
              </ModernButton>
            )}
          </div>
        </motion.div>

        {/* Progress bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-xl border border-border p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-muted-foreground" />
              <span className="font-medium">Team Progress</span>
            </div>
            <div className="text-sm text-muted-foreground">
              {instance.respondedMembers} of {instance.totalMembers} responded
            </div>
          </div>

          <div className="w-full bg-muted rounded-full h-3 mb-2">
            <div
              className="bg-primary h-3 rounded-full transition-all duration-500"
              style={{ width: `${(instance.respondedMembers / instance.totalMembers) * 100}%` }}
            />
          </div>

          <div className="text-sm text-muted-foreground text-center">
            {Math.round((instance.respondedMembers / instance.totalMembers) * 100)}% Complete
          </div>
        </motion.div>

        {/* Members list */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-xl border border-border p-6"
        >
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Team Members
          </h3>

          <div className="space-y-3">
            {(instance.members || []).map(member => (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 bg-muted/30 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={member.name} avatar={member.avatar} size="sm" />
                  <div>
                    <div className="font-medium text-foreground">{member.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {member.status === 'completed' && (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="w-3 h-3" />
                          Responded
                          {member.responseTime && (
                            <span className="text-muted-foreground">
                              at {new Date(member.responseTime).toLocaleTimeString()}
                            </span>
                          )}
                          {member.response && (
                            <span className="text-xs text-blue-600 ml-2">• Has response data</span>
                          )}
                        </span>
                      )}
                      {member.status === 'not_started' && (
                        <span className="flex items-center gap-1 text-orange-600">
                          <Clock className="w-3 h-3" />
                          Not started
                        </span>
                      )}
                      {member.status === 'overdue' && (
                        <span className="flex items-center gap-1 text-red-600">
                          <AlertCircle className="w-3 h-3" />
                          Overdue
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {member.reminderCount > 0 && (
                    <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                      {member.reminderCount} reminder{member.reminderCount > 1 ? 's' : ''}
                    </div>
                  )}

                  {member.status !== 'completed' && (
                    <ModernButton
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSendReminders(instance, [member.id])}
                    >
                      <Bell className="w-4 h-4" />
                    </ModernButton>
                  )}

                  {member.status === 'completed' && (
                    <ModernButton
                      variant="ghost"
                      size="sm"
                      onClick={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('View Response button clicked');
                        handleViewMemberResponse(member, instance, configName);
                      }}
                      className="flex items-center gap-1 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span className="text-xs">View Response</span>
                    </ModernButton>
                  )}
                </div>
              </div>
            ))}

            {(!instance.members || instance.members.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No team members found</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    );
  };

  const handleCreateStandup = () => {
    // Navigate to standup configuration wizard to create a new standup template
    if (selectedTeam) {
      navigate(`/teams/${selectedTeam.id}/standups/wizard`);
    } else {
      toast.error('Please select a team first');
    }
  };

  /**
   * Handle triggering a new standup instance for a specific configuration
   */
  const handleTriggerNew = async (config: StandupConfigWithInstances) => {
    if (!selectedTeam) {
      toast.error('Please select a team first');
      return;
    }

    // Check if already triggering this config
    if (triggeringConfigs.has(config.id)) {
      return;
    }

    try {
      setTriggeringConfigs(prev => new Set(prev).add(config.id));

      // Step 1: Check if standup instance already exists for today (local check)
      const today = new Date();
      const todayDateString = today.toDateString();

      const existingTodayInstance = config.instances.find(instance => {
        const instanceDate = new Date(instance.targetDate);
        return instanceDate.toDateString() === todayDateString;
      });

      if (existingTodayInstance) {
        toast.error('A standup instance for today already exists for this configuration');
        return;
      }

      // Step 2: Verify with backend if team should create standup today
      toast.loading('Checking if standup should be created today...', {
        id: `trigger-${config.id}`,
      });

      console.log(`Checking if team ${selectedTeam.id} should create standup today`);

      try {
        const shouldCreateCheck = await standupsApi.shouldCreateStandupToday(selectedTeam.id);
        console.log('Should create standup today:', shouldCreateCheck);

        if (!shouldCreateCheck.shouldCreate) {
          toast.error(
            `No standup should be created for this team today (${shouldCreateCheck.date})`,
            { id: `trigger-${config.id}` }
          );
          return;
        }
      } catch (checkError) {
        console.warn(
          'Failed to check should-create-today, continuing with trigger attempt:',
          checkError
        );
      }

      // Step 3: Create a new standup instance and send Slack message
      toast.loading('Creating standup instance and sending notifications...', {
        id: `trigger-${config.id}`,
      });

      console.log(
        `Attempting to trigger standup for team: ${selectedTeam.id}, config: ${config.id}`
      );

      // Use the targeted API to create instance for this specific config
      const result = await standupsApi.triggerStandupForConfig(config.id);

      console.log('triggerStandupForConfig result:', result);

      // Check results and provide appropriate feedback
      if (result.success && result.instanceId) {
        toast.success(`Successfully created standup instance and sent notifications!`, {
          id: `trigger-${config.id}`,
        });

        // Log message results for debugging
        if (result.messageResult) {
          console.log('Slack message result:', result.messageResult);
          if (!result.messageResult.success) {
            console.warn('Slack message failed:', result.messageResult.error);
          }
        }

        // Refresh data to show the new instance
        if (selectedTeam) {
          await Promise.all([
            fetchStandupConfigs(selectedTeam.id),
            fetchActiveInstances(selectedTeam.id),
          ]);
        }
      } else {
        console.log('Standup creation failed:', result.message);
        toast.warning(result.message, {
          id: `trigger-${config.id}`,
        });
      }
    } catch (error) {
      console.error('Error triggering standup:', error);

      // Provide more specific error messages based on the error
      if (error instanceof Error && error.message.includes('403')) {
        toast.error(
          'You do not have permission to trigger standups. Admin or owner role required.',
          { id: `trigger-${config.id}` }
        );
      } else if (error instanceof Error && error.message.includes('404')) {
        toast.error('Standup configuration or team not found.', { id: `trigger-${config.id}` });
      } else {
        toast.error(
          `Failed to trigger standup: ${error instanceof Error ? error.message : 'Unknown error'}`,
          { id: `trigger-${config.id}` }
        );
      }
    } finally {
      setTriggeringConfigs(prev => {
        const newSet = new Set(prev);
        newSet.delete(config.id);
        return newSet;
      });
    }
  };

  /**
   * Check if a standup config can be triggered today
   */
  const canTriggerToday = (
    config: StandupConfigWithInstances
  ): {
    canTrigger: boolean;
    reason?: string;
  } => {
    const today = new Date();
    const todayDateString = today.toDateString();

    // Check if instance already exists for today
    const existingTodayInstance = config.instances.find(instance => {
      const instanceDate = new Date(instance.targetDate);
      return instanceDate.toDateString() === todayDateString;
    });

    if (existingTodayInstance) {
      return {
        canTrigger: false,
        reason: 'Instance already exists for today',
      };
    }

    // Check if standup is scheduled for today
    const currentDayIndex = today.getDay();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDayName = dayNames[currentDayIndex];

    if (!config.schedule.days.includes(currentDayName as (typeof config.schedule.days)[number])) {
      return {
        canTrigger: false,
        reason: `Not scheduled for ${currentDayName}s`,
      };
    }

    // Check if config is active
    if (!config.isActive) {
      return {
        canTrigger: false,
        reason: 'Configuration is not active',
      };
    }

    return { canTrigger: true };
  };

  // Filter and sort configs
  const filteredAndSortedConfigs = useMemo(() => {
    let filtered = [...standupConfigs];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(config =>
        config.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply filter
    switch (filterType) {
      case 'active':
        filtered = filtered.filter(config =>
          config.instances.some(inst => inst.state === 'collecting')
        );
        break;
      case 'completed':
        filtered = filtered.filter(config =>
          config.instances.some(inst => inst.state === 'completed')
        );
        break;
      case 'overdue':
        filtered = filtered.filter(config =>
          config.instances.some(inst => inst.members?.some(m => m.status === 'overdue'))
        );
        break;
      case 'favorites':
        filtered = filtered.filter(config => favoriteStandups.includes(config.id));
        break;
    }

    // Apply sort
    filtered.sort((a, b) => {
      // Favorites always come first
      const aIsFav = favoriteStandups.includes(a.id);
      const bIsFav = favoriteStandups.includes(b.id);
      if (aIsFav && !bIsFav) return -1;
      if (!aIsFav && bIsFav) return 1;

      switch (sortType) {
        case 'date': {
          const aRecent = a.recentInstance?.targetDate;
          const bRecent = b.recentInstance?.targetDate;
          if (!aRecent && !bRecent) return 0;
          if (!aRecent) return 1;
          if (!bRecent) return -1;
          return new Date(bRecent).getTime() - new Date(aRecent).getTime();
        }
        case 'team':
          return a.name.localeCompare(b.name);
        case 'progress': {
          const aProgress = a.recentInstance
            ? a.recentInstance.totalMembers > 0
              ? a.recentInstance.respondedMembers / a.recentInstance.totalMembers
              : 0
            : 0;
          const bProgress = b.recentInstance
            ? b.recentInstance.totalMembers > 0
              ? b.recentInstance.respondedMembers / b.recentInstance.totalMembers
              : 0
            : 0;
          return bProgress - aProgress;
        }
        case 'activity': {
          const aActivity = a.recentInstance?.createdAt;
          const bActivity = b.recentInstance?.createdAt;
          if (!aActivity && !bActivity) return 0;
          if (!aActivity) return 1;
          if (!bActivity) return -1;
          return new Date(bActivity).getTime() - new Date(aActivity).getTime();
        }
        default:
          return 0;
      }
    });

    return filtered;
  }, [standupConfigs, searchQuery, filterType, sortType, favoriteStandups]);

  // Filter and sort instances (for legacy components)
  const filteredAndSortedInstances = useMemo(() => {
    let filtered = [...activeInstances];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(instance =>
        instance.teamName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply filter
    switch (filterType) {
      case 'active':
        filtered = filtered.filter(inst => inst.state === 'collecting');
        break;
      case 'completed':
        filtered = filtered.filter(inst => inst.state === 'completed');
        break;
      case 'overdue':
        filtered = filtered.filter(inst => inst.members?.some(m => m.status === 'overdue'));
        break;
      case 'favorites':
        filtered = filtered.filter(inst => favoriteStandups.includes(inst.id));
        break;
    }

    // Apply sort
    filtered.sort((a, b) => {
      // Favorites always come first
      const aIsFav = favoriteStandups.includes(a.id);
      const bIsFav = favoriteStandups.includes(b.id);
      if (aIsFav && !bIsFav) return -1;
      if (!aIsFav && bIsFav) return 1;

      switch (sortType) {
        case 'date':
          return new Date(b.targetDate).getTime() - new Date(a.targetDate).getTime();
        case 'team':
          return a.teamName.localeCompare(b.teamName);
        case 'progress': {
          const aProgress = a.totalMembers > 0 ? a.respondedMembers / a.totalMembers : 0;
          const bProgress = b.totalMembers > 0 ? b.respondedMembers / b.totalMembers : 0;
          return bProgress - aProgress;
        }
        case 'activity':
          // Sort by most recent activity (simplified - would need activity timestamps)
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default:
          return 0;
      }
    });

    return filtered;
  }, [activeInstances, searchQuery, filterType, sortType, favoriteStandups]);

  // Calculate stats
  const stats = useMemo(() => {
    const activeCount = activeInstances.filter(s => s.state === 'collecting').length;
    const completedCount = activeInstances.filter(s => s.state === 'completed').length;
    const totalResponses = activeInstances.reduce((acc, inst) => acc + inst.respondedMembers, 0);
    const totalExpected = activeInstances.reduce((acc, inst) => acc + inst.totalMembers, 0);
    const responseRate = totalExpected > 0 ? Math.round((totalResponses / totalExpected) * 100) : 0;

    const todayInstances = activeInstances.filter(inst => {
      const today = new Date().toDateString();
      return new Date(inst.targetDate).toDateString() === today;
    });

    const todayResponses = todayInstances.reduce((acc, inst) => acc + inst.respondedMembers, 0);
    const todayExpected = todayInstances.reduce((acc, inst) => acc + inst.totalMembers, 0);

    const avgResponseTime =
      activeInstances.reduce((acc, inst) => {
        return acc + (inst.avgResponseTime || 0);
      }, 0) / (activeInstances.length || 1);

    return {
      responseRate,
      todayStatus: `${todayResponses}/${todayExpected}`,
      activeCount,
      completedCount,
      totalInstances: activeInstances.length,
      avgResponseTime: Math.round(avgResponseTime),
    };
  }, [activeInstances]);

  if ((isLoadingConfigs || isLoadingInstances) && !hasInitiallyLoaded) {
    return (
      <div className="min-h-screen bg-background">
        <main className="max-w-7xl mx-auto px-6 py-8">
          {/* Header skeleton */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
            <div>
              <div className="h-8 bg-muted rounded w-48 mb-2 animate-pulse" />
              <div className="h-5 bg-muted rounded w-64 animate-pulse" />
            </div>
            <div className="h-9 bg-muted rounded w-32 animate-pulse" />
          </div>

          {/* Team selector skeleton */}
          <div className="mb-6">
            <div className="h-10 bg-muted rounded w-40 animate-pulse" />
          </div>

          {/* Stats skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2 bg-card rounded-2xl border border-border p-6">
              <div className="h-6 bg-muted rounded w-32 mb-4 animate-pulse" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="text-center p-4 bg-muted/20 rounded-xl">
                    <div className="h-8 bg-muted rounded w-12 mx-auto mb-2 animate-pulse" />
                    <div className="h-4 bg-muted rounded w-16 mx-auto mb-1 animate-pulse" />
                    <div className="h-3 bg-muted rounded w-20 mx-auto animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-card rounded-2xl border border-border p-6">
              <div className="h-6 bg-muted rounded w-32 mb-4 animate-pulse" />
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-muted rounded-full animate-pulse" />
                    <div className="flex-1">
                      <div className="h-4 bg-muted rounded w-24 mb-1 animate-pulse" />
                      <div className="h-3 bg-muted rounded w-16 animate-pulse" />
                    </div>
                    <div className="h-3 bg-muted rounded w-8 animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Standup configurations skeleton */}
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="bg-card rounded-xl border border-border overflow-hidden animate-pulse"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-14 h-14 bg-muted rounded-xl" />
                      <div className="flex-1">
                        <div className="h-5 bg-muted rounded w-40 mb-2" />
                        <div className="h-4 bg-muted rounded w-64 mb-3" />
                        <div className="bg-muted/30 rounded-lg p-3 mb-4">
                          <div className="h-3 bg-muted rounded w-24 mb-2" />
                          <div className="space-y-1">
                            <div className="h-4 bg-muted rounded w-full" />
                            <div className="h-4 bg-muted rounded w-5/6" />
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="h-4 bg-muted rounded w-20" />
                          <div className="h-4 bg-muted rounded w-16" />
                        </div>
                      </div>
                    </div>
                    <div className="h-6 bg-muted rounded-full w-16" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6"
        >
          <div>
            <motion.h1
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-2xl sm:text-4xl font-bold text-foreground mb-2"
            >
              <span className="bg-gradient-to-r from-foreground via-blue-600/80 to-foreground bg-clip-text text-transparent">
                Standups Overview
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-muted-foreground text-base sm:text-lg"
            >
              Track and manage all your team standups in one place.
            </motion.p>
          </div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-wrap gap-2 sm:gap-3"
          >
            <ModernButton
              variant="primary"
              onClick={handleCreateStandup}
              className="group shadow-lg shadow-primary/20 flex-1 sm:flex-none"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform" />
              <span className="sm:inline">Setup Standup</span>
            </ModernButton>
          </motion.div>
        </motion.div>

        {/* Team Selector */}
        {teams.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-6"
          >
            <Dropdown
              trigger={
                <ModernButton variant="secondary" className="h-10">
                  <Building2 className="w-4 h-4 mr-2" />
                  {selectedTeam?.name || 'Select Team'}
                  <ChevronDown className="w-4 h-4 ml-2" />
                </ModernButton>
              }
              items={teams.map(team => ({
                label: team.name,
                onClick: () => selectTeam(team),
              }))}
              align="left"
            />
          </motion.div>
        )}

        {/* Quick Stats + Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Quick Stats */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6"
          >
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              Quick Stats
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-emerald-50 rounded-xl">
                <div className="text-2xl font-bold text-emerald-600">{stats.responseRate}%</div>
                <div className="text-xs text-slate-600 mt-1">Response Rate</div>
                <div className="text-xs text-emerald-600 font-medium">
                  {stats.todayStatus} today
                </div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-xl">
                <div className="text-2xl font-bold text-blue-600">{stats.activeCount}</div>
                <div className="text-xs text-slate-600 mt-1">Active</div>
                <div className="text-xs text-blue-600 font-medium">Currently collecting</div>
              </div>
              <div className="text-center p-4 bg-violet-50 rounded-xl">
                <div className="text-2xl font-bold text-violet-600">{stats.completedCount}</div>
                <div className="text-xs text-slate-600 mt-1">Completed</div>
                <div className="text-xs text-violet-600 font-medium">All responses in</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-xl">
                <div className="text-2xl font-bold text-orange-600">{stats.avgResponseTime}m</div>
                <div className="text-xs text-slate-600 mt-1">Avg Time</div>
                <div className="text-xs text-orange-600 font-medium">Response speed</div>
              </div>
            </div>
          </motion.div>

          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="bg-slate-50 rounded-2xl border border-slate-200 p-6"
          >
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-slate-600" />
              Recent Activity
            </h3>
            <div className="space-y-3">
              {filteredAndSortedInstances.slice(0, 4).map(instance => (
                <div key={instance.id} className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      instance.state === 'collecting'
                        ? 'bg-green-500'
                        : instance.state === 'completed'
                          ? 'bg-blue-500'
                          : 'bg-slate-400'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {instance.teamName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {instance.respondedMembers}/{instance.totalMembers} responses
                    </p>
                  </div>
                  <div className="text-xs text-slate-400">
                    {Math.round((instance.respondedMembers / instance.totalMembers) * 100)}%
                  </div>
                </div>
              ))}
              {filteredAndSortedInstances.length === 0 && (
                <div className="text-sm text-slate-500 text-center py-4">No recent activity</div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Search, Filter, and Sort Bar */}
        {(standupConfigs.length > 0 || currentView === 'responses') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex items-center gap-3 mb-6 flex-wrap"
          >
            {/* Search */}
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search standups..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-4 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter */}
            <Dropdown
              trigger={
                <ModernButton variant="secondary" className="h-10">
                  <Filter className="w-4 h-4 mr-2" />
                  Filter:{' '}
                  {filterType === 'all'
                    ? 'All'
                    : filterType.charAt(0).toUpperCase() + filterType.slice(1)}
                </ModernButton>
              }
              items={[
                { label: 'All Standups', onClick: () => setFilterType('all') },
                { label: 'Active', onClick: () => setFilterType('active') },
                { label: 'Completed', onClick: () => setFilterType('completed') },
                { label: 'Has Overdue', onClick: () => setFilterType('overdue') },
                { label: 'Favorites', onClick: () => setFilterType('favorites') },
              ]}
            />

            {/* Sort */}
            <Dropdown
              trigger={
                <ModernButton variant="secondary" className="h-10">
                  <SortAsc className="w-4 h-4 mr-2" />
                  Sort: {sortType.charAt(0).toUpperCase() + sortType.slice(1)}
                </ModernButton>
              }
              items={[
                { label: 'By Date', onClick: () => setSortType('date') },
                { label: 'By Team', onClick: () => setSortType('team') },
                { label: 'By Progress', onClick: () => setSortType('progress') },
                { label: 'By Activity', onClick: () => setSortType('activity') },
              ]}
            />

            {/* Refresh & Export */}
            <div className="flex gap-2">
              <ModernButton
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </ModernButton>
              <ModernButton variant="ghost" size="sm" onClick={handleExportReport}>
                <Download className="w-4 h-4" />
              </ModernButton>
            </div>
          </motion.div>
        )}

        {/* Render based on current view */}
        {currentView === 'configs' && renderStandupConfigsList()}
        {currentView === 'responses' && selectedInstance && renderInstanceDetails()}
      </main>

      {/* Modals */}
      {selectedInstanceId && (
        <>
          {(() => {
            const selectedInstance = activeInstances.find(inst => inst.id === selectedInstanceId);
            if (!selectedInstance) return null;

            return (
              <>
                <MemberDetailsView
                  isOpen={isMemberDetailsOpen}
                  onClose={() => {
                    setIsMemberDetailsOpen(false);
                    setSelectedInstanceId(null);
                  }}
                  instance={selectedInstance}
                  onSendReminder={async request => {
                    await standupsApi.sendIndividualReminder(request);
                    fetchActiveInstances(selectedTeam?.id);
                  }}
                  onUpdateResponse={async (instanceId, userId, answers) => {
                    await standupsApi.updateMemberResponse(instanceId, userId, answers);
                    fetchActiveInstances(selectedTeam?.id);
                  }}
                />
                <SmartReminderModal
                  isOpen={isSmartReminderOpen}
                  onClose={() => {
                    setIsSmartReminderOpen(false);
                    setSelectedInstanceId(null);
                  }}
                  instanceId={selectedInstanceId}
                  members={selectedInstance.members || []}
                  deliveryType={selectedInstance.deliveryType || 'direct_message'}
                  teamName={selectedInstance.teamName}
                  onSendReminder={async request => {
                    await standupsApi.sendIndividualReminder(request);
                    fetchActiveInstances(selectedTeam?.id);
                  }}
                />
              </>
            );
          })()}
        </>
      )}

      {/* Debug Test Modal was here - removed to focus on real modal */}

      {/* ResponseDetailsModal - RE-ENABLED */}
      {isResponseModalOpen && selectedMember && currentStandupConfig && (
        <div style={{ zIndex: 10000 }} className="fixed inset-0">
          <ResponseDetailsModal
            key={`response-modal-${selectedMember.id}`}
            isOpen={true}
            onClose={() => {
              console.log('ResponseDetailsModal onClose called');
              handleCloseResponseModal();
            }}
            member={selectedMember}
            response={memberResponse || undefined}
            questions={currentStandupConfig.questions || []}
            isReadOnly={true}
          />
        </div>
      )}
    </div>
  );
};
