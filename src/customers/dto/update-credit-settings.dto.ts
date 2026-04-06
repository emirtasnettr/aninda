import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, Max, Min, ValidateIf } from 'class-validator';

export class UpdateCreditSettingsDto {
  @IsBoolean()
  creditEnabled!: boolean;

  /** Borç izni açıkken zorunlu (TRY, pozitif) */
  @ValidateIf((o: UpdateCreditSettingsDto) => o.creditEnabled === true)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999_999_999.99)
  @Type(() => Number)
  creditLimit?: number;
}
