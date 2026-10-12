import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class BorrowSummaryFilterDto {
  @ApiPropertyOptional({ description: 'Limit summary to a borrower section' })
  @IsOptional()
  @IsUUID()
  readonly sectionId?: string;
}
