import { IsString } from 'class-validator';
import { QuoteQueryDto } from './quote-query.dto';

export class StaffQuoteQueryDto extends QuoteQueryDto {
  @IsString()
  userId: string;
}
