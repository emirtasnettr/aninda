import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Role } from '@prisma/client';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

const LOGO_MAX_BYTES = 2 * 1024 * 1024;

@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Public()
  @Get()
  getPublic() {
    return this.settings.getPublic();
  }

  @Patch()
  @Roles(Role.ADMIN, Role.OPERATIONS_MANAGER)
  patch(@Body() dto: UpdateSettingsDto) {
    return this.settings.update(dto);
  }

  @Post('logo')
  @Roles(Role.ADMIN, Role.OPERATIONS_MANAGER)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: LOGO_MAX_BYTES },
    }),
  )
  uploadLogo(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Dosya gerekli (file)');
    }
    return this.settings.saveUploadedLogo(file);
  }
}
