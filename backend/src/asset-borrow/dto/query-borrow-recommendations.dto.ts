import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class QueryBorrowRecommendationsDto {
  @ApiPropertyOptional({
    description: 'Filter candidates by asset model (e.g. Puritan Bennett 840)',
    example: 'Puritan Bennett 840',
  })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({
    description: 'Filter candidates by equipment type ID',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  equipmentTypeId?: number;

  @ApiPropertyOptional({
    description:
      'Optional reference asset UUID. If provided, model and equipmentTypeId will be auto-derived from this asset.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  assetId?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of recommended candidates to return',
    default: 10,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}
