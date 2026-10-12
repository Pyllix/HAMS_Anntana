import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
} from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export class QuerySparepartDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: ['NORMAL', 'LOW', 'OUT'],
    description:
      'Filter stock state: NORMAL (> 0 and above minimum), LOW (> 0 and at/below minimum), OUT (0 or less)',
  })
  @IsOptional()
  @IsIn(['NORMAL', 'LOW', 'OUT'])
  readonly stockStatus?: 'NORMAL' | 'LOW' | 'OUT';

  @ApiPropertyOptional({ example: 1, description: 'กรองตาม ID กลุ่มอะไหล่' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  groupId?: number;

  @ApiPropertyOptional({
    example: true,
    description:
      'กรองเฉพาะรายการที่สต็อกต่ำกว่าเกณฑ์ขั้นต่ำ (qty_in_stock <= min_stock)',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  lowStock?: boolean;
}
