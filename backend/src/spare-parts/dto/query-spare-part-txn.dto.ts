import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export class QuerySparepartTxnDto extends PaginationDto {
  @ApiPropertyOptional({ example: 1, description: 'กรองตาม ID อะไหล่' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  sparepartId?: number;

  @ApiPropertyOptional({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', description: 'กรองตามรหัสใบงานซ่อม' })
  @IsOptional()
  @IsUUID()
  jobId?: string;

  @ApiPropertyOptional({ example: 'WITHDRAW', description: 'กรองตามประเภทรายการ (WITHDRAW, RETURN, ADJUST)' })
  @IsOptional()
  @IsString()
  txnType?: string;

  @ApiPropertyOptional({ description: 'กรองตามรหัสผู้ทำรายการ (User UUID)' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: 'กรองรายการตั้งแต่วันที่ (YYYY-MM-DD)', example: '2026-08-01' })
  @IsOptional()
  @IsDateString({ strict: true })
  startDate?: string;

  @ApiPropertyOptional({ description: 'กรองรายการถึงวันที่ (YYYY-MM-DD)', example: '2026-08-31' })
  @IsOptional()
  @IsDateString({ strict: true })
  endDate?: string;
}

