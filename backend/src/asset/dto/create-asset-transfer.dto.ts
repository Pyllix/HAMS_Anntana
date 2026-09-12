import { IsString, IsNotEmpty, IsDateString, IsOptional, IsUUID } from 'class-validator';
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
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: 'UUID ของผู้ขอโอน (หากไม่ระบุจะใช้ผู้ใช้งานที่กำลังล็อกอิน)',
  })
  @IsOptional()
  @IsUUID()
  requested_by?: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440002',
    description: 'UUID ของผู้อนุมัติการโอน (หากไม่ระบุจะใช้ผู้ใช้งานที่กำลังล็อกอิน)',
  })
  @IsOptional()
  @IsUUID()
  approved_by?: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440003',
    description: 'UUID ของผู้รับมอบในแผนกปลายทาง (หากไม่ระบุจะใช้ผู้ใช้งานที่กำลังล็อกอิน)',
  })
  @IsOptional()
  @IsUUID()
  received_by?: string;

  @ApiPropertyOptional({
    example: 'COMPLETED',
    default: 'COMPLETED',
    description: 'สถานะการโอนย้าย (เช่น COMPLETED, PENDING)',
  })
  @IsOptional()
  @IsString()
  transferStatus?: string = 'COMPLETED';

  @ApiPropertyOptional({
    example: 'โอนย้ายถาวรเพื่อรองรับผู้ป่วยวิกฤตฉุกเฉินประจำหอผู้ป่วย ICU',
    description: 'หมายเหตุหรือเหตุผลความจำเป็นในการโอนย้าย',
  })
  @IsOptional()
  @IsString()
  remark?: string;
}
