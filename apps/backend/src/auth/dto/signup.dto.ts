import { IsEmail, IsString, IsOptional, IsUUID, IsNotEmpty } from 'class-validator';
import { IsStrongPassword } from '@/auth/validators/password.validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignupDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
    type: String,
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @ApiProperty({
    description: 'User password (must meet strong password requirements)',
    example: 'StrongP@ssw0rd123',
    type: String,
  })
  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  @IsStrongPassword()
  password!: string;

  @ApiProperty({
    description: 'User full name',
    example: 'John Doe',
    type: String,
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'Organization ID (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    type: String,
    required: false,
  })
  @IsUUID('4', { message: 'Organization ID must be a valid UUID' })
  @IsOptional()
  orgId?: string;
}
