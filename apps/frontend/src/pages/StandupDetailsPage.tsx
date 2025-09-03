import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ModernButton } from '@/components/ui';
import {
  ArrowLeft,
  Calendar,
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  User,
  Eye,
  Send,
} from 'lucide-react';
import { toast } from '@/components/ui';
import { standupsApi } from '@/lib/api';
import type { ActiveStandup } from '@/lib/api';

interface StandupAnswer {
  id: string;
  memberName: string;
  answers: Record<string, string>;
  submittedAt: string;
}

interface StandupDetails extends ActiveStandup {
  answers: StandupAnswer[];
}

export const StandupDetailsPage = React.memo(() => {
  const { standupId } = useParams<{ standupId: string }>();
  const navigate = useNavigate();

  const [standup, setStandup] = useState<StandupDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'responses'>('overview');

  useEffect(() => {
    const loadStandupDetails = async () => {
      if (!standupId) return;

      setIsLoading(true);
      try {
        // Fetch the standup configuration
        const standupConfig = await standupsApi.getStandup(standupId);

        // For now, we'll use mock data structure with real standup config
        const mockStandup: StandupDetails = {
          id: standupId || 'mock-standup-id',
          teamId: standupConfig.teamId,
          teamName: 'Engineering Team', // TODO: Get from team data
          targetDate: new Date().toISOString().split('T')[0], // Today's date
          state: 'collecting',
          totalMembers: 5, // TODO: Get actual team member count
          respondedMembers: 3, // TODO: Get actual response count
          responseRate: 60,
          questions: standupConfig.questions,
          timezone: 'UTC',
          timeLocal: '09:00',
          createdAt: '2024-01-15T00:00:00Z',
          deliveryType: standupConfig.deliveryType,
          members: [],
          reminderHistory: [],
          answers: [
            {
              id: '1',
              memberName: 'John Doe',
              answers: {
                'What did you work on yesterday?': 'Worked on user authentication',
                'What will you work on today?': 'Will implement password reset',
                'Any blockers or challenges?': 'Need clarification on security requirements',
              },
              submittedAt: new Date().toISOString(),
            },
            {
              id: '2',
              memberName: 'Jane Smith',
              answers: {
                'What did you work on yesterday?': 'Fixed bugs in the dashboard',
                'What will you work on today?': 'Will work on the new reporting feature',
                'Any blockers or challenges?': 'No blockers',
              },
              submittedAt: new Date().toISOString(),
            },
          ],
        };

        setStandup(mockStandup);
      } catch (error) {
        console.error('Error loading standup details:', error);
        toast.error('Failed to load standup details');
        navigate('/integrations');
      } finally {
        setIsLoading(false);
      }
    };

    loadStandupDetails();
  }, [standupId, navigate]);

  const handleTriggerReminder = async () => {
    if (!standupId) return;

    try {
      toast.loading('Sending Slack reminder...', { id: 'trigger-reminder' });
      const result = await standupsApi.triggerReminderForInstance(standupId);

      if (result.success) {
        toast.success('Slack reminder sent successfully!', { id: 'trigger-reminder' });
      } else {
        toast.error(`Failed to send reminder: ${result.error || 'Unknown error'}`, {
          id: 'trigger-reminder',
        });
      }
    } catch (error) {
      console.error('Error triggering reminder:', error);
      toast.error('Failed to send reminder. Please try again.', { id: 'trigger-reminder' });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading standup details...</p>
        </div>
      </div>
    );
  }

  if (!standup) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Standup Not Found</h2>
          <p className="text-muted-foreground mb-4">
            The standup you're looking for doesn't exist.
          </p>
          <ModernButton onClick={() => navigate('/integrations')}>
            Back to Integrations
          </ModernButton>
        </div>
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
          className="flex items-center gap-4 mb-8"
        >
          <button onClick={() => navigate(-1)}>
            <ModernButton variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
            </ModernButton>
          </button>

          <div className="flex items-center gap-3 flex-1">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
              <Calendar className="text-white" size={24} />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-bold">{standup.teamName} Standup</h1>
                <span
                  className={`px-3 py-1 text-xs font-medium rounded-full ${
                    standup.state === 'collecting'
                      ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300'
                      : standup.state === 'completed'
                        ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {standup.state === 'collecting'
                    ? 'Collecting Responses'
                    : standup.state === 'completed'
                      ? 'Completed'
                      : standup.state}
                </span>
              </div>
              <p className="text-muted-foreground text-lg">
                {formatDate(standup.targetDate)} at {standup.timeLocal} ({standup.timezone})
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            {standup.state === 'collecting' && (
              <ModernButton
                variant="outline"
                onClick={handleTriggerReminder}
                className="flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Send Reminder
              </ModernButton>
            )}
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
        >
          <div className="bg-card rounded-2xl p-6 border border-border">
            <div className="flex items-center gap-3 mb-3">
              <Users className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">
                  {standup.respondedMembers}/{standup.totalMembers}
                </p>
                <p className="text-sm text-muted-foreground">Responses</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-2xl p-6 border border-border">
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{standup.responseRate}%</p>
                <p className="text-sm text-muted-foreground">Response Rate</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-2xl p-6 border border-border">
            <div className="flex items-center gap-3 mb-3">
              <Clock className="w-8 h-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">
                  {standup.totalMembers - standup.respondedMembers}
                </p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex gap-1 mb-8 p-1 bg-muted rounded-lg w-fit"
        >
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-6 py-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'overview'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Eye className="w-4 h-4 inline mr-2" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('responses')}
            className={`px-6 py-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'responses'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <MessageSquare className="w-4 h-4 inline mr-2" />
            Responses ({standup.answers.length})
          </button>
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="bg-card rounded-2xl border border-border p-8"
        >
          {activeTab === 'overview' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-semibold mb-6">Standup Questions</h2>
                <div className="space-y-4">
                  {standup.questions.map((question, index) => (
                    <div key={index} className="p-4 bg-muted/50 rounded-lg border border-border">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </div>
                        <p className="text-foreground">{question}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {standup.state === 'collecting' && (
                <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <AlertTriangle className="w-6 h-6 text-yellow-500" />
                    <h3 className="text-lg font-semibold text-yellow-700 dark:text-yellow-300">
                      Collection in Progress
                    </h3>
                  </div>
                  <p className="text-yellow-700 dark:text-yellow-300">
                    This standup is currently collecting responses. Team members can still submit
                    their answers.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'responses' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold">Team Responses</h2>
                <p className="text-muted-foreground">
                  {standup.answers.length} of {standup.totalMembers} submitted
                </p>
              </div>

              <div className="space-y-6">
                {standup.answers.map(answer => (
                  <div key={answer.id} className="p-6 bg-muted/50 rounded-lg border border-border">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold">{answer.memberName}</p>
                        <p className="text-sm text-muted-foreground">
                          Submitted {formatDate(answer.submittedAt)}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {Object.entries(answer.answers).map(([question, response], index) => (
                        <div key={index}>
                          <p className="text-sm font-medium text-muted-foreground mb-2">
                            {question}
                          </p>
                          <p className="text-foreground pl-4 border-l-2 border-border">
                            {response}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {standup.answers.length === 0 && (
                  <div className="text-center py-12">
                    <MessageSquare className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Responses Yet</h3>
                    <p className="text-muted-foreground">
                      Team members haven't submitted their standup responses yet.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
});

StandupDetailsPage.displayName = 'StandupDetailsPage';
