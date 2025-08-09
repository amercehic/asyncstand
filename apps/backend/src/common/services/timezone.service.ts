import { Injectable } from '@nestjs/common';
import { LoggerService } from '@/common/logger.service';

@Injectable()
export class TimezoneService {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext(TimezoneService.name);
  }

  /**
   * Convert UTC date to a specific timezone
   * Uses Intl.DateTimeFormat for proper timezone handling
   */
  convertToTimezone(date: Date, timezone: string): Date {
    try {
      // Use Intl.DateTimeFormat to get the correct time in the target timezone
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });

      const parts = formatter.formatToParts(date);
      const partsMap = parts.reduce(
        (acc, part) => {
          acc[part.type] = part.value;
          return acc;
        },
        {} as Record<string, string>,
      );

      // Create new date in the target timezone
      const convertedDate = new Date(
        parseInt(partsMap.year),
        parseInt(partsMap.month) - 1, // Month is 0-indexed
        parseInt(partsMap.day),
        parseInt(partsMap.hour),
        parseInt(partsMap.minute),
        parseInt(partsMap.second),
      );

      return convertedDate;
    } catch (error) {
      this.logger.warn('Failed to convert timezone, falling back to UTC', {
        timezone,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return date;
    }
  }

  /**
   * Get the timezone offset in minutes for a specific timezone at a given date
   */
  getTimezoneOffset(date: Date, timezone: string): number {
    try {
      // Create dates in both UTC and target timezone
      const utcDate = new Date(date.toISOString());
      const tzDate = this.convertToTimezone(date, timezone);

      // Calculate the difference in minutes
      const offsetMs = tzDate.getTime() - utcDate.getTime();
      return Math.round(offsetMs / (1000 * 60));
    } catch (error) {
      this.logger.warn('Failed to get timezone offset, returning 0', {
        timezone,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  /**
   * Check if a date falls on a specific weekday in a given timezone
   */
  isWeekdayInTimezone(date: Date, weekdays: number[], timezone: string): boolean {
    try {
      const localDate = this.convertToTimezone(date, timezone);
      const weekday = localDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
      return weekdays.includes(weekday);
    } catch (error) {
      this.logger.warn('Failed to check weekday in timezone, using UTC', {
        timezone,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Fall back to UTC
      const weekday = date.getDay();
      return weekdays.includes(weekday);
    }
  }

  /**
   * Create a date at a specific time in a given timezone
   */
  createDateAtTimeInTimezone(
    baseDate: Date,
    timeString: string, // Format: "HH:mm"
    timezone: string,
  ): Date {
    try {
      const [hours, minutes] = timeString.split(':').map(Number);

      if (isNaN(hours) || isNaN(minutes)) {
        throw new Error(`Invalid time format: ${timeString}`);
      }

      // Get the date in the target timezone
      const localDate = this.convertToTimezone(baseDate, timezone);

      // Set the specific time
      localDate.setHours(hours, minutes, 0, 0);

      // Convert back to UTC for storage
      const offset = this.getTimezoneOffset(localDate, timezone);
      const utcDate = new Date(localDate.getTime() - offset * 60 * 1000);

      return utcDate;
    } catch (error) {
      this.logger.error('Failed to create date at time in timezone', {
        baseDate: baseDate.toISOString(),
        timeString,
        timezone,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Fall back to creating time in UTC
      const [hours, minutes] = timeString.split(':').map(Number);
      const fallbackDate = new Date(baseDate);
      fallbackDate.setUTCHours(hours, minutes, 0, 0);
      return fallbackDate;
    }
  }

  /**
   * Format a date in a specific timezone
   */
  formatDateInTimezone(
    date: Date,
    timezone: string,
    options: Intl.DateTimeFormatOptions = {},
  ): string {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        ...options,
      });
      return formatter.format(date);
    } catch (error) {
      this.logger.warn('Failed to format date in timezone, using UTC', {
        timezone,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return date.toISOString();
    }
  }

  /**
   * Validate if a timezone string is valid
   */
  isValidTimezone(timezone: string): boolean {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get common timezone options for UI
   */
  getCommonTimezones(): Array<{ value: string; label: string; offset: string }> {
    const commonTimezones = [
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'America/Toronto',
      'America/Vancouver',
      'Europe/London',
      'Europe/Berlin',
      'Europe/Paris',
      'Europe/Rome',
      'Europe/Moscow',
      'Asia/Tokyo',
      'Asia/Shanghai',
      'Asia/Kolkata',
      'Asia/Dubai',
      'Australia/Sydney',
      'Australia/Melbourne',
      'Pacific/Auckland',
    ];

    const now = new Date();

    return commonTimezones
      .map((tz) => {
        const offset = this.getTimezoneOffset(now, tz);
        const offsetHours = Math.floor(Math.abs(offset) / 60);
        const offsetMinutes = Math.abs(offset) % 60;
        const offsetSign = offset >= 0 ? '+' : '-';
        const offsetString = `${offsetSign}${offsetHours.toString().padStart(2, '0')}:${offsetMinutes.toString().padStart(2, '0')}`;

        return {
          value: tz,
          label: tz.replace('_', ' '),
          offset: `UTC${offsetString}`,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }
}
