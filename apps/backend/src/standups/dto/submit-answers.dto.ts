import { IsString, IsArray, ValidateNested, IsNotEmpty, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class AnswerItem {
  @ApiProperty({
    description: 'Index of the question being answered (0-based)',
    example: 0,
  })
  questionIndex: number;

  @ApiProperty({
    description: 'The answer text',
    example: 'I worked on implementing the standup execution engine.',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  text: string;
}

export class SubmitAnswersDto {
  @ApiProperty({
    description: 'The standup instance ID',
    example: 'clv8k1234567890abcdef1234',
  })
  @IsString()
  @IsNotEmpty()
  standupInstanceId: string;

  @ApiProperty({
    description: 'Array of answers for multiple questions',
    type: [AnswerItem],
    example: [
      {
        questionIndex: 0,
        text: 'I worked on implementing the standup execution engine and completed the core scheduling logic.',
      },
      {
        questionIndex: 1,
        text: 'Today I will focus on testing the timezone handling and creating the background job processors.',
      },
      {
        questionIndex: 2,
        text: 'No blockers at the moment, everything is progressing well.',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerItem)
  answers: AnswerItem[];
}
