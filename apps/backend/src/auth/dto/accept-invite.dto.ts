import { IsString, IsNotEmpty, MinLength, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AcceptInviteDto {
  @ApiProperty({
    description: 'Invitation token received via email or other communication',
    example: 'abc123def456...',
  })
  @IsString({ message: 'Token must be a string' })
  @IsNotEmpty({ message: 'Token is required' })
  token: string;

  @ApiProperty({
    description:
      'User full name (minimum 3 characters) - required for new users, optional for existing users',
    example: 'John Doe',
    minLength: 3,
    required: false,
  })
  @ValidateIf((o) => o.name !== undefined)
  @IsString({ message: 'Name must be a string' })
  @MinLength(3, { message: 'Name must be at least 3 characters long' })
  name?: string;

  @ApiProperty({
    description:
      'User password (minimum 8 characters) - required for new users, optional for existing users',
    example: 'SecurePassword123!',
    minLength: 8,
    required: false,
  })
  @ValidateIf((o) => o.password !== undefined)
  @IsString({ message: 'Password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password?: string;
}
