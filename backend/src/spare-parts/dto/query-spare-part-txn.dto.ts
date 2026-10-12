import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsIn,
  IsPositive,
  IsUUID,
  Matches,
} from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import {
  SPAREPART_TXN_TYPES,
  type SparepartTxnType,
} from '../spare-part-transaction.constants';

export class QuerySparepartTxnDto extends PaginationDto {
  @ApiPropertyOptional({ example: 1, description: 'กรองตาม ID อะไหล่' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  readonly sparepartId?: number;

  @ApiPropertyOptional({
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    description: 'กรองตามรหัสใบงานซ่อม',
  })
  @IsOptional()
  @IsUUID()
  readonly jobId?: string;

  @ApiPropertyOptional({
    example: 'WITHDRAW',
    description:
      'กรองตามประเภทธุรกรรม (WITHDRAW, RETURN, PENDING_WITHDRAW); หากไม่ระบุจะแสดงเฉพาะ WITHDRAW และ RETURN',
    enum: SPAREPART_TXN_TYPES,
  })
  @IsOptional()
  @IsIn(SPAREPART_TXN_TYPES)
  readonly txnType?: SparepartTxnType;

  @ApiPropertyOptional({ description: 'กรองตามรหัสผู้ทำรายการ (User UUID)' })
  @IsOptional()
  @IsUUID()
  readonly userId?: string;

  @ApiPropertyOptional({
    description: 'กรองรายการตั้งแต่วันที่ (YYYY-MM-DD)',
    example: '2026-08-01',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  readonly startDate?: string;

  @ApiPropertyOptional({
    description: 'กรองรายการถึงวันที่ (YYYY-MM-DD)',
    example: '2026-08-31',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  readonly endDate?: string;
}
