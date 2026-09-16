import { IsIn, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateInjuryDto {
  @IsString()
  @MaxLength(100)
  injuryType!: string;

  @IsOptional() @IsString() @MaxLength(100) bodyPart?: string;
  @IsOptional() @IsIn(['LEVE', 'MODERADA', 'GRAVE']) severity?: string;
  @IsISO8601()
  startDate!: string;
  @IsOptional() @IsISO8601() endDate?: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class UpdateInjuryDto {
  @IsOptional() @IsString() @MaxLength(100) injuryType?: string;
  @IsOptional() @IsString() @MaxLength(100) bodyPart?: string;
  @IsOptional() @IsIn(['LEVE', 'MODERADA', 'GRAVE']) severity?: string;
  @IsOptional() @IsISO8601() startDate?: string;
  @IsOptional() @IsISO8601() endDate?: string;
  @IsOptional() @IsIn(['ACTIVA', 'RECUPERADO']) status?: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
