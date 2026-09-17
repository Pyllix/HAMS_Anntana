import { IsOptional, IsEnum, IsUUID, IsString, IsDateString } from 'class-validator';
import { BorrowExtensionStatus, BorrowExtensionType } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class BorrowExtensionFilterDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: BorrowExtensionStatus,
    description: 'Filter by extension status (PENDING, APPROVED, REJECTED, CANCELLED)',
  })
  @IsOptional()
  @IsEnum(BorrowExtensionStatus)
  status?: BorrowExtensionStatus;

  @ApiPropertyOptional({
    enum: BorrowExtensionType,
    description: 'Filter by extension type (DESK, ONLINE)',
  })
  @IsOptional()
  @IsEnum(BorrowExtensionType)
  extensionType?: BorrowExtensionType;

  @ApiPropertyOptional({ description: 'Filter by department/section UUID' })
  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @ApiPropertyOptional({ description: 'Filter by borrower UUID or Employee Code' })
  @IsOptional()
  @IsString()
  borrowerId?: string;

  @ApiPropertyOptional({ description: 'Filter by borrow transaction UUID' })
  @IsOptional()
  @IsUUID()
  borrowTransactionId?: string;

  @ApiPropertyOptional({ description: 'Filter requests created from date (YYYY-MM-DD)', example: '2026-08-01' })
  @IsOptional()
  @IsDateString({ strict: true })
  startDate?: string;

  @ApiPropertyOptional({ description: 'Filter requests created to date (YYYY-MM-DD)', example: '2026-08-31' })
  @IsOptional()
  @IsDateString({ strict: true })
  endDate?: string;
}
