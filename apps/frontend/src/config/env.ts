interface EnvironmentConfig {
  // API Configuration
  apiUrl: string;
  apiTimeout: number;

  // App Configuration
  appName: string;
  appVersion: string;
  nodeEnv: string;

  // Feature Flags
  enableAnalytics: boolean;
  enableDebug: boolean;

  // External Services
  slackClientId?: string;
  sentryDsn?: string;
}

function getEnvVar(name: string, defaultValue?: string): string {
  const value = import.meta.env[name] || defaultValue;

  if (!value) {
    throw new Error(`Environment variable ${name} is required but not defined`);
  }

  return value;
}

function getEnvBoolean(name: string, defaultValue: boolean = false): boolean {
  const value = import.meta.env[name];
  if (value === undefined) return defaultValue;
  return value === 'true' || value === '1';
}

function getEnvNumber(name: string, defaultValue: number): number {
  const value = import.meta.env[name];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

const nodeEnv = getEnvVar('VITE_NODE_ENV', 'development');

export const env: EnvironmentConfig = {
  // API Configuration
  apiUrl: getEnvVar('VITE_API_URL', 'http://localhost:3000'),
  apiTimeout: getEnvNumber('VITE_API_TIMEOUT', 10000),

  // App Configuration
  appName: getEnvVar('VITE_APP_NAME', 'AsyncStand'),
  appVersion: getEnvVar('VITE_APP_VERSION', '1.0.0'),
  nodeEnv,

  // Feature Flags
  enableAnalytics: getEnvBoolean('VITE_ENABLE_ANALYTICS', false),
  enableDebug: getEnvBoolean('VITE_ENABLE_DEBUG', nodeEnv === 'development'),

  // External Services
  slackClientId: import.meta.env.VITE_SLACK_CLIENT_ID,
  sentryDsn: import.meta.env.VITE_SENTRY_DSN,
};

// Runtime validation
export function validateEnvironment(): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required variables
  const requiredVars = ['VITE_API_URL', 'VITE_APP_NAME'];

  requiredVars.forEach(varName => {
    if (!import.meta.env[varName]) {
      errors.push(`Missing required environment variable: ${varName}`);
    }
  });

  // Optional but recommended variables
  const recommendedVars = ['VITE_APP_VERSION'];

  recommendedVars.forEach(varName => {
    if (!import.meta.env[varName]) {
      warnings.push(`Missing recommended environment variable: ${varName}`);
    }
  });

  // Log results
  if (errors.length > 0) {
    console.error('Environment validation errors:', errors);
    throw new Error(`Environment validation failed: ${errors.join(', ')}`);
  }

  if (warnings.length > 0 && env.enableDebug) {
    console.warn('Environment validation warnings:', warnings);
  }

  if (env.enableDebug) {
    console.log('Environment configuration loaded:', {
      apiUrl: env.apiUrl,
      appName: env.appName,
      appVersion: env.appVersion,
      nodeEnv: env.nodeEnv,
    });
  }
}

// Export environment type for TypeScript support
export type Environment = typeof env;

// Call validation on import
try {
  validateEnvironment();
} catch (error) {
  console.error('Failed to validate environment:', error);
  // Don't throw in production to avoid breaking the app
  if (env.nodeEnv === 'development') {
    throw error;
  }
}
