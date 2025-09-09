-- Insert base navigation features that should be enabled by default
INSERT INTO "Feature" (
  "key",
  "name",
  "description",
  "isEnabled",
  "environment",
  "rolloutType",
  "category",
  "isPlanBased",
  "requiresAdmin",
  "createdAt",
  "updatedAt"
) VALUES 
  (
    'dashboard',
    'Dashboard',
    'Access to the main dashboard and analytics overview',
    true,
    ARRAY['development', 'staging', 'production'],
    'boolean',
    'core',
    false,
    false,
    NOW(),
    NOW()
  ),
  (
    'teams',
    'Teams',
    'Team management and organization features',
    true,
    ARRAY['development', 'staging', 'production'],
    'boolean',
    'core',
    false,
    false,
    NOW(),
    NOW()
  ),
  (
    'standups',
    'Standups',
    'Standup configuration and management',
    true,
    ARRAY['development', 'staging', 'production'],
    'boolean',
    'core',
    false,
    false,
    NOW(),
    NOW()
  ),
  (
    'integrations',
    'Integrations',
    'External platform integrations (Slack, Teams, etc.)',
    true,
    ARRAY['development', 'staging', 'production'],
    'boolean',
    'integration',
    false,
    false,
    NOW(),
    NOW()
  ),
  (
    'settings',
    'Settings',
    'Organization and user settings management',
    true,
    ARRAY['development', 'staging', 'production'],
    'boolean',
    'core',
    false,
    false,
    NOW(),
    NOW()
  )
ON CONFLICT ("key") DO UPDATE SET
  "isEnabled" = EXCLUDED."isEnabled",
  "environment" = EXCLUDED."environment",
  "updatedAt" = NOW();