import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class SlackOauthCallbackDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  state!: string;

  @IsOptional()
  @IsString()
  error?: string;
}
