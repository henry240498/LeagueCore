import { ArrayNotEmpty, IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const RESEARCH_ENTITY_TYPES = ['player', 'official'] as const;
export type ResearchEntityType = (typeof RESEARCH_ENTITY_TYPES)[number];

export class StartResearchRunDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(RESEARCH_ENTITY_TYPES, { each: true })
  entityTypes!: ResearchEntityType[];

  @IsString()
  @MaxLength(80)
  country!: string;

  @IsOptional() @IsString() @MaxLength(150) competitionName?: string;
  @IsOptional() @IsInt() @Min(1900) @Max(2100) yearFrom?: number;
  @IsOptional() @IsInt() @Min(1900) @Max(2100) yearTo?: number;
}
