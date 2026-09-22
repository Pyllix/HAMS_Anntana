import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryExpenseForecastDto {
  @ApiPropertyOptional({
    description:
      'ID ของแผนกที่ต้องการกรอง (ถ้าไม่ส่ง หรือส่ง "all" จะเป็นการดูภาพรวมทั้งโรงพยาบาล)',
    example: 'all',
    default: 'all',
  })
  @IsOptional()
  @IsString()
  sectionId?: string = 'all';

  @ApiPropertyOptional({
    description: 'จำนวนเดือนที่ต้องการพยากรณ์ล่วงหน้า (ค่าเริ่มต้น 12 เดือน, สูงสุด 24 เดือน)',
    example: 12,
    default: 12,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  months?: number = 12;

  @ApiPropertyOptional({
    description: 'จำนวนเดือนย้อนหลังที่ต้องการดึงประวัติค่าใช้จ่าย (ค่าเริ่มต้น 12 เดือน หรือ 1 ปี)',
    example: 12,
    default: 12,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(3)
  @Max(60)
  historyMonths?: number = 12;
}

