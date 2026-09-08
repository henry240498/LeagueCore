import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateParameterDto {
  @IsOptional() @IsString() @MaxLength(120) label?: string;
  @IsOptional() @IsInt() sortOrder?: number;
}
