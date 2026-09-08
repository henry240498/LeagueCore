import { IsInt, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateParameterDto {
  @IsString()
  @MaxLength(60)
  @Matches(/^[A-Za-z0-9_\-]+$/, { message: 'code sólo puede contener letras, números, guiones y guiones bajos' })
  code!: string;

  @IsString() @MaxLength(120) label!: string;

  @IsOptional() @IsInt() sortOrder?: number;
}
