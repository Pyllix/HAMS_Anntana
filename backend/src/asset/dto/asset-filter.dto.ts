import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export class AssetFilterDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter assets by Section ID',
  })
  @IsOptional()
  @IsString()
  section_id?: string;
}
