import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsBoolean, IsDateString } from 'class-validator';

export class UsageLimitDto {
  @ApiProperty()
  @IsNumber()
  used: number;

  @ApiProperty({ required: false, nullable: true })
  limit: number | null;

  @ApiProperty({ required: false, nullable: true })
  available: number | null;

  @ApiProperty()
  @IsNumber()
  percentage: number;

  @ApiProperty()
  @IsBoolean()
  nearLimit: boolean;

  @ApiProperty()
  @IsBoolean()
  overLimit: boolean;
}

export class CurrentUsageDto {
  @ApiProperty()
  orgId: string;

  @ApiProperty({ type: UsageLimitDto })
  teams: UsageLimitDto;

  @ApiProperty({ type: UsageLimitDto })
  members: UsageLimitDto;

  @ApiProperty({ type: UsageLimitDto })
  standupConfigs: UsageLimitDto;

  @ApiProperty({ type: UsageLimitDto })
  standupsThisMonth: UsageLimitDto;

  @ApiProperty()
  @IsDateString()
  nextResetDate: Date;

  @ApiProperty()
  @IsString()
  planName: string;

  @ApiProperty()
  @IsBoolean()
  isFreePlan: boolean;
}

export class BillingPeriodDto {
  @ApiProperty()
  orgId: string;

  @ApiProperty()
  periodStart: Date;

  @ApiProperty()
  periodEnd: Date;

  @ApiProperty()
  @IsNumber()
  daysUntilReset: number;

  @ApiProperty()
  @IsBoolean()
  isInTrial: boolean;
}

export class UsageHistoryDto {
  @ApiProperty()
  date: Date;

  @ApiProperty()
  teams: number;

  @ApiProperty()
  members: number;

  @ApiProperty()
  standupConfigs: number;

  @ApiProperty()
  standupsCount: number;
}
