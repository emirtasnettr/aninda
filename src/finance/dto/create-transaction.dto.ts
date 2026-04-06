import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { AccountTransactionType } from '@prisma/client';

export class CreateTransactionDto {
  @IsEnum(AccountTransactionType)
  type: AccountTransactionType;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;
}
