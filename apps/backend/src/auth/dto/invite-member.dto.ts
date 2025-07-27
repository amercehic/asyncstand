import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OrgRole } from '@prisma/client';

export class InviteMemberDto {
  @ApiProperty({
    description: 'Email address of the person to invite',
    example: 'john.doe@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Role to assign to the invited member',
    enum: OrgRole,
    example: 'MEMBER',
  })
  @IsEnum(OrgRole)
  @IsNotEmpty()
  role: OrgRole;
}
