import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum StandupInstanceState {
  PENDING = 'pending',
  COLLECTING = 'collecting',
  POSTED = 'posted',
}

export class UpdateInstanceStateDto {
  @ApiProperty({
    description: 'The new state for the standup instance',
    enum: StandupInstanceState,
    example: StandupInstanceState.COLLECTING,
  })
  @IsEnum(StandupInstanceState)
  state: StandupInstanceState;
}
