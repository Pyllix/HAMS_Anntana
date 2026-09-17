import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { ReportType, UrgencyStatus } from '@prisma/client';

export class UpdateRepairRequestDto {
  @ApiPropertyOptional({ description: 'Updated symptom or problem description' })
  @IsString()
  @IsOptional()
  symptom?: string;

  @ApiPropertyOptional({ enum: UrgencyStatus })
  @IsEnum(UrgencyStatus)
  @IsOptional()
  urgencyStatus?: UrgencyStatus;

  @ApiPropertyOptional({ enum: ReportType })
  @IsEnum(ReportType)
  @IsOptional()
  reportType?: ReportType;

  @ApiPropertyOptional({ description: 'Updated Job Type ID' })
  @IsInt()
  @IsOptional()
  jobTypeId?: number;
}
