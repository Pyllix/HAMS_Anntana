import { IsNotEmpty, IsString, IsDateString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBorrowExtensionDto {
  @ApiProperty({
    description: 'New requested return date/time (ISO 8601 string, must be after current expected return date)',
    example: '2026-10-15T17:00:00.000Z',
  })
  @IsNotEmpty()
  @IsDateString({ strict: true })
  requestedReturnDate: string;

  @ApiProperty({
    description: 'Reason for requesting extension',
    example: 'มีความจำเป็นต้องใช้งานต่อเนื่องในโครงการตรวจสุขภาพประจำปี',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5, { message: 'เหตุผลการขอต่อเวลาต้องมีความยาวอย่างน้อย 5 ตัวอักษร' })
  reason: string;
}

