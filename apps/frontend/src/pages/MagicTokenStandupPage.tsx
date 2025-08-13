import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ModernButton } from '@/components/ui';
import { Send, Clock, CheckCircle, Users, AlertTriangle } from 'lucide-react';
import { toast } from '@/components/ui';
import { magicTokenApiClient } from '@/lib/api-client/magic-token';
import type { MagicTokenStandupInfo } from '@/lib/api-client/magic-token';

interface ResponseFormData {
  answers: Record<string, string>;
}

export const MagicTokenStandupPage = React.memo(() => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [standupInfo, setStandupInfo] = useState<MagicTokenStandupInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<ResponseFormData>({ answers: {} });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError('Magic token is missing from the URL');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const info = await magicTokenApiClient.validateTokenAndGetInfo(token);
        setStandupInfo(info);

        // Initialize empty answers
        const initialAnswers: Record<string, string> = {};
        info.questions.forEach((_, index) => {
          initialAnswers[index.toString()] = '';
        });
        setFormData({ answers: initialAnswers });
      } catch (error) {
        console.error('Error validating magic token:', error);
        let errorMessage = 'Failed to load standup information';
        if (error && typeof error === 'object' && 'response' in error) {
          const err = error as { response?: { status?: number } };
          if (err.response?.status === 401) {
            errorMessage = 'Magic token has expired';
          } else if (err.response?.status === 404) {
            errorMessage = 'Standup not found or no longer active';
          }
        }
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    validateToken();
  }, [token]);

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

    if (!standupInfo || !token) return;

    // Validate that all questions are answered
    const unansweredQuestions = standupInfo.questions.filter((_, index) => {
      const answer = formData.answers[index.toString()];
      return !answer || !answer.trim();
    });

    if (unansweredQuestions.length > 0) {
      toast.error('Please answer all questions before submitting');
      return;
    }

    setIsSubmitting(true);

    try {
      // Convert answers to expected format
      const answers = standupInfo.questions.map((_, index) => ({
        questionIndex: index,
        answer: formData.answers[index.toString()],
      }));

      await magicTokenApiClient.submitWithMagicToken(token, answers);

      setIsSubmitted(true);
      toast.success('Response submitted successfully!');
    } catch (error) {
      console.error('Error submitting response:', error);
      let errorMessage = 'Failed to submit response';
      if (error && typeof error === 'object' && 'response' in error) {
        const err = error as { response?: { status?: number; data?: { message?: string } } };
        if (err.response?.status === 401) {
          errorMessage = 'Your session has expired. Please use a fresh magic link.';
        } else if (err.response?.status === 409) {
          errorMessage = 'You have already submitted a response for this standup.';
        } else if (err.response?.data?.message) {
          errorMessage = err.response.data.message;
        }
      }
      toast.error(errorMessage);
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

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <AlertTriangle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-4">Unable to Load Standup</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <ModernButton variant="primary" onClick={() => window.close()}>
            Close Window
          </ModernButton>
        </div>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-4">Response Submitted!</h1>
          <p className="text-muted-foreground mb-6">
            Thank you for submitting your standup response for {standupInfo?.teamName}.
          </p>
          <ModernButton variant="primary" onClick={() => window.close()}>
            Close Window
          </ModernButton>
        </div>
      </div>
    );
  }

  if (!standupInfo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Standup Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The standup you're looking for doesn't exist or has expired.
          </p>
          <ModernButton variant="primary" onClick={() => window.close()}>
            Close Window
          </ModernButton>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold">Daily Standup</h1>
            <p className="text-muted-foreground text-lg">
              {formatDate(standupInfo.targetDate)} • {standupInfo.teamName}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Submitted as: {standupInfo.memberName}
            </p>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit}>
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="bg-card rounded-2xl p-6 border border-border"
              >
                <h2 className="text-xl font-semibold mb-6">Your Responses</h2>

                <div className="space-y-6">
                  {standupInfo.questions.map((question, index) => (
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
                  <div className="flex gap-4 justify-center">
                    <ModernButton
                      type="submit"
                      variant="primary"
                      disabled={isSubmitting}
                      data-testid="submit-response-button"
                      className="min-w-[160px]"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Submit Response
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
                  <Users className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium">{standupInfo.teamName}</p>
                    <p className="text-sm text-muted-foreground">Team standup</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium">{formatDate(standupInfo.targetDate)}</p>
                    {standupInfo.timeRemaining && (
                      <p className="text-sm text-muted-foreground">
                        {standupInfo.timeRemaining} remaining
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-card rounded-2xl p-6 border border-border">
              <h3 className="text-lg font-semibold mb-4">Instructions</h3>

              <div className="space-y-3 text-sm text-muted-foreground">
                <p>• Answer all questions honestly and completely</p>
                <p>• Be specific about your work and any blockers</p>
                <p>• Submit before the deadline to be included in the summary</p>
                <p>• This response will be shared with your team</p>
              </div>
            </div>

            {/* Security Notice */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
              <h4 className="text-sm font-semibold text-yellow-800 mb-2">🔒 Secure Submission</h4>
              <p className="text-xs text-yellow-700">
                This is a secure, one-time submission link. Do not share this URL with others.
              </p>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
});
