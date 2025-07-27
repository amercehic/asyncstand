import { IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OrgRole } from '@prisma/client';

export class UpdateMemberDto {
  @ApiProperty({
    description: 'New role to assign to the member',
    enum: OrgRole,
    example: 'ADMIN',
    required: false,
  })
  @IsEnum(OrgRole)
  @IsOptional()
  role?: OrgRole;

  @ApiProperty({
    description: 'Whether to suspend the member',
    example: true,
    required: false,
  })
  @IsOptional()
  suspend?: boolean;
}
