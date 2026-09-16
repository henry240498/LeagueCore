import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export const PLAY_CATEGORIES = [
  'CORNER',
  'FREEKICK',
  'THROWIN',
  'PENALTY',
  'ATTACK',
  'PRESSING',
  'BUILDUP',
] as const;

export class CreatePlayDto {
  @IsString()
  @MaxLength(30)
  code!: string;

  @IsIn([...PLAY_CATEGORIES])
  category!: string;

  @IsString()
  @MaxLength(150)
  title!: string;

  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsString() diagramJson?: string | null;
  @IsOptional() @IsString() @MaxLength(500) videoUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(150) rival?: string | null;
  @IsOptional() @IsString() @MaxLength(100) result?: string | null;
}

export class UpdatePlayDto {
  @IsOptional() @IsIn([...PLAY_CATEGORIES]) category?: string;
  @IsOptional() @IsString() @MaxLength(150) title?: string;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsString() diagramJson?: string | null;
  @IsOptional() @IsString() @MaxLength(500) videoUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(150) rival?: string | null;
  @IsOptional() @IsString() @MaxLength(100) result?: string | null;
  @IsOptional() @IsInt() usageCount?: number;
}
