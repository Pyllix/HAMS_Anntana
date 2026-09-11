import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export enum ViabilityStatusFilter {
  ALL = 'ALL',
  VIABLE = 'VIABLE',
  WARNING = 'WARNING',
  UNVIABLE = 'UNVIABLE',
}

export enum ViabilitySortBy {
  COST_RATIO = 'costRatio',
  CUMULATIVE_COST = 'cumulativeCost',
  REPAIR_COUNT = 'repairCount',
  AGE = 'age',
  CREATED_AT = 'createdAt',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class QueryAssetViabilityDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: ViabilityStatusFilter,
    description: 'Filter by viability status assessment',
    default: ViabilityStatusFilter.ALL,
  })
  @IsOptional()
  @IsEnum(ViabilityStatusFilter)
  viabilityStatus?: ViabilityStatusFilter = ViabilityStatusFilter.ALL;

  @ApiPropertyOptional({
    description: 'Filter assets by Section ID (UUID)',
  })
  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @ApiPropertyOptional({
    description: 'Filter assets by Asset Type ID',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  assetTypeId?: number;

  @ApiPropertyOptional({
    enum: ViabilitySortBy,
    description: 'Sort by field',
    default: ViabilitySortBy.COST_RATIO,
  })
  @IsOptional()
  @IsEnum(ViabilitySortBy)
  sortBy?: ViabilitySortBy = ViabilitySortBy.COST_RATIO;

  @ApiPropertyOptional({
    enum: SortOrder,
    description: 'Sort direction',
    default: SortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;

  @ApiPropertyOptional({
    description: 'Include already disposed / lost assets in the audit report',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeDisposed?: boolean = false;
}
