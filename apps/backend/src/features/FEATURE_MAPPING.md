# Feature Mapping Documentation

## Current Features in AsyncStand

This document maps all features in the application to their corresponding feature flags.

## 🎯 Core Features

### Standups

| Feature                | Feature Key         | Status         | Location                 |
| ---------------------- | ------------------- | -------------- | ------------------------ |
| Basic Standup Creation | `basic_standups`    | ✅ Implemented | `/standups/*`            |
| Custom Questions       | `advanced_standups` | 🔧 Needs flag  | `StandupConfigPage.tsx`  |
| Standup Templates      | `advanced_standups` | 🔧 Needs flag  | `StandupWizard.tsx`      |
| Recurring Standups     | `basic_standups`    | ✅ Implemented | `StandupScheduler`       |
| Smart Reminders        | `advanced_standups` | 🔧 Needs flag  | `SmartReminderModal.tsx` |
| Standup History        | `basic_standups`    | ✅ Implemented | `StandupDetailsPage.tsx` |

### Teams

| Feature                | Feature Key         | Status         | Location             |
| ---------------------- | ------------------- | -------------- | -------------------- |
| Team Creation          | `basic_standups`    | ✅ Implemented | `TeamsPage.tsx`      |
| Team Member Management | `basic_standups`    | ✅ Implemented | `TeamDetailPage.tsx` |
| Team Analytics         | `basic_analytics`   | 🔧 Needs flag  | `TeamDetailPage.tsx` |
| Bulk Team Operations   | `advanced_standups` | 🔧 Needs flag  | Not implemented      |

### Analytics & Reporting

| Feature                  | Feature Key          | Status        | Location                     |
| ------------------------ | -------------------- | ------------- | ---------------------------- |
| Basic Response Tracking  | `basic_analytics`    | 🔧 Needs flag | `StandupResponsesPage.tsx`   |
| Response Trends          | `advanced_analytics` | 🔧 Needs flag | Not implemented              |
| Team Performance Metrics | `advanced_analytics` | 🔧 Needs flag | `standup-metrics.service.ts` |
| Export Reports           | `advanced_analytics` | 🔧 Needs flag | Not implemented              |
| Custom Reports           | `advanced_analytics` | 🔧 Needs flag | Not implemented              |

## 🔌 Integrations

### Slack Integration

| Feature          | Feature Key         | Status        | Location                     |
| ---------------- | ------------------- | ------------- | ---------------------------- |
| OAuth Connection | `slack_integration` | 🔧 Needs flag | `IntegrationsPage.tsx`       |
| Channel Sync     | `slack_integration` | 🔧 Needs flag | `IntegrationDetailsPage.tsx` |
| Bot Commands     | `slack_integration` | 🔧 Needs flag | `slack-event.service.ts`     |
| Notifications    | `slack_integration` | 🔧 Needs flag | `slack-api.service.ts`       |

### Other Integrations

| Feature         | Feature Key            | Status             | Location          |
| --------------- | ---------------------- | ------------------ | ----------------- |
| Microsoft Teams | `teams_integration`    | ❌ Not implemented | -                 |
| Discord         | `discord_integration`  | ❌ Not implemented | -                 |
| Webhooks        | `webhook_integrations` | ❌ Not implemented | -                 |
| REST API        | `api_access`           | 🔧 Needs flag      | All API endpoints |

## 💳 Billing & Subscription

### Billing Features

| Feature           | Feature Key          | Status        | Location                         |
| ----------------- | -------------------- | ------------- | -------------------------------- |
| View Current Plan | `billing_portal`     | 🔧 Needs flag | `SettingsPage.tsx` (Billing tab) |
| Upgrade/Downgrade | `billing_portal`     | 🔧 Needs flag | Not implemented                  |
| Payment Methods   | `billing_portal`     | 🔧 Needs flag | Not implemented                  |
| Invoice History   | `invoice_management` | 🔧 Needs flag | Not implemented                  |
| Usage Tracking    | `billing_portal`     | 🔧 Needs flag | Not implemented                  |

## 🎨 Customization

### Branding & UI

| Feature        | Feature Key       | Status        | Location           |
| -------------- | ----------------- | ------------- | ------------------ |
| Custom Logo    | `custom_branding` | 🔧 Needs flag | Not implemented    |
| Custom Colors  | `custom_branding` | 🔧 Needs flag | `ThemeContext.tsx` |
| White Labeling | `white_labeling`  | 🔧 Needs flag | Not implemented    |
| Custom Domain  | `white_labeling`  | 🔧 Needs flag | Not implemented    |

## 🧪 Experimental Features

### Beta Features

| Feature       | Feature Key   | Status             | Location                   |
| ------------- | ------------- | ------------------ | -------------------------- |
| AI Insights   | `ai_insights` | ❌ Not implemented | -                          |
| New UI Design | `new_ui`      | 🔧 Needs flag      | Could toggle UI components |
| Mobile App    | `mobile_app`  | ❌ Not implemented | -                          |

## 📊 Quota-Limited Features

These features are always available but limited by plan quotas:

| Resource       | Check Method                 | Enforced At       |
| -------------- | ---------------------------- | ----------------- |
| Team Members   | `checkQuota('members')`      | Team invitation   |
| Teams          | `checkQuota('teams')`        | Team creation     |
| Standups/Month | `checkQuota('standups')`     | Standup creation  |
| Storage        | `checkQuota('storage')`      | File uploads      |
| Integrations   | `checkQuota('integrations')` | Integration setup |

## 🚀 Implementation Status

- ✅ **Implemented**: Feature exists and works
- 🔧 **Needs flag**: Feature exists but needs feature flag protection
- ❌ **Not implemented**: Feature doesn't exist yet

## 📝 How to Add Feature Flags

### Backend Protection

```typescript
// In controller
@Post('create')
@RequireFeature('advanced_standups')
async createAdvancedStandup() {
  // Feature-gated endpoint
}
```

### Frontend Protection

```tsx
// Using hook
const canUseAdvanced = useFeature('advanced_standups');

// Using component
<FeatureGate feature="advanced_standups">
  <AdvancedFeatures />
</FeatureGate>;
```

### Quota Checking

```tsx
const { quota } = useQuota('teams');
if (quota?.exceeded) {
  showUpgradePrompt();
}
```

## 🎯 Priority Implementation Order

1. **High Priority** (Core functionality)
   - Slack integration flags
   - Basic/Advanced analytics
   - Team quotas

2. **Medium Priority** (Premium features)
   - Custom branding
   - Advanced standups
   - Invoice management

3. **Low Priority** (Future features)
   - AI insights
   - Mobile app
   - White labeling

## 📋 Next Steps

1. Add feature flags to existing Slack integration
2. Gate analytics features based on plan
3. Implement quota checking on team/standup creation
4. Add billing portal UI with feature gates
5. Create admin panel for feature management
