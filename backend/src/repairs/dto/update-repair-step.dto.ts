import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateRepairStepDto {
  @ApiPropertyOptional({ description: 'Completion timestamp (ISO string), defaults to now if omitted' })
  @IsDateString()
  @IsOptional()
  completeAt?: string;

  @ApiPropertyOptional({ description: 'Optional progress note or remark for this step' })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({
    description: 'Document reference number (e.g. Purchase order doc or invoice for Step 8 external stock)',
  })
  @IsString()
  @IsOptional()
  docNo?: string;
}
