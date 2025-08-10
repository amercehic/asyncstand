import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ModernButton } from '@/components/ui';
import { ArrowLeft, Send, Clock, CheckCircle, Users, Calendar } from 'lucide-react';
import { useAuth } from '@/contexts';
import { toast } from 'sonner';
import { standupsApi } from '@/lib/api';
import type { StandupConfig, StandupInstance, Team } from '@/types';

interface ResponseFormData {
  answers: Record<string, string>;
}

export const StandupResponsePage = React.memo(() => {
  const { instanceId } = useParams<{ instanceId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [standup, setStandup] = useState<StandupConfig | null>(null);
  const [instance, setInstance] = useState<StandupInstance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<ResponseFormData>({ answers: {} });
  const [hasExistingResponse, setHasExistingResponse] = useState(false);

  useEffect(() => {
    const fetchInstanceData = async () => {
      if (!instanceId) return;

      try {
        setIsLoading(true);

        // Fetch the standup instance
        const instanceData = await standupsApi.getInstance(instanceId);
        setInstance(instanceData);

        // Fetch the standup configuration
        const standupData = await standupsApi.getStandup(instanceData.configId);
        setStandup(standupData);

        // For now, we'll create a mock team since we don't have the team info in the instance
        // In a real app, the instance or standup would include team information
        const mockTeam: Team = {
          id: standupData.teamId,
          name: 'Team', // This should come from the actual team data
          description: '',
          members: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setTeam(mockTeam);

        // Check if user has already responded
        const existingResponse = instanceData.responses.find(r => r.userId === user?.id);
        const hasResponse = !!existingResponse;

        if (hasResponse && existingResponse) {
          setFormData({ answers: existingResponse.answers });
        } else {
          // Initialize empty answers
          const initialAnswers: Record<string, string> = {};
          standupData.questions.forEach((_, index) => {
            initialAnswers[index.toString()] = '';
          });
          setFormData({ answers: initialAnswers });
        }

        setHasExistingResponse(hasResponse);
      } catch (error) {
        console.error('Error fetching instance data:', error);
        toast.error('Failed to load standup data');
        setStandup(null);
        setInstance(null);
        setTeam(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInstanceData();
  }, [instanceId, user?.id]);

  const handleAnswerChange = (questionIndex: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      answers: {
        ...prev.answers,
        [questionIndex.toString()]: value,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!standup || !instance || !user) return;

    // Validate that all questions are answered
    const unansweredQuestions = standup.questions.filter((_, index) => {
      const answer = formData.answers[index.toString()];
      return !answer || !answer.trim();
    });

    if (unansweredQuestions.length > 0) {
      toast.error('Please answer all questions before submitting');
      return;
    }

    setIsSubmitting(true);

    try {
      if (hasExistingResponse) {
        await standupsApi.updateResponse(instanceId!, formData.answers);
        toast.success('Response updated successfully');
      } else {
        await standupsApi.submitResponse(instanceId!, formData.answers);
        toast.success('Response submitted successfully');
      }

      navigate(`/teams/${team?.id}`);
    } catch (error) {
      console.error('Error submitting response:', error);
      toast.error('Failed to submit response');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading standup...</p>
        </div>
      </div>
    );
  }

  if (!standup || !instance || !team) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Standup Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The standup you're looking for doesn't exist or has expired.
          </p>
          <ModernButton variant="primary" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </ModernButton>
        </div>
      </div>
    );
  }

  const completedResponses = instance.responses.length;
  const totalParticipants = instance.participants.length;
  const completionRate = Math.round((completedResponses / totalParticipants) * 100);

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-4 mb-8"
        >
          <ModernButton variant="ghost" size="sm" onClick={() => navigate(`/teams/${team.id}`)}>
            <ArrowLeft className="w-4 h-4" />
          </ModernButton>
          <div>
            <h1 className="text-3xl font-bold">{standup.name}</h1>
            <p className="text-muted-foreground text-lg">
              {formatDate(instance.date)} • {team.name}
            </p>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-2">
            {hasExistingResponse && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <p className="text-green-800 font-medium">
                    You've already submitted a response. You can update it below.
                  </p>
                </div>
              </motion.div>
            )}

            <form onSubmit={handleSubmit}>
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="bg-card rounded-2xl p-6 border border-border"
              >
                <h2 className="text-xl font-semibold mb-6">Your Responses</h2>

                <div className="space-y-6">
                  {standup.questions.map((question, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.2 + index * 0.1 }}
                      className="space-y-3"
                    >
                      <label className="block text-sm font-medium">Question {index + 1}</label>
                      <p className="text-muted-foreground mb-3">{question}</p>
                      <textarea
                        value={formData.answers[index.toString()] || ''}
                        onChange={e => handleAnswerChange(index, e.target.value)}
                        className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                        rows={4}
                        placeholder="Type your response here..."
                        required
                        data-testid={`answer-${index}`}
                      />
                    </motion.div>
                  ))}
                </div>

                <div className="mt-8 pt-6 border-t border-border">
                  <div className="flex gap-4">
                    <ModernButton
                      type="button"
                      variant="secondary"
                      onClick={() => navigate(`/teams/${team.id}`)}
                    >
                      Cancel
                    </ModernButton>
                    <ModernButton
                      type="submit"
                      variant="primary"
                      disabled={isSubmitting}
                      data-testid="submit-response-button"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" />
                          {hasExistingResponse ? 'Updating...' : 'Submitting...'}
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          {hasExistingResponse ? 'Update Response' : 'Submit Response'}
                        </>
                      )}
                    </ModernButton>
                  </div>
                </div>
              </motion.div>
            </form>
          </div>

          {/* Sidebar */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-6"
          >
            {/* Standup Info */}
            <div className="bg-card rounded-2xl p-6 border border-border">
              <h3 className="text-lg font-semibold mb-4">Standup Info</h3>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium">{standup.name}</p>
                    <p className="text-sm text-muted-foreground">{team.name}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium">{formatDate(instance.date)}</p>
                    <p className="text-sm text-muted-foreground">Due at {standup.schedule.time}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium">Team Progress</p>
                    <p className="text-sm text-muted-foreground">
                      {completedResponses}/{totalParticipants} responses ({completionRate}%)
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Progress */}
            <div className="bg-card rounded-2xl p-6 border border-border">
              <h3 className="text-lg font-semibold mb-4">Response Progress</h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span>Completed</span>
                  <span className="font-medium">
                    {completedResponses}/{totalParticipants}
                  </span>
                </div>

                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-500"
                    style={{ width: `${completionRate}%` }}
                  />
                </div>

                <p className="text-sm text-muted-foreground">
                  {totalParticipants - completedResponses} team member
                  {totalParticipants - completedResponses !== 1 ? 's' : ''} yet to respond
                </p>
              </div>
            </div>

            {/* Status */}
            <div className="bg-card rounded-2xl p-6 border border-border">
              <h3 className="text-lg font-semibold mb-4">Status</h3>

              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    instance.status === 'active'
                      ? 'bg-green-500'
                      : instance.status === 'pending'
                        ? 'bg-yellow-500'
                        : 'bg-gray-500'
                  }`}
                />
                <span className="capitalize font-medium">{instance.status}</span>
              </div>

              {instance.status === 'active' && (
                <p className="text-sm text-muted-foreground mt-2">
                  This standup is currently accepting responses.
                </p>
              )}
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
});
