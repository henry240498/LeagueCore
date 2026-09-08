import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateLoginSettingsDto {
  @IsOptional() @IsString() @MaxLength(100) systemName?: string;
  @IsOptional() @IsString() @MaxLength(150) title?: string;
  @IsOptional() @IsString() @MaxLength(200) subtitle?: string;
  @IsOptional() @IsString() @MaxLength(300) welcomeMessage?: string;

  @IsOptional() @IsBoolean() showLogo?: boolean;
  @IsOptional() @IsBoolean() showSubtitle?: boolean;
  @IsOptional() @IsBoolean() showWelcomeMessage?: boolean;

  @IsOptional() @IsString() @MaxLength(500) logoMainUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(500) logoLoginUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(500) backgroundImageUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(500) backgroundVideoUrl?: string | null;

  @IsOptional() @IsIn(['color', 'image', 'video']) backgroundType?: string;
  @IsOptional() @IsString() @MaxLength(20) backgroundColor?: string;
  @IsOptional() @IsIn(['left', 'center', 'right', 'top', 'bottom']) backgroundPosition?: string;
  @IsOptional() @IsIn(['cover', 'contain', 'auto']) backgroundSize?: string;
  @IsOptional() @IsIn(['no-repeat', 'repeat', 'repeat-x', 'repeat-y']) backgroundRepeat?: string;
  @IsOptional() @IsString() @MaxLength(20) overlayColor?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(1) overlayOpacity?: number;

  @IsOptional() @IsBoolean() backgroundVideoMuted?: boolean;
  @IsOptional() @IsNumber() @Min(0) backgroundVideoStartSeconds?: number | null;
  @IsOptional() @IsNumber() @Min(0) backgroundVideoEndSeconds?: number | null;

  @IsOptional() @IsString() @MaxLength(20) colorPrimary?: string;
  @IsOptional() @IsString() @MaxLength(20) colorSecondary?: string;
  @IsOptional() @IsString() @MaxLength(20) colorText?: string;
  @IsOptional() @IsString() @MaxLength(20) colorTextSecondary?: string;
  @IsOptional() @IsString() @MaxLength(20) colorFormBg?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(1) colorFormBgOpacity?: number;
  @IsOptional() @IsString() @MaxLength(20) colorButton?: string;
  @IsOptional() @IsString() @MaxLength(20) colorButtonHover?: string;
  @IsOptional() @IsString() @MaxLength(20) colorError?: string;
  @IsOptional() @IsString() @MaxLength(20) colorBorder?: string;
  @IsOptional() @IsString() @MaxLength(20) colorInputBg?: string;

  @IsOptional() @IsString() @MaxLength(50) buttonText?: string;
  @IsOptional() @IsString() @MaxLength(80) placeholderUsername?: string;
  @IsOptional() @IsString() @MaxLength(80) placeholderPassword?: string;
}
