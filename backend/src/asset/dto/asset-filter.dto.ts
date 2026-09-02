import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID } from 'class-validator';
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
    description: 'Filter assets by physical status ID (e.g. 1=NORMAL, 2=DAMAGED)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  asset_status_id?: number;

  @ApiPropertyOptional({
    description: 'Filter assets by availability status ID (e.g. 1=AVAILABLE, 2=BORROWED, 3=RESERVED)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  availability_status_id?: number;

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
}

