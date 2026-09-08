import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { USER_ROLES, type UserRole } from '../../auth/roles';

export class CreateUserDto {
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  username!: string;

  @IsOptional() @IsEmail() email?: string;

  @IsOptional() @IsString() @MaxLength(120) displayName?: string;

  @IsString()
  password!: string;

  @IsIn(USER_ROLES)
  role!: UserRole;

  @IsOptional() @IsBoolean() isActive?: boolean;
}
