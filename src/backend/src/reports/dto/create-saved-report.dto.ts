import { IsArray, IsIn, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

const SORT_DIRS = ['asc', 'desc'];

export class CreateSavedReportDto {
  @IsString() @IsNotEmpty() @MaxLength(150) name!: string;
  @IsString() @IsNotEmpty() @MaxLength(50) reportType!: string;
  @IsOptional() @IsObject() filters?: Record<string, unknown>;
  @IsOptional() @IsArray() @IsString({ each: true }) columns?: string[];
  @IsOptional() @IsString() sortBy?: string;
  @IsOptional() @IsIn(SORT_DIRS) sortDir?: string;
}
