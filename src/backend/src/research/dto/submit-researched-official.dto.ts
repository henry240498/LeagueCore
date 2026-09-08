import { IsISO8601, IsObject, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { FieldSourceDto } from './submit-researched-player.dto';

export class SubmitResearchedOfficialDto {
  @IsString()
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @MaxLength(100)
  lastName!: string;

  @IsOptional() @IsISO8601() dateOfBirth?: string;
  @IsOptional() @IsString() @MaxLength(120) city?: string;
  @IsOptional() @IsString() @MaxLength(80) nationality?: string;
  @IsOptional() @IsString() @MaxLength(80) officialTypeName?: string;
  @IsOptional() @IsUrl() photoUrl?: string;

  @IsString()
  @MaxLength(150)
  sourceName!: string;

  @IsString()
  @MaxLength(500)
  sourceUrl!: string;

  @IsOptional() @IsString() @MaxLength(100) externalId?: string;

  @IsOptional()
  @IsObject()
  fieldSources?: Record<string, FieldSourceDto>;
}
