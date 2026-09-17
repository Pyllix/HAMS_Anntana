import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export class QueryStockInHistoryDto extends PaginationDto {

  @ApiPropertyOptional({ example: 1, description: 'กรองตาม ID อะไหล่' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  sparepartId?: number;

  @ApiPropertyOptional({ example: 'PO-2026-001', description: 'กรองตามเลขที่เอกสารรับเข้า/PO' })
  @IsOptional()
  @IsString()
  sparepartAddDoc?: string;

  @ApiPropertyOptional({ description: 'กรองตามรหัสผู้บันทึกรับของ (User UUID)' })
  @IsOptional()
  @IsUUID()
  addBy?: string;

  @ApiPropertyOptional({ description: 'กรองรายการตั้งแต่วันที่ (YYYY-MM-DD)', example: '2026-08-01' })
  @IsOptional()
  @IsDateString({ strict: true })
  startDate?: string;

  @ApiPropertyOptional({ description: 'กรองรายการถึงวันที่ (YYYY-MM-DD)', example: '2026-08-31' })
  @IsOptional()
  @IsDateString({ strict: true })
  endDate?: string;
}
