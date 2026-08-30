import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ReturnCondition, ReturnMethod } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReturnAssetBorrowDto {
  @ApiProperty({
    enum: ReturnCondition,
    example: ReturnCondition.Normal,
    description: 'สภาพของครุภัณฑ์ตอนส่งคืน (Normal=ปกติ, Damage=ชำรุด)',
  })
  @IsEnum(ReturnCondition)
  @IsNotEmpty()
  returnCondition: ReturnCondition;

  @ApiProperty({
    enum: ReturnMethod,
    example: ReturnMethod.self_return,
    description: 'วิธีการส่งคืน (self_return=ผู้ยืมนำส่งคืนเอง, staff_pickup=เจ้าหน้าที่ไปรับคืน)',
  })
  @IsEnum(ReturnMethod)
  @IsNotEmpty()
  returnMethod: ReturnMethod;

  @ApiPropertyOptional({
    example: 'ส่งคืนสภาพปกติ อุปกรณ์ครบ',
    description: 'หมายเหตุการส่งคืน',
  })
  @IsOptional()
  @IsString()
  returnRemark?: string;

  @ApiPropertyOptional({
    description: 'UUID หรือรหัสพนักงานของผู้ที่นำของมาส่งคืน (สำหรับกรณีเจ้าหน้าที่ทำรายการแทน)',
  })
  @IsOptional()
  @IsString()
  returnedByUserId?: string;
}
