import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class RepairSummaryFilterDto {
  @ApiPropertyOptional({ description: 'Limit repair totals to one section' })
  @IsOptional()
  @IsUUID()
  readonly sectionId?: string;

  @ApiPropertyOptional({
    description: 'Count only jobs with a diagnosis',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true' || value === '1') return true;
    if (value === false || value === 'false' || value === '0') return false;
    return value;
  })
  @IsBoolean()
  readonly evaluatedOnly?: boolean;
}
