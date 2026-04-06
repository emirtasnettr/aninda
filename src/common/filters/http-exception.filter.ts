import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

function prismaKnownStatus(prismaCode: string): number {
  if (prismaCode === 'P2018') {
    return HttpStatus.NOT_FOUND;
  }
  if (['P2003', 'P2014', 'P2011'].includes(prismaCode)) {
    return HttpStatus.BAD_REQUEST;
  }
  if (prismaCode.startsWith('P1')) {
    return HttpStatus.SERVICE_UNAVAILABLE;
  }
  return HttpStatus.INTERNAL_SERVER_ERROR;
}

function prismaKnownMessage(
  prismaCode: string,
  meta: Record<string, unknown> | undefined,
): string {
  const migrateHint =
    ' Şema için: proje kökünde `npx prisma migrate deploy` veya `npx prisma migrate dev`.';

  const column =
    meta && typeof meta.column === 'string' ? meta.column : undefined;

  switch (prismaCode) {
    case 'P1001':
      return 'Veritabanı sunucusuna ulaşılamıyor (ağ veya erişim).';
    case 'P1017':
      return 'Veritabanı bağlantısı kapandı.';
    case 'P2003':
      return 'İlişkili kayıt eksik veya geçersiz (foreign key).';
    case 'P2011':
      return 'Zorunlu alan null olamaz.';
    case 'P2014':
      return 'İlişki bütünlüğü ihlali.';
    case 'P2021':
      return `Veritabanında tablo eksik.${migrateHint}`;
    case 'P2022':
      return `Veritabanında sütun eksik${column ? ` (${column})` : ''}.${migrateHint}`;
    case 'P2034':
      return 'Bu işlem mevcut veritabanı sürümüyle uyumlu değil.';
    default:
      return `Veritabanı isteği başarısız (${prismaCode}).${migrateHint}`;
  }
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let code: string | undefined;
    let prismaMeta: Record<string, unknown> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null && 'message' in res) {
        const m = (res as { message?: string | string[] }).message;
        message = m ?? exception.message;
        code = (res as { error?: string }).error;
      }
    } else if (exception instanceof Prisma.PrismaClientInitializationError) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      message =
        'Veritabanına bağlanılamıyor. PostgreSQL çalışıyor mu ve .env içindeki DATABASE_URL doğru mu kontrol edin.';
      this.logger.error(exception.message, exception.stack);
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = exception.message;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const { code: prismaCode, meta } = exception;
      code = prismaCode;
      prismaMeta = meta ?? undefined;
      if (prismaCode === 'P2002') {
        status = HttpStatus.CONFLICT;
        message = 'Bu benzersiz alan için kayıt zaten mevcut';
      } else if (prismaCode === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = 'Kayıt bulunamadı';
      } else {
        status = prismaKnownStatus(prismaCode);
        message = prismaKnownMessage(prismaCode, meta);
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} — ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: Record<string, unknown> = {
      statusCode: status,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    };
    if (code) {
      body.code = code;
    }
    if (
      prismaMeta &&
      process.env.NODE_ENV !== 'production' &&
      typeof prismaMeta === 'object'
    ) {
      body.meta = prismaMeta;
    }

    response.status(status).json(body);
  }
}
