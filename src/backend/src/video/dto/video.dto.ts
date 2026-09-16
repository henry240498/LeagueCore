import { IsIn, IsInt, IsISO8601, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export const VIDEO_KINDS = ['PARTIDO_COMPLETO', 'ENTRENAMIENTO', 'FRAGMENTO', 'SCOUTING'] as const;

export class CreateVideoDto {
  @IsOptional() @IsInt() matchId?: number | null;
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional() @IsIn([...VIDEO_KINDS]) kind?: string;
  @IsOptional() @IsString() @MaxLength(1000) videoUrl?: string | null;
  @IsOptional() @IsInt() @Min(0) durationSeconds?: number | null;
  @IsOptional() @IsInt() offsetSeconds?: number;
  @IsOptional() @IsISO8601() recordedAt?: string | null;
}

export class UpdateVideoDto {
  @IsOptional() @IsInt() matchId?: number | null;
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsIn([...VIDEO_KINDS]) kind?: string;
  @IsOptional() @IsString() @MaxLength(1000) videoUrl?: string | null;
  @IsOptional() @IsInt() @Min(0) durationSeconds?: number | null;
  @IsOptional() @IsInt() offsetSeconds?: number;
  @IsOptional() @IsISO8601() recordedAt?: string | null;
}

export class CreateTagDto {
  @IsString()
  @MaxLength(50)
  code!: string;

  @IsString()
  @MaxLength(150)
  label!: string;
}

export const MARKER_SOURCES = ['goal', 'shot', 'card', 'substitution', 'custom'] as const;

export class CreateMarkerDto {
  @IsInt()
  @Min(0)
  timeSeconds!: number;

  @IsOptional() @IsString() @MaxLength(50) tagCode?: string | null;
  @IsOptional() @IsIn([...MARKER_SOURCES]) eventSource?: string | null;
  @IsOptional() @IsInt() eventId?: number | null;
  @IsOptional() @IsString() @MaxLength(500) note?: string | null;
  @IsOptional() favorite?: boolean;
}

export class CreateClipDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsInt()
  @Min(0)
  startSeconds!: number;

  @IsInt()
  @Min(1)
  endSeconds!: number;

  @IsOptional() @IsString() @MaxLength(500) description?: string | null;
}
