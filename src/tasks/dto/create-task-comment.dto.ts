import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTaskCommentDto {
  @ApiProperty({
    example: 'I have started working on this task.',
    minLength: 1,
    maxLength: 10000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  content: string;
}
