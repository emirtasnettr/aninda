import { CourierType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateCourierDto {
  @IsOptional()
  @IsEnum(CourierType)
  type?: CourierType;

  @IsOptional()
  @IsBoolean()
  isOnline?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  bankName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  accountHolderName?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }): string | undefined => {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'string') return undefined;
    const v = value.replace(/\s/g, '').toUpperCase();
    return v === '' ? undefined : v;
  })
  @Matches(/^TR\d{24}$/, {
    message: 'Geçerli TR IBAN girin (26 karakter, TR ile başlar)',
  })
  iban?: string;
}
