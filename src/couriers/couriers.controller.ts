import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Role } from '@prisma/client';
import { CouriersService } from './couriers.service';
import { OpsCourierPatchDto } from './dto/ops-courier-patch.dto';
import { RejectCourierDocumentDto } from './dto/reject-courier-document.dto';
import { RejectCourierRegistrationDto } from './dto/reject-courier-registration.dto';
import { UpdateCourierDto } from './dto/update-courier.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';

const COURIER_DOC_MAX_BYTES = 12 * 1024 * 1024;

@Controller('couriers')
export class CouriersController {
  constructor(private readonly couriersService: CouriersService) {}

  /** Bekleyen kurye başvuruları */
  @Get('registrations/pending')
  @Roles(Role.ADMIN, Role.OPERATIONS_MANAGER, Role.OPERATIONS_SPECIALIST)
  listPendingRegistrations() {
    return this.couriersService.listPendingRegistrations();
  }

  /** Ön onaylı — evrak yükleme / düzeltme aşaması */
  @Get('registrations/awaiting-documents')
  @Roles(Role.ADMIN, Role.OPERATIONS_MANAGER, Role.OPERATIONS_SPECIALIST)
  listAwaitingDocuments() {
    return this.couriersService.listAwaitingDocuments();
  }

  /** Evrak inceleme kuyruğu */
  @Get('registrations/document-review')
  @Roles(Role.ADMIN, Role.OPERATIONS_MANAGER, Role.OPERATIONS_SPECIALIST)
  listDocumentReviewQueue() {
    return this.couriersService.listDocumentReviewQueue();
  }

  @Post('registrations/:id/documents/:docType/approve')
  @Roles(Role.ADMIN, Role.OPERATIONS_MANAGER, Role.OPERATIONS_SPECIALIST)
  approveCourierDocument(
    @Param('id') id: string,
    @Param('docType') docType: string,
  ) {
    return this.couriersService.approveCourierDocument(id, docType);
  }

  @Post('registrations/:id/documents/:docType/reject')
  @Roles(Role.ADMIN, Role.OPERATIONS_MANAGER, Role.OPERATIONS_SPECIALIST)
  rejectCourierDocument(
    @Param('id') id: string,
    @Param('docType') docType: string,
    @Body() dto: RejectCourierDocumentDto,
  ) {
    return this.couriersService.rejectCourierDocument(id, docType, dto.reason);
  }

  @Post('registrations/:id/approve')
  @Roles(Role.ADMIN, Role.OPERATIONS_MANAGER, Role.OPERATIONS_SPECIALIST)
  approveRegistration(@Param('id') id: string) {
    return this.couriersService.approveRegistration(id);
  }

  @Post('registrations/:id/reject')
  @Roles(Role.ADMIN, Role.OPERATIONS_MANAGER, Role.OPERATIONS_SPECIALIST)
  rejectRegistration(
    @Param('id') id: string,
    @Body() dto: RejectCourierRegistrationDto,
  ) {
    return this.couriersService.rejectRegistration(id, dto.reason);
  }

  /** Kurye: kendi profili */
  @Get('me')
  @Roles(Role.COURIER)
  getMe(@CurrentUser() me: AuthUser) {
    return this.couriersService.findByUserId(me.sub);
  }

  @Post('me/documents/:docType')
  @Roles(Role.COURIER)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: COURIER_DOC_MAX_BYTES },
    }),
  )
  uploadMyDocument(
    @CurrentUser() me: AuthUser,
    @Param('docType') docType: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.couriersService.uploadMyDocument(me.sub, docType, file);
  }

  @Post('me/documents/submit-review')
  @Roles(Role.COURIER)
  submitMyDocumentsForReview(@CurrentUser() me: AuthUser) {
    return this.couriersService.submitMyDocumentsForReview(me.sub);
  }

  /** Kurye: konum / çevrimiçi / araç tipi güncelle */
  @Patch('me')
  @Roles(Role.COURIER)
  updateMe(@CurrentUser() me: AuthUser, @Body() dto: UpdateCourierDto) {
    return this.couriersService.updateByUserId(me.sub, dto);
  }

  /** Operasyon: tüm kuryeler + günlük metrikler */
  @Get()
  @Roles(Role.ADMIN, Role.OPERATIONS_MANAGER, Role.OPERATIONS_SPECIALIST)
  findAll() {
    return this.couriersService.findAllForOps();
  }

  /** Operasyon: kurye detay + performans */
  @Get(':id')
  @Roles(Role.ADMIN, Role.OPERATIONS_MANAGER, Role.OPERATIONS_SPECIALIST)
  findOneForOps(@Param('id') id: string) {
    return this.couriersService.findOneForOps(id);
  }

  /** Operasyon: çevrimiçi / çevrimdışı (panelden) */
  @Patch(':id')
  @Roles(Role.ADMIN, Role.OPERATIONS_MANAGER, Role.OPERATIONS_SPECIALIST)
  patchForOps(@Param('id') id: string, @Body() dto: OpsCourierPatchDto) {
    return this.couriersService.patchByIdForOps(id, dto);
  }
}
