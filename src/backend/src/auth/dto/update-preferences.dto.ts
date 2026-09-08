import { IsBoolean } from 'class-validator';

export class UpdatePreferencesDto {
  @IsBoolean()
  forcePasswordChangeOnReset!: boolean;
}
