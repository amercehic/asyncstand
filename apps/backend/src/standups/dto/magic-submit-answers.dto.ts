import { IsString, IsArray, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class MagicAnswerItem {
  @ApiProperty({
    description: 'Index of the question being answered (0-based)',
    example: 0,
  })
  questionIndex: number;

  @ApiProperty({
    description: 'The answer text',
    example: 'I worked on implementing the magic token system.',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty()
  text: string;
}

export class MagicSubmitAnswersDto {
  @ApiProperty({
    description: 'The magic token for authentication',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsNotEmpty()
  magicToken: string;

  @ApiProperty({
    description: 'Array of answers for multiple questions',
    type: [MagicAnswerItem],
    example: [
      {
        questionIndex: 0,
        text: 'I worked on implementing the magic token system and completed the JWT-based authentication.',
      },
      {
        questionIndex: 1,
        text: 'Today I will focus on creating the web submission endpoint and testing the integration.',
      },
      {
        questionIndex: 2,
        text: 'No blockers at the moment, everything is progressing smoothly.',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MagicAnswerItem)
  answers: MagicAnswerItem[];
}
