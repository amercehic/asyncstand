import { IsArray, IsString, ArrayNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BulkAddTeamMembersDto {
  @ApiProperty({
    description: 'Array of Slack user IDs to add to the team',
    example: ['U1234567890', 'U0987654321'],
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  slackUserIds: string[];
}
