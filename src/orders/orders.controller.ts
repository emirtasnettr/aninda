import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { AssignOrderDto } from './dto/assign-order.dto';
import { RateCourierDto } from './dto/rate-courier.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /** Müşteri: yeni sipariş → durum searching_courier, en yakın 5 kuryeye teklif */
  @Post()
  create(@CurrentUser() me: AuthUser, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(me, dto);
  }

  /** Rolüne göre sipariş listesi */
  @Get()
  findAll(@CurrentUser() me: AuthUser) {
    return this.ordersService.findAllForUser(me);
  }

  /** Kurye: teklif kabulü (ilk kabul eden alır) */
  @Post(':id/accept')
  accept(@Param('id') id: string, @CurrentUser() me: AuthUser) {
    return this.ordersService.acceptByCourier(id, me);
  }

  /** Kurye: bekleyen iş teklifini reddeder */
  @Post(':id/decline')
  decline(@Param('id') id: string, @CurrentUser() me: AuthUser) {
    return this.ordersService.declineOfferByCourier(id, me);
  }

  /** Müşteri: teslim edilen sipariş için kurye puanı */
  @Post(':id/rating')
  @Roles(Role.INDIVIDUAL_CUSTOMER, Role.CORPORATE_CUSTOMER)
  rateCourier(
    @Param('id') id: string,
    @Body() dto: RateCourierDto,
    @CurrentUser() me: AuthUser,
  ) {
    return this.ordersService.rateCourier(id, me, dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() me: AuthUser) {
    return this.ordersService.findOne(id, me);
  }

  /** Operasyon: manuel kurye ata (pending / searching_courier) */
  @Patch(':id/assign')
  assignManual(
    @Param('id') id: string,
    @Body() dto: AssignOrderDto,
    @CurrentUser() me: AuthUser,
  ) {
    return this.ordersService.assignManual(id, dto, me);
  }

  /** Operasyon: serbest durum; kurye: accepted → picked_up → on_delivery → delivered */
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() me: AuthUser,
  ) {
    return this.ordersService.updateStatus(id, dto, me);
  }
}
