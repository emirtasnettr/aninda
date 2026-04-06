import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectCourierDocumentDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
