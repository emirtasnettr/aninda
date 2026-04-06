import { CourierType, Role } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

const REGISTER_ROLES = [
  Role.INDIVIDUAL_CUSTOMER,
  Role.CORPORATE_CUSTOMER,
  Role.COURIER,
] as const;

export type RegisterRole = (typeof REGISTER_ROLES)[number];

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;

  @IsIn([...REGISTER_ROLES], {
    message: `role must be one of: ${REGISTER_ROLES.join(', ')}`,
  })
  role: RegisterRole;

  @ValidateIf((o: RegisterDto) => o.role === Role.COURIER)
  @IsEnum(CourierType, { message: 'courierType is required for COURIER role' })
  courierType?: CourierType;
}
