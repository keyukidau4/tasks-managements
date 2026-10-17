import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com', maxLength: 255 })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({
    example: 'correct-horse-battery-staple',
    format: 'password',
    minLength: 1,
    maxLength: 72,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password: string;
}
