import { IsOptional, IsString, IsUUID, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class BorrowFilterDto extends PaginationDto {
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
}
