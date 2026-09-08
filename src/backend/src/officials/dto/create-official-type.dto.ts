import { IsString, MaxLength } from 'class-validator';

export class CreateOfficialTypeDto {
  @IsString()
  @MaxLength(80)
  name!: string;
}
