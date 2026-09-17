import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CompleteUnrepairableDto {
  @ApiPropertyOptional({ description: 'Inspection notes from parcel staff upon receiving the unrepairable equipment' })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({ description: 'Designated disposal holding location (e.g. ห้องพักพัสดุรอจำหน่าย อาคาร A)' })
  @IsString()
  @IsOptional()
  storageLocation?: string;
}
