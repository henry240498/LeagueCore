import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateVenueDto {
  @IsOptional() @IsString() @MaxLength(150) name?: string;
  @IsOptional() @IsString() @MaxLength(120) city?: string;
  @IsOptional() @IsString() @MaxLength(80) country?: string;
  @IsOptional() @IsInt() @Min(0) capacity?: number;
  @IsOptional() @IsInt() @Min(1800) @Max(2200) openedYear?: number;
}
