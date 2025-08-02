import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddTeamMemberDto {
  @ApiProperty({
    description: 'Team member ID from existing Slack sync data',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  teamMemberId: string;
}
