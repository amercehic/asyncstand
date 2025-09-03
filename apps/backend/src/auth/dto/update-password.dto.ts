import { IsString, MinLength, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePasswordDto {
  @ApiProperty({
    description: 'Current password for verification',
    example: 'currentPassword123',
  })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({
    description: 'New password (minimum 8 characters)',
    example: 'newPassword123!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters long' })
  @IsNotEmpty()
  newPassword: string;
}
