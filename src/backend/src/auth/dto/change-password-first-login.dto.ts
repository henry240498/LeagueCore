import { IsString } from 'class-validator';

export class ChangePasswordFirstLoginDto {
  @IsString()
  newPassword!: string;
}
