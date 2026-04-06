import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** Admin: yeni personel / kullanıcı oluştur (tüm roller) */
  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  /** Admin ve operasyon yöneticisi: kullanıcı listesi */
  @Get()
  @Roles(Role.ADMIN, Role.OPERATIONS_MANAGER)
  findAll() {
    return this.usersService.findAll();
  }

  /** Kendi profili veya admin */
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() me: AuthUser) {
    if (me.sub !== id && me.role !== Role.ADMIN) {
      throw new ForbiddenException('You can only access your own profile');
    }
    return this.usersService.findOne(id);
  }
}
