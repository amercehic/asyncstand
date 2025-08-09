import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddTeamMemberDto {
  @ApiProperty({
    description: 'Slack user ID to add to the team',
    example: 'U1234567890',
  })
  @IsString()
  slackUserId: string;
}
