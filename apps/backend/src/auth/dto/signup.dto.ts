import { IsEmail, IsString, IsOptional, IsUUID, IsNotEmpty } from 'class-validator';
import { IsStrongPassword } from '@/auth/validators/password.validator';

export class SignupDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  @IsStrongPassword()
  password: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsUUID('4', { message: 'Organization ID must be a valid UUID' })
  @IsOptional()
  orgId?: string;

  @IsString()
  @IsOptional()
  invitationToken?: string;
}
