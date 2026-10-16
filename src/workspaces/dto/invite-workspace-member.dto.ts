import { IsEmail, MaxLength } from 'class-validator';

export class InviteWorkspaceMemberDto {
  @IsEmail()
  @MaxLength(255)
  email: string;
}
