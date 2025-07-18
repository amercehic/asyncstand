import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

interface WorkerEnvironmentConfig {
  nodeEnv: string;
  databaseUrl: string;
  workerEnabled: boolean;
  workerConcurrency: number;
  jwtSecret: string;
}

function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name] || defaultValue;

  if (!value) {
    throw new Error(`Environment variable ${name} is required but not defined`);
  }

  return value;
}

function getEnvVarAsBoolean(name: string, defaultValue: boolean = false): boolean {
  const value = process.env[name];

  if (!value) {
    return defaultValue;
  }

  return value.toLowerCase() === 'true';
}

function getEnvVarAsNumber(name: string, defaultValue: number): number {
  const value = process.env[name];

  if (!value) {
    return defaultValue;
  }

  const parsed = parseInt(value, 10);

  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a valid number`);
  }

  return parsed;
}

export const env: WorkerEnvironmentConfig = {
  nodeEnv: getEnvVar('NODE_ENV', 'development'),
  databaseUrl: getEnvVar('DATABASE_URL'),
  workerEnabled: getEnvVarAsBoolean('WORKER_ENABLED', true),
  workerConcurrency: getEnvVarAsNumber('WORKER_CONCURRENCY', 1),
  jwtSecret: getEnvVar('JWT_SECRET'),
};

// Validation function
export function validateEnvironment(): void {
  const requiredVars = ['DATABASE_URL', 'JWT_SECRET'];

  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  console.log('✅ Worker environment variables validated successfully');
}

// Call validation on import
validateEnvironment();
