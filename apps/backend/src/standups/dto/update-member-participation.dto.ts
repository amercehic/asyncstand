import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateMemberParticipationDto {
  @ApiProperty({
    description: 'Whether the team member participates in standups',
    example: true,
  })
  @IsBoolean()
  include: boolean;

  @ApiPropertyOptional({
    description: 'Optional role for the team member (e.g., "lead", "member")',
    example: 'lead',
  })
  @IsOptional()
  @IsString()
  @Length(1, 50, { message: 'Role must be between 1-50 characters' })
  role?: string;
}
