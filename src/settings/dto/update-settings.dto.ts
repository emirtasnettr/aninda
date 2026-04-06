import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  appName?: string;

  /** Tam URL veya `/uploads/...` yolu; null ile logo kaldırılır */
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  logoUrl?: string | null;
}
