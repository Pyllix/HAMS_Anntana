import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ArrayNotEmpty,
  ArrayUnique,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import {
  ActionType,
  ReportType,
  StepActionType,
  UrgencyStatus,
} from '@prisma/client';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export class QueryRepairJobDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['MINE', 'MINE_OR_UNASSIGNED'] })
  @IsOptional()
  @IsIn(['MINE', 'MINE_OR_UNASSIGNED'])
  readonly assignmentScope?: 'MINE' | 'MINE_OR_UNASSIGNED';

  @ApiPropertyOptional({
    description: 'Filter by asset type before pagination',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  readonly assetTypeId?: number;

  @ApiPropertyOptional({
    description:
      'Filter by one or more job status codes before pagination; accepts comma-separated or repeated values',
    type: [String],
    example: ['WAITING_DELIVERY', 'COMPLETED'],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return value;
    const values = Array.isArray(value) ? value : [value];
    return values
      .flatMap((item) => String(item).split(','))
      .map((item) => item.trim())
      .filter(Boolean);
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(20, { each: true })
  readonly statusCodes?: string[];

  @ApiPropertyOptional({
    description: 'Only include repair jobs with a non-empty diagnosis',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true' || value === '1') return true;
    if (value === false || value === 'false' || value === '0') return false;
    return value;
  })
  @IsBoolean()
  readonly evaluatedOnly?: boolean;

  @ApiPropertyOptional({
    description:
      'Filter by overdue status (true = past due date and not completed/cancelled)',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  isOverdue?: boolean;

  @ApiPropertyOptional({
    description:
      'Filter by job status code (e.g. PENDING, IN_PROGRESS, COMPLETED)',
  })
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

  @ApiPropertyOptional({
    description:
      'Only include jobs whose highest completed workflow step matches this number; steps after this number exclude a job even when they belong to a different action type',
    minimum: 0,
    maximum: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20)
  readonly workflowStep?: number;

  @ApiPropertyOptional({
    description:
      'Filter jobs by whether they have a pending spare-part withdrawal',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true' || value === '1') return true;
    if (value === false || value === 'false' || value === '0') return false;
    return value;
  })
  @IsBoolean()
  readonly hasPendingSparepartWithdrawal?: boolean;

  @ApiPropertyOptional({
    enum: ['ALL', 'INTERNAL', 'EXTERNAL', 'MIXED'],
    description:
      'Filter pending spare-part approvals by source; omit or use ALL for all sources',
  })
  @IsOptional()
  @IsIn(['ALL', 'INTERNAL', 'EXTERNAL', 'MIXED'])
  readonly sparepartSource?: 'ALL' | 'INTERNAL' | 'EXTERNAL' | 'MIXED';

  @ApiPropertyOptional({
    description: 'Filter jobs by whether a workflow step has been rejected',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true' || value === '1') return true;
    if (value === false || value === 'false' || value === '0') return false;
    return value;
  })
  @IsBoolean()
  readonly isRejected?: boolean;

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
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  mechanicId?: string;

  @ApiPropertyOptional({
    description: 'Filter ticket created from date (YYYY-MM-DD)',
    example: '2026-08-01',
  })
  @IsDateString({ strict: true })
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Filter ticket created to date (YYYY-MM-DD)',
    example: '2026-08-31',
  })
  @IsDateString({ strict: true })
  @IsOptional()
  endDate?: string;
}
