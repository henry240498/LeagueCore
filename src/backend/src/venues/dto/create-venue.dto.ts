import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateVenueDto {
  @IsString()
  @MaxLength(150)
  name!: string;

  @IsOptional() @IsString() @MaxLength(120) city?: string | null;
  @IsOptional() @IsString() @MaxLength(80) country?: string | null;
  @IsOptional() @IsInt() @Min(0) capacity?: number | null;
  @IsOptional() @IsInt() @Min(1800) @Max(2200) openedYear?: number | null;
}
