import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCoachDto {
  @IsString()
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @MaxLength(100)
  lastName!: string;

  @IsOptional() @IsString() @MaxLength(80) nationality?: string | null;
  @IsOptional() @IsIn(['active', 'inactive']) status?: string;
  @IsOptional() @IsString() @MaxLength(500) photoUrl?: string | null;
}
