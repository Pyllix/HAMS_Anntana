import { IsOptional, IsString, IsUUID, IsInt, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
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
}

