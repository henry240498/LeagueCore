import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export const TACTICAL_PHASES = ['INICIAL', 'DEFENSIVA', 'OFENSIVA', 'TRANSICION'] as const;
export const TACTICAL_BLOCKS = ['BAJO', 'MEDIO', 'ALTO'] as const;

export class SaveSetupDto {
  @IsInt()
  teamId!: number;

  @IsIn([...TACTICAL_PHASES])
  phase!: string;

  @IsOptional() @IsString() @MaxLength(10) formationShape?: string | null;
  @IsOptional() @IsIn([...TACTICAL_BLOCKS]) block?: string | null;
  @IsOptional() @IsString() @MaxLength(100) pressing?: string | null;
  @IsOptional() @IsString() @MaxLength(100) buildup?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string | null;
}
