import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RejectBorrowDto {
  @ApiPropertyOptional({ description: 'เหตุผลในการปฏิเสธคำขอยืม' })
  @IsOptional()
  @IsString()
  reason?: string;
}
