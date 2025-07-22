import { IsEmail, IsString, MinLength, IsOptional, IsUUID } from 'class-validator';

export class SignupDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsUUID()
  @IsOptional()
  orgId?: string;

  @IsString()
  @IsOptional()
  invitationToken?: string;
}
