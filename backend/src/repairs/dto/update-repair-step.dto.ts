import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class UpdateRepairStepDto {
  @ApiPropertyOptional({ description: 'ข้อความบันทึกความคืบหน้า หรือหมายเหตุประกอบ (สามารถระบุได้ทุกสเต็ป)' })
  @IsString()
  @IsOptional()
  note?: string;


  @ApiPropertyOptional({
    description: '[เฉพาะแทร็ก OUTSOURCE - สเต็ป 5] รหัสบริษัทภายนอกที่ส่งซ่อม (ระบุโดย PARCEL_STAFF)',
    example: 'uuid',
  })
  @IsUUID()
  @IsOptional()
  companyId?: string;

  @ApiPropertyOptional({
    description: '[เฉพาะแทร็ก OUTSOURCE - สเต็ป 5] เลขที่บิล/ใบแจ้งหนี้/ใบสั่งจ้างจากบริษัทภายนอก (ระบุโดย PARCEL_STAFF)',
    example: 'INV-2026-0899',
  })
  @IsString()
  @IsOptional()
  billNo?: string;

  @ApiPropertyOptional({
    description: '[เฉพาะแทร็ก OUTSOURCE - สเต็ป 5] ค่าซ่อมจริงตามบิลจากบริษัทภายนอก (ระบุโดย PARCEL_STAFF)',
    example: 3500.0,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  repairCost?: number;

  @ApiPropertyOptional({
    description: '[เฉพาะสเต็ปสุดท้าย - ตรวจรับงานและปิด Job] User ID ของเจ้าหน้าที่ประจำหน่วยงานผู้ตรวจรับเครื่องคืน (บังคับในสเต็ปสุดท้าย)',
    example: 'uuid',
  })
  @IsString()
  @IsOptional()
  receiverId?: string;

  @ApiPropertyOptional({
    description: '[เฉพาะสเต็ปสุดท้าย - ตรวจรับงานและปิด Job] วันสิ้นสุดการรับประกันงานซ่อม (ถ้ามี, รูปแบบ YYYY-MM-DD)',
    example: '2027-09-01',
  })
  @IsDateString({ strict: true })
  @IsOptional()
  warrantyDate?: string;
}
