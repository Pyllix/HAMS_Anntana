import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ReturnCondition } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReturnAssetBorrowDto {
  @ApiProperty({
    description: 'UUID หรือรหัสพนักงานของผู้ที่นำของมาส่งคืนที่เคาน์เตอร์ (ต้องเป็นผู้ยืมหรือคนในแผนกเดียวกัน)',
    example: 'GOV-67005',
  })
  @IsNotEmpty()
  @IsString()
  returnedByUserId: string;

  @ApiProperty({
    enum: ReturnCondition,
    example: ReturnCondition.Normal,
    description: 'สภาพของครุภัณฑ์ตอนส่งคืนที่เคาน์เตอร์ (Normal=ปกติ, Damage=ชำรุด)',
  })
  @IsEnum(ReturnCondition)
  @IsNotEmpty()
  returnCondition: ReturnCondition;

  @ApiPropertyOptional({
    example: 'ส่งคืนสภาพปกติที่เคาน์เตอร์ศูนย์ฯ อุปกรณ์ครบ',
    description: 'หมายเหตุการส่งคืน',
  })
  @IsOptional()
  @IsString()
  returnRemark?: string;
}
