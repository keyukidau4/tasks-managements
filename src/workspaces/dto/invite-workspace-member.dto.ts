import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, MaxLength } from 'class-validator';

export class InviteWorkspaceMemberDto {
  @ApiProperty({ example: 'teammate@example.com', maxLength: 255 })
  @IsEmail()
  @MaxLength(255)
  email: string;
}
