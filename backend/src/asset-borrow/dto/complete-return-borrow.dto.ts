import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ReturnCondition } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CompleteReturnBorrowDto {
  @ApiProperty({
    enum: ReturnCondition,
    example: ReturnCondition.Normal,
    description: 'สภาพของครุภัณฑ์หลังตรวจรับเข้าคลัง (Normal=ปกติ, Damage=ชำรุด)',
  })
  @IsEnum(ReturnCondition)
  @IsNotEmpty()
  returnCondition: ReturnCondition;

  @ApiPropertyOptional({
    example: 'ตรวจรับสภาพเรียบร้อย อุปกรณ์ครบถ้วน',
    description: 'หมายเหตุผลการตรวจรับ',
  })
  @IsOptional()
  @IsString()
  returnRemark?: string;
}
