import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export class AssetFilterDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter assets by Section ID',
  })
  @IsOptional()
  @IsUUID()
  section_id?: string;

  @ApiPropertyOptional({
    description: 'Filter assets by physical status lookup ID',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  asset_status_id?: number;

  @ApiPropertyOptional({ description: 'Filter assets by physical status code' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  readonly assetStatusCode?: string;

  @ApiPropertyOptional({
    description: 'Filter assets by availability status lookup ID',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  availability_status_id?: number;

  @ApiPropertyOptional({
    description: 'Filter assets by availability status code',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  readonly availabilityStatusCode?: string;

  @ApiPropertyOptional({
    description: 'Filter assets by Asset Type ID',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  asset_type_id?: number;

  @ApiPropertyOptional({
    description: 'Filter assets by Equipment Type ID',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  equipment_type_id?: number;

  @ApiPropertyOptional({
    description:
      'Filter updatedAt from an RFC 3339 timestamp with an explicit timezone offset',
    example: '2026-10-01T00:00:00+07:00',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  readonly updatedAtFrom?: string;

  @ApiPropertyOptional({
    description:
      'Filter updatedAt through an RFC 3339 timestamp with an explicit timezone offset',
    example: '2026-10-31T23:59:59.999+07:00',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  readonly updatedAtTo?: string;
}
