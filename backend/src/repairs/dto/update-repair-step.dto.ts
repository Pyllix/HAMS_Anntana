import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateRepairStepDto {
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

  @ApiPropertyOptional({
    description: 'User ID of the department staff who received the asset upon job completion',
    example: 'uuid',
  })
  @IsString()
  @IsOptional()
  receiverId?: string;

  @ApiPropertyOptional({
    description: 'Warranty expiration date string (e.g. 2027-09-01)',
  })
  @IsDateString({ strict: true })
  @IsOptional()
  warrantyDate?: string;
}
