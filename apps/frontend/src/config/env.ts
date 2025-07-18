interface EnvironmentConfig {
  apiUrl: string;
  appName: string;
  nodeEnv: string;
}

function getEnvVar(name: string, defaultValue?: string): string {
  const value = import.meta.env[name] || defaultValue;

  if (!value) {
    throw new Error(`Environment variable ${name} is required but not defined`);
  }

  return value;
}

export const env: EnvironmentConfig = {
  apiUrl: getEnvVar('VITE_API_URL', 'http://localhost:3000'),
  appName: getEnvVar('VITE_APP_NAME', 'AsyncStand'),
  nodeEnv: getEnvVar('VITE_NODE_ENV', 'development'),
};

// Runtime validation
export function validateEnvironment(): void {
  const requiredVars = ['VITE_API_URL', 'VITE_APP_NAME'];

  const missingVars = requiredVars.filter((varName) => !import.meta.env[varName]);

  if (missingVars.length > 0) {
    console.warn(`Missing environment variables: ${missingVars.join(', ')}`);
  }
}

// Call validation on import
validateEnvironment();
