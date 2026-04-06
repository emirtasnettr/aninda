import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

const SETTINGS_ID = 'default';

const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate() {
    return this.prisma.systemSettings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, appName: 'Teslimatjet' },
      update: {},
    });
  }

  async getPublic() {
    const row = await this.getOrCreate();
    return {
      logoUrl: row.logoUrl,
      appName: row.appName,
    };
  }

  async update(dto: UpdateSettingsDto) {
    await this.getOrCreate();
    const data: { appName?: string; logoUrl?: string | null } = {};
    if (dto.appName !== undefined) {
      data.appName = dto.appName.trim();
    }
    if (dto.logoUrl !== undefined) {
      const raw = dto.logoUrl === null ? null : String(dto.logoUrl).trim();
      if (raw === null || raw === '') {
        await this.removeLocalLogoFileIfAny();
        data.logoUrl = null;
      } else {
        const before = await this.prisma.systemSettings.findUnique({
          where: { id: SETTINGS_ID },
          select: { logoUrl: true },
        });
        if (
          before?.logoUrl &&
          before.logoUrl.startsWith('/uploads/branding/') &&
          before.logoUrl !== raw
        ) {
          await this.deleteLocalBrandingFile(before.logoUrl);
        }
        data.logoUrl = raw;
      }
    }
    if (Object.keys(data).length === 0) {
      return this.getPublic();
    }
    await this.prisma.systemSettings.update({
      where: { id: SETTINGS_ID },
      data,
    });
    return this.getPublic();
  }

  async saveUploadedLogo(file: Express.Multer.File) {
    const ext = ALLOWED_MIME[file.mimetype];
    if (!ext) {
      throw new BadRequestException('Desteklenen türler: JPEG, PNG, GIF, WebP');
    }
    await this.getOrCreate();
    await this.removeLocalLogoFileIfAny();

    const name = `${randomUUID()}${ext}`;
    const relative = `/uploads/branding/${name}`;
    const dir = path.join(process.cwd(), 'uploads', 'branding');
    const full = path.join(dir, name);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(full, file.buffer);

    await this.prisma.systemSettings.update({
      where: { id: SETTINGS_ID },
      data: { logoUrl: relative },
    });

    return this.getPublic();
  }

  private async removeLocalLogoFileIfAny() {
    const row = await this.prisma.systemSettings.findUnique({
      where: { id: SETTINGS_ID },
      select: { logoUrl: true },
    });
    if (row?.logoUrl) {
      await this.deleteLocalBrandingFile(row.logoUrl);
    }
  }

  private async deleteLocalBrandingFile(relativeUrl: string) {
    if (!relativeUrl.startsWith('/uploads/branding/')) {
      return;
    }
    const safeName = path.basename(relativeUrl);
    if (safeName.includes('..') || safeName !== safeName.trim()) {
      return;
    }
    const full = path.join(process.cwd(), 'uploads', 'branding', safeName);
    try {
      await fs.unlink(full);
    } catch (e) {
      this.logger.warn(`Logo dosyası silinemedi: ${String(e)}`);
    }
  }
}
