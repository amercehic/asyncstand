import { IsEnum, IsNotEmpty, IsNumber, IsString, IsOptional, validateSync } from 'class-validator';
import { plainToInstance, Transform } from 'class-transformer';

enum Environment {
  Development = 'development',
  Production = 'production',
  Staging = 'staging',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  PORT: number = 3000;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET!: string;

  @IsString()
  FRONTEND_URL: string = 'http://localhost:3000';

  @IsOptional()
  @IsString()
  BACKEND_URL: string = '';

  @IsOptional()
  @IsString()
  NGROK_URL: string = '';

  @IsString()
  FROM_EMAIL: string = 'noreply@asyncstand.com';

  @IsString()
  SMTP_HOST: string = '';

  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  SMTP_PORT: number = 587;

  @IsString()
  SMTP_USER: string = '';

  @IsString()
  SMTP_PASS: string = '';

  @IsOptional()
  @IsString()
  LOG_LEVEL: string = 'debug';

  @IsOptional()
  @IsString()
  LOG_PRETTY: string = 'true';

  @IsOptional()
  @IsString()
  SLACK_CLIENT_ID: string = '';

  @IsOptional()
  @IsString()
  SLACK_CLIENT_SECRET: string = '';

  @IsOptional()
  @IsString()
  SLACK_OAUTH_ENABLED: string = 'false';

  @IsOptional()
  @IsString()
  REDIS_URL: string = 'redis://localhost:6379';

  @IsOptional()
  @IsString()
  DATABASE_ENCRYPT_KEY: string = '';
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}

export const envConfig = () => {
  const ngrokUrl = process.env.NGROK_URL;
  const backendUrl = process.env.BACKEND_URL;
  const baseUrl =
    ngrokUrl ||
    backendUrl ||
    (process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : '');

  return {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    databaseUrl: process.env.DATABASE_URL,
    jwtSecret: process.env.JWT_SECRET,
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    backendUrl: backendUrl || '',
    // Use NGROK_URL if available, then BACKEND_URL, otherwise fallback to default
    appUrl: baseUrl,
    ngrokUrl: ngrokUrl || '',
    fromEmail: process.env.FROM_EMAIL || 'noreply@asyncstand.com',
    smtpHost: process.env.SMTP_HOST || '',
    smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || '',
    logLevel: process.env.LOG_LEVEL || 'debug',
    logPretty: process.env.LOG_PRETTY || 'true',
    slackClientId: process.env.SLACK_CLIENT_ID || '',
    slackClientSecret: process.env.SLACK_CLIENT_SECRET || '',
    slackOauthEnabled: process.env.SLACK_OAUTH_ENABLED === 'true',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    databaseEncryptKey: process.env.DATABASE_ENCRYPT_KEY || '',
  };
};
