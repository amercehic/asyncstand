import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { StandupWizard } from '@/components/StandupWizard';
import { standupsApi, teamsApi } from '@/lib/api';
import { toast } from '@/components/ui';
import type { CreateStandupConfigRequest, Team } from '@/types/api';

export const StandupWizardPage: React.FC = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [availableChannels, setAvailableChannels] = useState<Array<{ id: string; name: string }>>(
    []
  );
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!teamId) return;

      try {
        const [channelsResponse, teamResponse] = await Promise.all([
          teamsApi.getAvailableChannels(),
          teamsApi.getTeam(teamId),
        ]);

        setAvailableChannels(
          channelsResponse.channels.map(ch => ({
            id: ch.id,
            name: ch.name,
          }))
        );
        setTeam(teamResponse);
      } catch (error) {
        console.error('Failed to load data:', error);
        toast.error('Failed to load team data');
        navigate('/teams');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [teamId, navigate]);

  const handleComplete = async (standupData: CreateStandupConfigRequest) => {
    if (!teamId) return;

    try {
      await standupsApi.createStandup(teamId, standupData);
      toast.success('Standup created successfully!');
      navigate(`/teams/${teamId}`);
    } catch (error) {
      console.error('Failed to create standup:', error);
      toast.error('Failed to create standup. Please try again.');
    }
  };

  const handleCancel = () => {
    // Check if user came from the teams listing page
    const referrer = location.state?.from || document.referrer;
    const cameFromTeamsListing = referrer?.includes('/teams') && !referrer?.includes(`/teams/${teamId}`);
    
    if (cameFromTeamsListing || location.state?.from === '/teams') {
      navigate('/teams');
    } else {
      navigate(`/teams/${teamId || ''}`);
    }
  };

  if (!teamId) {
    navigate('/teams');
    return null;
  }

  if (loading || !team) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading team data...</p>
        </div>
      </div>
    );
  }

  return (
    <StandupWizard
      teamId={teamId}
      teamMembers={team.members}
      onComplete={handleComplete}
      onCancel={handleCancel}
      availableChannels={availableChannels}
    />
  );
};
