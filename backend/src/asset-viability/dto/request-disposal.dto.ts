import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RequestDisposalDto {
  @ApiPropertyOptional({
    example:
      'แทงจำหน่ายเนื่องจากประเมินแล้วซ่อมไม่คุ้มค่า: ค่าซ่อมสะสม (฿337,500.00) คิดเป็น 75.0% ของราคาจัดซื้อ ซึ่งเกินเกณฑ์ร้อยละ 70 ตามระเบียบพัสดุ',
    description: 'เหตุผลประกอบการเสนอแทงจำหน่าย (ดึงมาจาก suggestedDisposalReason ใน prefillData)',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    example: 'ห้องพักพัสดุรอจำหน่าย อาคาร A ชั้น 1',
    description: 'สถานที่จัดเก็บเครื่องชำรุดรอจำหน่าย',
  })
  @IsOptional()
  @IsString()
  storageLocation?: string;
}
