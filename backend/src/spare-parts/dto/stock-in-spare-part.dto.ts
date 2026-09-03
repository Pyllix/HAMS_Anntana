import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, MaxLength, Min } from 'class-validator';

export class StockInSparepartDto {
  @ApiProperty({ example: 1, description: 'ID ของอะไหล่ที่รับเข้า' })
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  sparepartId: number;

  @ApiProperty({ example: 50, description: 'จำนวนอะไหล่ที่รับเข้าสต็อก' })
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  qty: number;

  @ApiPropertyOptional({ example: 2275.0, description: 'ราคารวมทั้งหมดของล็อตที่รับเข้า (หากไม่ระบุจะคำนวณจาก price * qty)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  totalPrice?: number;

  @ApiProperty({ example: 'PO-2567-089', description: 'เลขที่เอกสารรับเข้า/ใบเสร็จ/ใบสั่งซื้อ' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  sparepartAddDoc: string;
}
