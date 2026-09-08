import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { USER_ROLES, type UserRole } from '../../auth/roles';

export class UpdateUserDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(50) username?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(120) displayName?: string;
  @IsOptional() @IsIn(USER_ROLES) role?: UserRole;
}

export class SetUserStatusDto {
  @IsIn(['active', 'inactive'])
  status!: 'active' | 'inactive';
}

export class SetUserPasswordDto {
  @IsString()
  password!: string;
}
