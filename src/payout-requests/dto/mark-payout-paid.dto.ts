import { IsOptional, IsString, MaxLength } from 'class-validator';

export class MarkPayoutPaidDto {
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  receiptUrl?: string;
}
