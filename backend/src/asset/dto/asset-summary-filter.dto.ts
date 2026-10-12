import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class AssetSummaryFilterDto {
  @ApiPropertyOptional({ description: 'Limit summary to one section' })
  @IsOptional()
  @IsUUID()
  readonly section_id?: string;
}
