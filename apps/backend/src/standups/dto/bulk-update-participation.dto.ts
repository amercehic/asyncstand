import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class MemberParticipationUpdate {
  @ApiProperty({
    description: 'Team member ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsUUID()
  teamMemberId: string;

  @ApiProperty({
    description: 'Whether the team member participates in standups',
    example: true,
  })
  @IsBoolean()
  include: boolean;

  @ApiProperty({
    description: 'Optional role for the team member',
    example: 'lead',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(1, 50, { message: 'Role must be between 1-50 characters' })
  role?: string;
}

export class BulkUpdateParticipationDto {
  @ApiProperty({
    description: 'Array of member participation updates',
    type: [MemberParticipationUpdate],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MemberParticipationUpdate)
  members: MemberParticipationUpdate[];
}
