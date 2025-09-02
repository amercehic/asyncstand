import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OrgRole } from '@prisma/client';

export class InviteMemberDto {
  @ApiProperty({
    description: 'Email address of the person to invite',
    example: 'john.doe@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address (e.g., john.doe@example.com)' })
  @IsNotEmpty({ message: 'Email is required' })
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
