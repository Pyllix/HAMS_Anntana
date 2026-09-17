import { IsString, IsNotEmpty, IsDateString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO สำหรับบันทึกการโอนย้ายครุภัณฑ์ (Asset Transfer) ระหว่างแผนก
 */
export class CreateAssetTransferDto {
  @ApiProperty({
    example: 'TF-2567-001',
    description: 'หมายเลขเอกสารการโอนย้ายครุภัณฑ์',
  })
  @IsString()
  @IsNotEmpty()
  transferDocNo: string;

  @ApiProperty({
    example: '2026-09-15T00:00:00.000Z',
    description: 'วันที่โอนย้ายครุภัณฑ์ (ISO Date String)',
  })
  @IsDateString()
  @IsNotEmpty()
  transferDate: string;

  @ApiProperty({
    example: 'sec-icu-001',
    description: 'รหัสแผนกปลายทางที่รับโอนครุภัณฑ์ (to_section_id)',
  })
  @IsString()
  @IsNotEmpty()
  to_section_id: string;

  @ApiPropertyOptional({
    example: 'อาคารเฉลิมพระเกียรติ ชั้น 3 ห้อง ICU-1',
    description: 'สถานที่/ห้อง/ตึกปลายทางที่นำเครื่องไปติดตั้ง',
  })
  @IsOptional()
  @IsString()
  toLocation?: string;

  @ApiPropertyOptional({
    example: 'ศูนย์เครื่องมือแพทย์ ชั้น 1',
    description: 'สถานที่ต้นทางเดิม (หากไม่ระบุจะดึงจากแผนกเดิมอัตโนมัติ)',
  })
  @IsOptional()
  @IsString()
  fromLocation?: string;

  @ApiPropertyOptional({
    example: 'โอนย้ายถาวรเพื่อรองรับผู้ป่วยวิกฤตฉุกเฉินประจำหอผู้ป่วย ICU',
    description: 'หมายเหตุหรือเหตุผลความจำเป็นในการโอนย้าย',
  })
  @IsOptional()
  @IsString()
  remark?: string;
}

