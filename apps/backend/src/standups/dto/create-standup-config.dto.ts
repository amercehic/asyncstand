import {
  IsString,
  IsArray,
  IsInt,
  IsBoolean,
  IsOptional,
  Length,
  ArrayMinSize,
  ArrayMaxSize,
  Min,
  Max,
  IsTimeZone,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateStandupConfigDto {
  @ApiProperty({
    description: 'Name for the standup configuration',
    example: 'Daily Standup',
    maxLength: 100,
  })
  @IsString()
  @Length(1, 100, { message: 'Name must be between 1-100 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name: string;

  @ApiProperty({
    description: 'Standup questions (1-10 questions, each 10-200 characters)',
    example: [
      'What did you accomplish yesterday?',
      'What will you work on today?',
      'Are there any blockers or impediments?',
    ],
    type: [String],
    minItems: 1,
    maxItems: 10,
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least 1 question is required' })
  @ArrayMaxSize(10, { message: 'Maximum 10 questions allowed' })
  @IsString({ each: true })
  @Length(10, 200, { each: true, message: 'Each question must be between 10-200 characters' })
  @Transform(({ value }) =>
    Array.isArray(value) ? value.map((q: string) => q.trim()).filter((q) => q.length > 0) : value,
  )
  questions: string[];

  @ApiProperty({
    description: 'Weekdays for standups (0=Sunday, 1=Monday, etc.)',
    example: [1, 2, 3, 4, 5],
    type: [Number],
    minItems: 1,
    maxItems: 7,
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least 1 weekday must be selected' })
  @ArrayMaxSize(7, { message: 'Maximum 7 weekdays allowed' })
  @IsInt({ each: true })
  @Min(0, { each: true, message: 'Weekday must be between 0-6' })
  @Max(6, { each: true, message: 'Weekday must be between 0-6' })
  @Transform(({ value }) => (Array.isArray(value) ? [...new Set(value)] : value)) // Remove duplicates
  weekdays: number[];

  @ApiProperty({
    description: 'Local time for standup in HH:MM format (24-hour)',
    example: '09:00',
  })
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Time must be in HH:MM format (00:00 to 23:59)',
  })
  timeLocal: string;

  @ApiProperty({
    description: 'Timezone for standup scheduling',
    example: 'America/New_York',
  })
  @IsString()
  @IsTimeZone()
  timezone: string;

  @ApiProperty({
    description: 'Minutes before standup to send reminder (5-60 minutes)',
    example: 15,
  })
  @IsInt()
  @Min(5, { message: 'Reminder must be at least 5 minutes before' })
  @Max(60, { message: 'Reminder cannot be more than 60 minutes before' })
  reminderMinutesBefore: number;

  @ApiPropertyOptional({
    description: 'Hours to wait for responses before timeout (1-24 hours)',
    example: 2,
    default: 2,
  })
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Response timeout must be at least 1 hour' })
  @Max(24, { message: 'Response timeout cannot be more than 24 hours' })
  responseTimeoutHours?: number;

  @ApiPropertyOptional({
    description: 'Whether the standup configuration is active',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
