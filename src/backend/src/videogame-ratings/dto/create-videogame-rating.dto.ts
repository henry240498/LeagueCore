import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class CategoryScoreDto {
  @IsString() @MaxLength(10) code!: string; // PAC/SHO/PAS/DRI/DEF/PHY o DIV/HAN/KIC/REF/SPD/POS
  @IsInt() @Min(1) @Max(99) score!: number;
}

export class DetailedAttributeDto {
  @IsString() @MaxLength(60) code!: string;
  @IsOptional() @IsString() @MaxLength(120) nameSource?: string;
  @IsOptional() @IsInt() @Min(1) @Max(99) value?: number;
  @IsOptional() @IsString() @MaxLength(10) categoryCode?: string;
}

export class CreateVideogameRatingDto {
  @IsString() @MaxLength(80) videogameName!: string;
  @IsString() @MaxLength(60) editionName!: string;
  @IsInt() @Min(1993) @Max(2100) editionYear!: number;

  @IsOptional() @IsInt() @Min(1) @Max(99) overallRating?: number;
  @IsOptional() @IsString() @MaxLength(30) cardVariant?: string;
  @IsOptional() @IsString() @MaxLength(10) positionIngame?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => CategoryScoreDto)
  categories?: CategoryScoreDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => DetailedAttributeDto)
  detailedAttributes?: DetailedAttributeDto[];

  @IsString() @MaxLength(150) sourceName!: string;
  @IsString() @MaxLength(500) sourceUrl!: string;
}
