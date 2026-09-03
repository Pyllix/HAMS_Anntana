import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, MaxLength, Min } from 'class-validator';

export class CreateSparepartDto {
  @ApiProperty({ example: 'SP-ELE-001', description: 'รหัสอะไหล่' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  code: string;

  @ApiProperty({ example: 'ฟิวส์เซรามิก 10A 250V', description: 'ชื่อรายการอะไหล่' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'ชิ้น', default: 'ชิ้น', description: 'หน่วยนับ' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string;

  @ApiProperty({ example: 45.5, description: 'ราคาต่อหน่วย (บาท)' })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  @ApiPropertyOptional({ example: 5, default: 0, description: 'จำนวนขั้นต่ำที่ต้องมีในคลัง (สำหรับแจ้งเตือนสั่งซื้อ)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minStock?: number;

  @ApiPropertyOptional({ example: 20, default: 0, description: 'จำนวนเริ่มต้นในคลัง' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  qtyInStock?: number;

  @ApiProperty({ example: 1, description: 'ID ของกลุ่มอะไหล่' })
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  groupId: number;
}
