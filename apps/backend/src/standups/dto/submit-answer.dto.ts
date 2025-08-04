import { IsString, IsInt, Min, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubmitAnswerDto {
  @ApiProperty({
    description: 'The standup instance ID',
    example: 'clv8k1234567890abcdef1234',
  })
  @IsString()
  @IsNotEmpty()
  standupInstanceId: string;

  @ApiProperty({
    description: 'Index of the question being answered (0-based)',
    example: 0,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  questionIndex: number;

  @ApiProperty({
    description: 'The answer text',
    example:
      'I worked on implementing the standup execution engine and made good progress on the scheduling system.',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  text: string;
}
