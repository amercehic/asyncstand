import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ValidateChannelDto {
  @ApiProperty({
    description: 'Slack channel ID to validate',
    example: 'C1234567890',
  })
  @IsString()
  channelId: string;
}
