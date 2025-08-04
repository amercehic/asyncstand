# Slack Integration Setup Guide

This guide covers setting up the Slack messaging integration for complete standup user experience.

## Required Environment Variables

Add these environment variables to your `.env` file:

```bash
# Slack Integration
SLACK_SIGNING_SECRET=your_slack_signing_secret_here
SLACK_WEBHOOK_URL=https://yourdomain.com/slack/events
```

### Where to find these values:

1. **SLACK_SIGNING_SECRET**:
   - Go to your Slack app at https://api.slack.com/apps
   - Navigate to "Basic Information" → "App Credentials"
   - Copy the "Signing Secret"

2. **SLACK_WEBHOOK_URL**:
   - This is your public domain where Slack will send webhook events
   - Must be HTTPS and publicly accessible
   - Format: `https://yourdomain.com/slack/events`

## Slack App Configuration

### Required OAuth Scopes

Your Slack app needs these Bot Token Scopes:

- `channels:read` - Read public channel information
- `chat:write` - Send messages to channels
- `im:write` - Send direct messages to users
- `users:read` - Read user information
- `team:read` - Read team information
- `commands` - Handle slash commands

### Required Event Subscriptions

Enable these events in your Slack app:

- `app_mention` - When bot is mentioned
- `message.im` - Direct messages to bot

### Slash Commands

Create these slash commands in your Slack app:

- `/standup` - Main standup command
  - Request URL: `https://yourdomain.com/slack/slash-commands`
  - Description: "Manage your daily standup responses"

### Interactive Components

Set the Request URL to: `https://yourdomain.com/slack/interactive-components`

### Event Subscriptions

Set the Request URL to: `https://yourdomain.com/slack/events`

## Webhook Endpoints

The following endpoints are exposed for Slack integration:

- `POST /slack/events` - Slack Events API webhook
- `POST /slack/interactive-components` - Handle button clicks, modal submissions
- `POST /slack/slash-commands` - Handle /standup commands

## Complete User Flow

Once configured, the system provides this end-to-end experience:

### 1. Automated Standup Creation

- Daily standups are created automatically based on team configuration
- No manual intervention required

### 2. Slack Reminder Sent

```
🌅 Daily Standup Time - Engineering Team

Today's Questions:
1. What did you work on yesterday?
2. What will you work on today?
3. Any blockers or help needed?

⏰ Deadline: 11:00 AM (2 hours remaining)
👥 Waiting for: 5 team members

[📝 Submit Response] [⏭️ Skip Today]
```

### 3. User Interaction Options

**Option A: Click Submit Response Button**

- Opens modal with standup questions
- User fills out form and submits
- Responses saved to database

**Option B: Use Slash Commands**

- `/standup status` - Show current standup status
- `/standup submit` - Open submission modal
- `/standup skip` - Skip today with optional reason
- `/standup help` - Show available commands

### 4. Follow-up Reminders

- Automatic reminders sent at 50%, 80%, and 95% of timeout period
- Both channel reminders and individual DMs
- Only sent to users who haven't responded yet

### 5. Automatic Summary

```
📊 Daily Standup Summary - January 15, 2024
Team: Engineering Team | Participation: 4/5 members (80%)

✅ John Doe
- Yesterday: Worked on user authentication API
- Today: Will implement password reset functionality
- Blockers: Need help with email service integration

✅ Jane Smith
- Yesterday: Fixed frontend login bugs
- Today: Starting on dashboard UI components
- Blockers: No blockers

⏰ Missing Responses: Alice Wilson

Next standup: Tuesday, Jan 16
```

## Testing the Integration

### 1. Webhook Verification

Test that your webhook URL is accessible:

```bash
curl -X POST https://yourdomain.com/slack/events \
  -H "Content-Type: application/json" \
  -d '{"type":"url_verification","challenge":"test_challenge"}'
```

Expected response: `{"challenge":"test_challenge"}`

### 2. Test Flow

1. Create a team with Slack integration
2. Configure standup questions and schedule
3. Manually trigger a standup instance
4. Verify reminder is sent to Slack channel
5. Test modal submission flow
6. Test slash commands
7. Verify summary is posted

## Security Features

- **Request Verification**: All Slack webhook requests are verified using signing secret
- **Timestamp Validation**: Prevents replay attacks (5-minute window)
- **Team Validation**: Ensures requests come from known integrated teams
- **Rate Limiting**: Respects Slack API rate limits with exponential backoff

## Error Handling

The system gracefully handles:

- Deleted channels or users
- Failed message sending with retry logic
- Invalid webhook signatures
- Malformed payloads
- Network timeouts

All errors are logged with detailed context for debugging.

## Monitoring

Key metrics to monitor:

- Webhook response times
- Message delivery success rates
- User interaction rates
- Standup completion rates
- Error rates by type

## Troubleshooting

### Common Issues

1. **Webhook not receiving events**
   - Check SLACK_SIGNING_SECRET is correct
   - Verify webhook URL is publicly accessible
   - Check SSL certificate is valid

2. **Bot can't send messages**
   - Verify bot has required OAuth scopes
   - Check bot is added to target channels
   - Confirm token is not expired

3. **Interactive components not working**
   - Verify interactive components URL is set correctly
   - Check request signing verification
   - Ensure modal payload processing is working

4. **Users not found**
   - Verify team member records exist in database
   - Check externalUserId mapping is correct
   - Confirm integration sync is working

### Debug Mode

Enable debug logging by setting:

```bash
LOG_LEVEL=debug
```

This will log all Slack API interactions for troubleshooting.
