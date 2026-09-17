import { IsOptional, IsString, IsUUID, IsInt, IsDateString, IsBoolean } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class BorrowFilterDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by borrow transaction pattern ID (e.g. BR-202609-0001)' })
  @IsOptional()
  @IsString()
  borrowNo?: string;

  @ApiPropertyOptional({ description: 'Filter by asset UUID' })
  @IsOptional()
  @IsUUID()
  assetId?: string;

  @ApiPropertyOptional({ description: 'Filter by borrower UUID or Employee Code (รหัสพนักงาน)' })
  @IsOptional()
  @IsString()
  borrowerId?: string;

  @ApiPropertyOptional({ description: 'Filter by borrow status ID (1=BORROWED, 2=RETURNED, 3=CANCELLED)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  borrowStatusId?: number;

  @ApiPropertyOptional({ description: 'Filter by borrower department/section UUID' })
  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @ApiPropertyOptional({ description: 'Filter borrowings created from date (YYYY-MM-DD)', example: '2026-08-01' })
  @IsOptional()
  @IsDateString({ strict: true })
  startDate?: string;

  @ApiPropertyOptional({ description: 'Filter borrowings created to date (YYYY-MM-DD)', example: '2026-08-31' })
  @IsOptional()
  @IsDateString({ strict: true })
  endDate?: string;

  @ApiPropertyOptional({ description: 'Filter borrowings where return date is overdue (true/false)' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true || value === '1' || value === 1)
  @IsBoolean()
  isOverdue?: boolean;

  @ApiPropertyOptional({ description: 'Filter borrowings that have a pending extension request (true/false)' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true || value === '1' || value === 1)
  @IsBoolean()
  hasPendingExtension?: boolean;


  @ApiPropertyOptional({ description: 'Filter borrowings that have been extended at least N times (e.g. 1, 2, 3)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  minExtensionCount?: number;

  @ApiPropertyOptional({ description: 'Filter expected return date from (YYYY-MM-DD)', example: '2026-09-01' })
  @IsOptional()
  @IsDateString({ strict: true })
  expectedReturnStartDate?: string;

  @ApiPropertyOptional({ description: 'Filter expected return date to (YYYY-MM-DD)', example: '2026-09-30' })
  @IsOptional()
  @IsDateString({ strict: true })
  expectedReturnEndDate?: string;
}


