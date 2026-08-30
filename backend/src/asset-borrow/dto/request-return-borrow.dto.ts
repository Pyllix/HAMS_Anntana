import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RequestReturnBorrowDto {
  @ApiPropertyOptional({
    example: 'ICU ชั้น 4 เตียง 2 อาคารเฉลิมพระเกียรติ',
    description: 'สถานที่หรือจุดนัดรับเครื่องที่วอร์ด',
  })
  @IsOptional()
  @IsString()
  pickupLocation?: string;

  @ApiPropertyOptional({
    example: 'ใช้งานเสร็จแล้ว สามารถมารับเครื่องได้เลยค่ะ',
    description: 'หมายเหตุการแจ้งคืน',
  })
  @IsOptional()
  @IsString()
  remark?: string;
}
