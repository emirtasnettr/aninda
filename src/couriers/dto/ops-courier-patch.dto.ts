import { IsBoolean } from 'class-validator';

/** Operasyon: kurye çevrimiçi / çevrimdışı */
export class OpsCourierPatchDto {
  @IsBoolean()
  isOnline!: boolean;
}
