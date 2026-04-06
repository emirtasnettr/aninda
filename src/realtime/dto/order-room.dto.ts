import { IsString } from 'class-validator';

export class OrderRoomDto {
  @IsString()
  orderId: string;
}
