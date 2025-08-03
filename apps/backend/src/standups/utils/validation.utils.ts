import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';
import { HttpStatus } from '@nestjs/common';

const VALID_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Vancouver',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Rome',
  'Europe/Madrid',
  'Europe/Amsterdam',
  'Europe/Stockholm',
  'Europe/Oslo',
  'Europe/Copenhagen',
  'Europe/Helsinki',
  'Europe/Warsaw',
  'Europe/Prague',
  'Europe/Vienna',
  'Europe/Zurich',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Singapore',
  'Asia/Bangkok',
  'Asia/Mumbai',
  'Asia/Dubai',
  'Asia/Jerusalem',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Perth',
  'Pacific/Auckland',
];

export class ValidationUtils {
  static validateSchedule(weekdays: number[], timeLocal: string, timezone: string): void {
    // Validate weekdays
    if (!Array.isArray(weekdays) || weekdays.length === 0) {
      throw new ApiError(
        ErrorCode.INVALID_SCHEDULE,
        'At least one weekday must be selected',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (weekdays.length > 7) {
      throw new ApiError(
        ErrorCode.INVALID_SCHEDULE,
        'Cannot have more than 7 weekdays',
        HttpStatus.BAD_REQUEST,
      );
    }

    for (const day of weekdays) {
      if (!Number.isInteger(day) || day < 0 || day > 6) {
        throw new ApiError(
          ErrorCode.INVALID_SCHEDULE,
          'Weekdays must be integers between 0-6 (Sunday=0)',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    // Check for duplicates
    const uniqueWeekdays = [...new Set(weekdays)];
    if (uniqueWeekdays.length !== weekdays.length) {
      throw new ApiError(
        ErrorCode.INVALID_SCHEDULE,
        'Duplicate weekdays are not allowed',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Validate time format
    if (!this.validateTimeFormat(timeLocal)) {
      throw new ApiError(
        ErrorCode.INVALID_TIME_FORMAT,
        'Time must be in HH:MM format (00:00 to 23:59)',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Validate timezone
    if (!this.validateTimezone(timezone)) {
      throw new ApiError(
        ErrorCode.INVALID_TIMEZONE,
        `Invalid timezone. Must be one of: ${VALID_TIMEZONES.slice(0, 5).join(', ')}...`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  static validateQuestions(questions: string[]): void {
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new ApiError(
        ErrorCode.INVALID_QUESTIONS,
        'At least 1 question is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (questions.length > 10) {
      throw new ApiError(
        ErrorCode.INVALID_QUESTIONS,
        'Maximum 10 questions allowed',
        HttpStatus.BAD_REQUEST,
      );
    }

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];

      if (typeof question !== 'string') {
        throw new ApiError(
          ErrorCode.INVALID_QUESTIONS,
          `Question ${i + 1} must be a string`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const trimmed = question.trim();
      if (trimmed.length === 0) {
        throw new ApiError(
          ErrorCode.INVALID_QUESTIONS,
          `Question ${i + 1} cannot be empty`,
          HttpStatus.BAD_REQUEST,
        );
      }

      if (trimmed.length < 10) {
        throw new ApiError(
          ErrorCode.INVALID_QUESTIONS,
          `Question ${i + 1} must be at least 10 characters long`,
          HttpStatus.BAD_REQUEST,
        );
      }

      if (trimmed.length > 200) {
        throw new ApiError(
          ErrorCode.INVALID_QUESTIONS,
          `Question ${i + 1} cannot exceed 200 characters`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    // Check for duplicate questions
    const uniqueQuestions = [...new Set(questions.map((q) => q.trim().toLowerCase()))];
    if (uniqueQuestions.length !== questions.length) {
      throw new ApiError(
        ErrorCode.INVALID_QUESTIONS,
        'Duplicate questions are not allowed',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  static validateTimezone(timezone: string): boolean {
    return VALID_TIMEZONES.includes(timezone);
  }

  static validateTimeFormat(timeLocal: string): boolean {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(timeLocal);
  }

  static getNextStandupDate(weekdays: number[], timeLocal: string, _timezone: string): Date {
    const now = new Date();
    const [hours, minutes] = timeLocal.split(':').map(Number);

    // For simplicity, we'll calculate based on current timezone
    // In a real implementation, you'd want to handle timezone conversion properly
    const today = now.getDay();

    // Find the next occurrence
    for (let i = 0; i < 7; i++) {
      const checkDay = (today + i) % 7;
      if (weekdays.includes(checkDay)) {
        const checkDate = new Date(now);
        checkDate.setDate(now.getDate() + i);
        checkDate.setHours(hours, minutes, 0, 0);

        // If it's today but the time has passed, skip to next occurrence
        if (i === 0 && checkDate <= now) {
          continue;
        }

        return checkDate;
      }
    }

    // Fallback to tomorrow
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(hours, minutes, 0, 0);
    return tomorrow;
  }

  static getValidTimezones(): string[] {
    return [...VALID_TIMEZONES];
  }
}
