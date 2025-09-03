# Feature Flag Implementation Guide

## Quick Reference

### 1. Import the Registry

```typescript
// Backend
import { FEATURES } from '@/features/feature-registry';

// Frontend
import { FEATURES } from '@/lib/features/feature-registry';
```

### 2. Protect Backend Routes

```typescript
// In controllers
import { RequireFeature } from '@/features/decorators/require-feature.decorator';
import { FEATURES } from '@/features/feature-registry';

@Controller('integrations/slack')
export class SlackController {
  @Post('connect')
  @RequireFeature(FEATURES.SLACK_INTEGRATION) // ← Add this
  async connectSlack() {
    // Existing code
  }
}
```

### 3. Protect Frontend Components

```tsx
// In React components
import { useFeature, FeatureGate } from '@/contexts/FeatureContext';
import { FEATURES } from '@/lib/features/feature-registry';

// Option 1: Using hook
export function IntegrationsPage() {
  const hasSlack = useFeature(FEATURES.SLACK_INTEGRATION);

  if (!hasSlack) {
    return <UpgradePrompt feature="Slack Integration" />;
  }

  // Existing code
}

// Option 2: Using component
export function IntegrationsPage() {
  return (
    <FeatureGate feature={FEATURES.SLACK_INTEGRATION} fallback={<UpgradePrompt />}>
      {/* Existing integration UI */}
    </FeatureGate>
  );
}
```

## Real Examples

### Example 1: Protecting Slack Integration

**Backend** (`/apps/backend/src/integrations/slack/slack.controller.ts`):

```typescript
import { RequireFeature } from '@/features/decorators/require-feature.decorator';
import { FeatureGuard } from '@/features/guards/feature.guard';
import { FEATURES } from '@/features/feature-registry';

@Controller('integrations/slack')
@UseGuards(JwtAuthGuard, FeatureGuard) // Add FeatureGuard
export class SlackController {
  @Get('auth/callback')
  @RequireFeature(FEATURES.SLACK_INTEGRATION)
  async handleOAuthCallback() {
    // Existing OAuth code
  }

  @Post('sync')
  @RequireFeature(FEATURES.SLACK_INTEGRATION)
  async syncChannels() {
    // Existing sync code
  }
}
```

**Frontend** (`/apps/frontend/src/pages/IntegrationsPage.tsx`):

```tsx
import { useFeature } from '@/contexts/FeatureContext';
import { FEATURES } from '@/lib/features/feature-registry';

export function IntegrationsPage() {
  const hasSlack = useFeature(FEATURES.SLACK_INTEGRATION);
  const hasTeams = useFeature(FEATURES.TEAMS_INTEGRATION);
  const hasWebhooks = useFeature(FEATURES.WEBHOOK_INTEGRATIONS);

  return (
    <div>
      <h1>Integrations</h1>

      {hasSlack && <SlackIntegrationCard />}

      {hasTeams && <TeamsIntegrationCard />}

      {hasWebhooks && <WebhookIntegrationCard />}

      {!hasSlack && !hasTeams && !hasWebhooks && (
        <EmptyState message="No integrations available in your plan" />
      )}
    </div>
  );
}
```

### Example 2: Quota Checking for Team Creation

**Backend** (`/apps/backend/src/teams/teams.controller.ts`):

```typescript
import { FeatureService } from '@/features/feature.service';
import { QUOTA_TYPES } from '@/features/feature-registry';

@Controller('teams')
export class TeamsController {
  constructor(private featureService: FeatureService) {}

  @Post()
  async createTeam(@CurrentUser() user, @Body() dto: CreateTeamDto) {
    // Check quota before creating
    const quota = await this.featureService.checkQuota(user.orgId, QUOTA_TYPES.TEAMS);

    if (quota.exceeded) {
      throw new ApiError(
        ErrorCode.QUOTA_EXCEEDED,
        `Team limit reached (${quota.current}/${quota.limit}). Please upgrade your plan.`,
      );
    }

    // Create team
    return this.teamsService.create(user.orgId, dto);
  }
}
```

**Frontend** (`/apps/frontend/src/pages/TeamsPage.tsx`):

```tsx
import { useQuota } from '@/contexts/FeatureContext';
import { QUOTA_TYPES } from '@/lib/features/feature-registry';

export function TeamsPage() {
  const { quota, loading } = useQuota(QUOTA_TYPES.TEAMS);

  const handleCreateTeam = () => {
    if (quota?.exceeded) {
      showUpgradeModal({
        title: 'Team Limit Reached',
        message: `You've reached your limit of ${quota.limit} teams.`,
        action: 'Upgrade Plan',
      });
      return;
    }

    // Show create team modal
  };

  return (
    <div>
      <div className="flex justify-between">
        <h1>
          Teams ({quota?.current}/{quota?.limit || '∞'})
        </h1>
        <button onClick={handleCreateTeam} disabled={quota?.exceeded}>
          Create Team
        </button>
      </div>
    </div>
  );
}
```

### Example 3: Advanced Analytics Feature

**Frontend** (`/apps/frontend/src/pages/StandupDetailsPage.tsx`):

```tsx
import { FeatureGate } from '@/contexts/FeatureContext';
import { FEATURES } from '@/lib/features/feature-registry';

export function StandupDetailsPage() {
  return (
    <div>
      <h1>Standup Details</h1>

      {/* Basic info always visible */}
      <BasicStandupInfo />

      {/* Advanced analytics only for paid plans */}
      <FeatureGate feature={FEATURES.ADVANCED_ANALYTICS}>
        <AdvancedAnalyticsPanel />
        <TrendCharts />
        <ExportButton />
      </FeatureGate>

      {/* Basic analytics for starter+ plans */}
      <FeatureGate
        feature={FEATURES.BASIC_ANALYTICS}
        fallback={<UpgradeCard message="Unlock analytics" />}
      >
        <BasicAnalyticsPanel />
      </FeatureGate>
    </div>
  );
}
```

## Testing Feature Flags

### 1. Test Different Plans

```typescript
// In tests
describe('Feature Flags', () => {
  it('should allow slack integration for starter plan', async () => {
    // Set up user with starter plan
    const user = await createUserWithPlan('starter');

    const result = await featureService.isFeatureEnabled(FEATURES.SLACK_INTEGRATION, user.orgId);

    expect(result.enabled).toBe(true);
  });
});
```

### 2. Test Feature Overrides

```bash
# Give an org temporary access to a feature
curl -X POST http://localhost:3000/features/admin/override \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "featureKey": "advanced_analytics",
    "orgId": "org-123",
    "enabled": true,
    "reason": "Beta testing",
    "expiresAt": "2024-12-31"
  }'
```

### 3. Test Environment-Specific Features

```typescript
// Feature only in development
{
  key: 'new_ui',
  environment: ['development'],
  // ...
}

// In production, this returns false
const hasNewUI = await featureService.isFeatureEnabled('new_ui');
```

## Common Patterns

### 1. Progressive Enhancement

```tsx
// Show basic feature to all, enhance for paid
<div>
  <BasicFeature />

  <FeatureGate feature={FEATURES.ADVANCED_STANDUPS}>
    <AdvancedOptions />
  </FeatureGate>
</div>
```

### 2. Feature Teasing

```tsx
// Show locked features to encourage upgrades
const hasFeature = useFeature(FEATURES.ADVANCED_ANALYTICS);

<div className={!hasFeature ? 'opacity-50' : ''}>
  <AnalyticsPanel />
  {!hasFeature && <LockedOverlay message="Upgrade to Professional" />}
</div>;
```

### 3. Graceful Degradation

```tsx
// Provide alternative for missing features
const hasAI = useFeature(FEATURES.AI_INSIGHTS);

{
  hasAI ? (
    <AIInsights />
  ) : (
    <ManualInsights /> // Simpler alternative
  );
}
```

## Checklist for Adding Feature Flags

- [ ] Add feature to `feature-registry.ts` (both backend and frontend)
- [ ] Add `@RequireFeature()` to backend endpoints
- [ ] Add `UseGuards(FeatureGuard)` to controllers
- [ ] Add `useFeature()` or `<FeatureGate>` to frontend
- [ ] Update FEATURE_MAPPING.md documentation
- [ ] Test with different plans
- [ ] Add quota checking if applicable
- [ ] Update seed data if needed
