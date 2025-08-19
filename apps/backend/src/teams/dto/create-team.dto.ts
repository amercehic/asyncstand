import { IsString, IsUUID, IsOptional, Length, IsTimeZone } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTeamDto {
  @ApiProperty({
    description: 'Team name',
    example: 'Engineering Team',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiProperty({
    description: 'Integration ID for Slack workspace',
    example: '746720d3-5908-4e5b-ad39-133677f57cee',
  })
  @IsUUID()
  integrationId: string;

  @ApiPropertyOptional({
    description: 'Slack channel ID (optional - teams no longer require a channel)',
    example: 'C1234567890',
  })
  @IsOptional()
  @IsString()
  channelId?: string;

  @ApiProperty({
    description: 'Timezone for standup scheduling',
    example: 'America/New_York',
  })
  @IsTimeZone()
  timezone: string;

  @ApiPropertyOptional({
    description: 'Team description',
    example: 'Our main engineering team focusing on backend development',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;
}
