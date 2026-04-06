import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CourierDocumentReviewStatus,
  CourierDocumentType,
  CourierWorkflowStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { COURIER_STATUS } from '../common/constants/courier-workflow';
import { PrismaService } from '../prisma/prisma.service';

export const ALL_COURIER_DOCUMENT_TYPES: CourierDocumentType[] = [
  CourierDocumentType.ID_FRONT,
  CourierDocumentType.LICENSE_FRONT,
  CourierDocumentType.LICENSE_BACK,
  CourierDocumentType.RESIDENCE,
  CourierDocumentType.CRIMINAL_RECORD,
];

const MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

export type CourierDocumentSlot = {
  type: CourierDocumentType;
  fileUrl: string | null;
  reviewStatus: CourierDocumentReviewStatus | 'MISSING';
  rejectionReason: string | null;
};

@Injectable()
export class CourierDocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  parseDocumentTypeParam(raw: string): CourierDocumentType {
    const key = raw.trim().toUpperCase().replace(/-/g, '_');
    if (ALL_COURIER_DOCUMENT_TYPES.includes(key as CourierDocumentType)) {
      return key as CourierDocumentType;
    }
    throw new BadRequestException('Geçersiz evrak tipi');
  }

  mergeDocumentSlots(
    rows: {
      type: CourierDocumentType;
      fileUrl: string;
      reviewStatus: CourierDocumentReviewStatus;
      rejectionReason: string | null;
    }[],
  ): CourierDocumentSlot[] {
    const map = new Map(rows.map((r) => [r.type, r]));
    return ALL_COURIER_DOCUMENT_TYPES.map((type) => {
      const r = map.get(type);
      if (!r) {
        return {
          type,
          fileUrl: null,
          reviewStatus: 'MISSING' as const,
          rejectionReason: null,
        };
      }
      return {
        type,
        fileUrl: r.fileUrl,
        reviewStatus: r.reviewStatus,
        rejectionReason: r.rejectionReason,
      };
    });
  }

  async uploadMyDocument(
    userId: string,
    docType: CourierDocumentType,
    file: Express.Multer.File,
  ) {
    const courier = await this.prisma.courier.findUnique({
      where: { userId },
      include: { documents: true },
    });
    if (!courier) {
      throw new NotFoundException('Kurye profili bulunamadı');
    }
    const ws = courier.workflowStatus;
    if (
      ws !== COURIER_STATUS.PRE_APPROVED &&
      ws !== COURIER_STATUS.DOCUMENT_PENDING
    ) {
      throw new ForbiddenException('Bu aşamada evrak yükleyemezsiniz');
    }
    const existing = courier.documents.find((d) => d.type === docType);
    if (existing?.reviewStatus === CourierDocumentReviewStatus.APPROVED) {
      throw new BadRequestException('Onaylanmış evrak değiştirilemez');
    }
    const ext = MIME_EXT[file.mimetype];
    if (!ext) {
      throw new BadRequestException('Dosya JPEG, PNG, WebP veya PDF olmalıdır');
    }

    const dir = path.join(
      process.cwd(),
      'uploads',
      'courier-documents',
      courier.id,
    );
    await fs.mkdir(dir, { recursive: true });
    const fileName = `${docType.toLowerCase()}-${randomUUID()}${ext}`;
    const fullPath = path.join(dir, fileName);
    await fs.writeFile(fullPath, file.buffer);
    const relative = `/uploads/courier-documents/${courier.id}/${fileName}`;

    if (existing) {
      const oldUrl = existing.fileUrl;
      await this.prisma.courierDocument.update({
        where: { id: existing.id },
        data: {
          fileUrl: relative,
          reviewStatus: CourierDocumentReviewStatus.PENDING_REVIEW,
          rejectionReason: null,
        },
      });
      await this.unlinkIfLocal(oldUrl);
    } else {
      await this.prisma.courierDocument.create({
        data: {
          courierId: courier.id,
          type: docType,
          fileUrl: relative,
          reviewStatus: CourierDocumentReviewStatus.PENDING_REVIEW,
        },
      });
    }

    return this.prisma.courier.findUniqueOrThrow({
      where: { userId },
      include: {
        user: { select: { id: true, email: true, role: true } },
        documents: true,
        performance: {
          select: {
            totalDeliveries: true,
            successfulDeliveries: true,
            cancelledDeliveries: true,
            averageDeliveryTimeMinutes: true,
          },
        },
      },
    });
  }

  private async unlinkIfLocal(relativeUrl: string | null) {
    if (!relativeUrl?.startsWith('/uploads/courier-documents/')) return;
    const full = path.join(process.cwd(), relativeUrl.replace(/^\//, ''));
    await fs.unlink(full).catch(() => undefined);
  }

  async submitForReview(userId: string) {
    const courier = await this.prisma.courier.findUnique({
      where: { userId },
      include: { documents: true },
    });
    if (!courier) {
      throw new NotFoundException('Kurye profili bulunamadı');
    }
    if (
      courier.workflowStatus !== COURIER_STATUS.PRE_APPROVED &&
      courier.workflowStatus !== COURIER_STATUS.DOCUMENT_PENDING
    ) {
      throw new BadRequestException('Evrak gönderimi bu aşamada yapılamaz');
    }

    const byType = new Map(courier.documents.map((d) => [d.type, d]));
    for (const t of ALL_COURIER_DOCUMENT_TYPES) {
      const d = byType.get(t);
      if (!d) {
        throw new BadRequestException(`Eksik evrak: ${t}`);
      }
      if (d.reviewStatus === CourierDocumentReviewStatus.REJECTED) {
        throw new BadRequestException('Reddedilen evrakları yeniden yükleyin');
      }
    }

    const hasPending = courier.documents.some(
      (d) => d.reviewStatus === CourierDocumentReviewStatus.PENDING_REVIEW,
    );
    if (!hasPending) {
      throw new BadRequestException(
        'İncelemeye gönderilecek bekleyen evrak yok',
      );
    }

    await this.prisma.courier.update({
      where: { id: courier.id },
      data: { workflowStatus: CourierWorkflowStatus.DOCUMENT_REVIEW },
    });

    return this.prisma.courier.findUniqueOrThrow({
      where: { userId },
      include: {
        user: { select: { id: true, email: true, role: true } },
        documents: true,
        performance: {
          select: {
            totalDeliveries: true,
            successfulDeliveries: true,
            cancelledDeliveries: true,
            averageDeliveryTimeMinutes: true,
          },
        },
      },
    });
  }

  async approveDocument(courierId: string, docType: CourierDocumentType) {
    const courier = await this.prisma.courier.findUnique({
      where: { id: courierId },
      include: { documents: true },
    });
    if (!courier) {
      throw new NotFoundException('Courier not found');
    }
    if (courier.workflowStatus !== CourierWorkflowStatus.DOCUMENT_REVIEW) {
      throw new BadRequestException(
        'Evrak onayı yalnızca inceleme aşamasındayken yapılabilir',
      );
    }

    const doc = courier.documents.find((d) => d.type === docType);
    if (
      !doc ||
      doc.reviewStatus !== CourierDocumentReviewStatus.PENDING_REVIEW
    ) {
      throw new BadRequestException('Onaylanacak bekleyen evrak yok');
    }

    await this.prisma.courierDocument.update({
      where: { id: doc.id },
      data: {
        reviewStatus: CourierDocumentReviewStatus.APPROVED,
        rejectionReason: null,
      },
    });

    const updated = await this.prisma.courier.findUniqueOrThrow({
      where: { id: courierId },
      include: { documents: true },
    });
    const allApproved = ALL_COURIER_DOCUMENT_TYPES.every((t) => {
      const d = updated.documents.find((x) => x.type === t);
      return d?.reviewStatus === CourierDocumentReviewStatus.APPROVED;
    });
    if (allApproved) {
      await this.prisma.courier.update({
        where: { id: courierId },
        data: { workflowStatus: CourierWorkflowStatus.APPROVED },
      });
    }

    return this.prisma.courier.findUniqueOrThrow({
      where: { id: courierId },
      include: {
        user: { select: { id: true, email: true, role: true } },
        documents: true,
      },
    });
  }

  async rejectDocument(
    courierId: string,
    docType: CourierDocumentType,
    reason?: string,
  ) {
    const courier = await this.prisma.courier.findUnique({
      where: { id: courierId },
      include: { documents: true },
    });
    if (!courier) {
      throw new NotFoundException('Courier not found');
    }
    if (courier.workflowStatus !== CourierWorkflowStatus.DOCUMENT_REVIEW) {
      throw new BadRequestException(
        'Evrak reddi yalnızca inceleme aşamasındayken yapılabilir',
      );
    }

    const doc = courier.documents.find((d) => d.type === docType);
    if (
      !doc ||
      doc.reviewStatus !== CourierDocumentReviewStatus.PENDING_REVIEW
    ) {
      throw new BadRequestException('Reddedilecek bekleyen evrak yok');
    }

    await this.prisma.$transaction([
      this.prisma.courierDocument.update({
        where: { id: doc.id },
        data: {
          reviewStatus: CourierDocumentReviewStatus.REJECTED,
          rejectionReason: reason?.trim() || null,
        },
      }),
      this.prisma.courier.update({
        where: { id: courierId },
        data: {
          workflowStatus: CourierWorkflowStatus.DOCUMENT_PENDING,
          isOnline: false,
        },
      }),
    ]);

    return this.prisma.courier.findUniqueOrThrow({
      where: { id: courierId },
      include: {
        user: { select: { id: true, email: true, role: true } },
        documents: true,
      },
    });
  }
}
