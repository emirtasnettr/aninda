import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreatePricingRuleDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsNumber()
  @Min(0)
  basePrice: number;

  @IsNumber()
  @Min(0)
  perKmPrice: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(10)
  priorityMultiplier?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(10)
  nightMultiplier?: number;

  /** 0–1; boş bırakılırsa global varsayılan (DEFAULT_COURIER_SHARE_PERCENT / COURIER_EARNING_RATIO) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  courierSharePercent?: number;
}
