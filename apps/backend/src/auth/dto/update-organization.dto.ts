import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SanitizeHtml } from '@/common/validators/sanitize-html.validator';

export class UpdateOrganizationDto {
  @ApiProperty({
    description: 'Organization name',
    example: 'Acme Corporation',
    minLength: 1,
    maxLength: 100,
  })
  @IsString({ message: 'Organization name must be a string' })
  @IsNotEmpty({ message: 'Organization name is required' })
  @MinLength(1, { message: 'Organization name must be at least 1 character long' })
  @MaxLength(100, { message: 'Organization name must not exceed 100 characters' })
  @SanitizeHtml({ stripUnknownTags: true })
  name: string;
}
