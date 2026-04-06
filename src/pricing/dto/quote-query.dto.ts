import { Transform } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class QuoteQueryDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  pickupLat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  pickupLng: number;

  @IsNumber()
  @Min(-90)
  @Max(90)
  deliveryLat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  deliveryLng: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }): unknown => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  priority?: boolean;
}
