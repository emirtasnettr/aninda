import { CourierType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

function toBool(v: unknown): boolean {
  return v === true || v === 'true' || v === '1';
}

export class RegisterCourierOnboardingDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8, { message: 'Şifre en az 8 karakter olmalı' })
  password: string;

  @IsString()
  @MinLength(2, { message: 'Ad soyad en az 2 karakter olmalı' })
  @MaxLength(120)
  fullName: string;

  @IsString()
  @MinLength(10, { message: 'Geçerli bir telefon numarası girin' })
  @MaxLength(32)
  phone: string;

  @IsDateString()
  birthDate: string;

  @IsString()
  @Length(11, 11, { message: 'T.C. kimlik numarası 11 haneli olmalı' })
  @Matches(/^[0-9]+$/, {
    message: 'T.C. kimlik numarası yalnızca rakam içermeli',
  })
  tcNo: string;

  @IsEnum(CourierType)
  vehicleType: CourierType;

  @IsString()
  @MinLength(5, { message: 'Plaka en az 5 karakter olmalı' })
  @MaxLength(16)
  plateNumber: string;

  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  hasCompany: boolean;

  @ValidateIf((o: RegisterCourierOnboardingDto) => o.hasCompany === true)
  @IsString()
  @MinLength(5)
  @MaxLength(32)
  companyTaxId?: string;

  @ValidateIf((o: RegisterCourierOnboardingDto) => o.hasCompany === true)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  companyTaxOffice?: string;

  @ValidateIf((o: RegisterCourierOnboardingDto) => o.hasCompany === true)
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  companyAddress?: string;

  @ValidateIf((o: RegisterCourierOnboardingDto) => o.hasCompany !== true)
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  residenceAddress?: string;
}
