import { IsNumber, IsOptional, Max, Min, ValidateIf } from 'class-validator';

export class UpdatePricingRuleDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  basePrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  perKmPrice?: number;

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

  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsNumber()
  @Min(0)
  @Max(1)
  courierSharePercent?: number | null;
}
