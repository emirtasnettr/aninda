import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { CourierWorkflowStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CustomersService } from '../customers/customers.service';
import { isValidTurkishNationalId } from '../common/utils/tc-kimlik.util';
import { RegisterDto } from './dto/register.dto';
import { RegisterCourierOnboardingDto } from './dto/register-courier-onboarding.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { JwtPayload } from './strategies/jwt.strategy';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly customers: CustomersService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: dto.email,
          password: passwordHash,
          role: dto.role,
        },
      });
      if (dto.role === Role.COURIER) {
        await tx.courier.create({
          data: {
            userId: created.id,
            type: dto.courierType!,
            workflowStatus: CourierWorkflowStatus.APPROVED,
          },
        });
      }
      await this.customers.ensureCustomerForUser(tx, created);
      return created;
    });

    return this.buildAuthResponse(user.id, user.email, user.role);
  }

  async registerCourierOnboarding(
    dto: RegisterCourierOnboardingDto,
  ): Promise<AuthResponseDto> {
    if (!isValidTurkishNationalId(dto.tcNo)) {
      throw new BadRequestException('Geçersiz T.C. kimlik numarası');
    }

    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });
    if (existingEmail) {
      throw new ConflictException('Bu e-posta adresi zaten kayıtlı');
    }
    const existingTc = await this.prisma.courier.findUnique({
      where: { tcNo: dto.tcNo },
    });
    if (existingTc) {
      throw new ConflictException('Bu T.C. kimlik numarası zaten kayıtlı');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const birthDate = new Date(dto.birthDate);
    if (Number.isNaN(birthDate.getTime())) {
      throw new BadRequestException('Geçersiz doğum tarihi');
    }
    birthDate.setHours(12, 0, 0, 0);
    const oldestAllowedBirth = new Date();
    oldestAllowedBirth.setHours(12, 0, 0, 0);
    oldestAllowedBirth.setFullYear(oldestAllowedBirth.getFullYear() - 18);
    if (birthDate.getTime() > oldestAllowedBirth.getTime()) {
      throw new BadRequestException('Kayıt için en az 18 yaşında olmalısınız');
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: dto.email.trim().toLowerCase(),
          password: passwordHash,
          role: Role.COURIER,
        },
      });
      await tx.courier.create({
        data: {
          userId: created.id,
          type: dto.vehicleType,
          workflowStatus: CourierWorkflowStatus.PENDING,
          fullName: dto.fullName.trim(),
          phone: dto.phone.trim(),
          birthDate,
          tcNo: dto.tcNo,
          plateNumber: dto.plateNumber.trim().toUpperCase(),
          hasCompany: dto.hasCompany,
          companyTaxId: dto.hasCompany ? dto.companyTaxId?.trim() : null,
          companyTaxOffice: dto.hasCompany
            ? dto.companyTaxOffice?.trim()
            : null,
          companyAddress: dto.hasCompany ? dto.companyAddress?.trim() : null,
          residenceAddress: dto.hasCompany
            ? null
            : (dto.residenceAddress?.trim() ?? null),
        },
      });
      return created;
    });
    return this.buildAuthResponse(user.id, user.email, user.role);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(dto.password, user.password);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.buildAuthResponse(user.id, user.email, user.role);
  }

  private buildAuthResponse(
    id: string,
    email: string,
    role: Role,
  ): AuthResponseDto {
    const payload: JwtPayload = { sub: id, email, role };
    const expiresSec =
      Number(this.config.get<string>('JWT_EXPIRES_SEC')) || 60 * 60 * 24 * 7;
    return {
      accessToken: this.jwtService.sign(payload, { expiresIn: expiresSec }),
      user: { id, email, role },
    };
  }
}
