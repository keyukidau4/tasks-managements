import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    example: 'opaque-refresh-token',
    minLength: 1,
    maxLength: 128,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  refreshToken: string;
}
