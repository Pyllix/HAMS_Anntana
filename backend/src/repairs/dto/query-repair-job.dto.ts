import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { ActionType, ReportType, StepActionType, UrgencyStatus } from '@prisma/client';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export class QueryRepairJobDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by overdue status (true = past due date and not completed/cancelled)' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  isOverdue?: boolean;

  @ApiPropertyOptional({ description: 'Filter by job status code (e.g. PENDING, IN_PROGRESS, COMPLETED)' })
  @IsString()
  @IsOptional()
  statusCode?: string;

  @ApiPropertyOptional({ enum: ActionType })
  @IsEnum(ActionType)
  @IsOptional()
  actionType?: ActionType;

  @ApiPropertyOptional({ enum: StepActionType })
  @IsEnum(StepActionType)
  @IsOptional()
  stepActionType?: StepActionType;

  @ApiPropertyOptional({ enum: UrgencyStatus })
  @IsEnum(UrgencyStatus)
  @IsOptional()
  urgencyStatus?: UrgencyStatus;

  @ApiPropertyOptional({ enum: ReportType })
  @IsEnum(ReportType)
  @IsOptional()
  reportType?: ReportType;

  @ApiPropertyOptional({ description: 'Filter by Section ID' })
  @IsUUID()
  @IsOptional()
  sectionId?: string;

  @ApiPropertyOptional({ description: 'Filter by Asset ID' })
  @IsUUID()
  @IsOptional()
  assetId?: string;

  @ApiPropertyOptional({ description: 'Filter by Reporter User ID' })
  @IsUUID()
  @IsOptional()
  reporterId?: string;

  @ApiPropertyOptional({ description: 'Filter by Assigned Mechanic User ID' })
  @IsUUID()
  @IsOptional()
  mechanicId?: string;

  @ApiPropertyOptional({ description: 'Filter ticket created from date (YYYY-MM-DD)', example: '2026-08-01' })
  @IsDateString({ strict: true })
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Filter ticket created to date (YYYY-MM-DD)', example: '2026-08-31' })
  @IsDateString({ strict: true })
  @IsOptional()
  endDate?: string;
}
