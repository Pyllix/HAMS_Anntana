import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { ActionType, StepActionType } from '@prisma/client';

export class SparePartRequisitionItemDto {
  @ApiProperty({ description: 'Spare part ID from Master SPAREPART table', example: 1 })
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  sparepartId: number;

  @ApiProperty({ description: 'Quantity required for this repair job', example: 2 })
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  qty: number;
}

export class DiagnoseRepairJobDto {
  @ApiProperty({ description: 'Detailed diagnosis findings' })
  @IsString()
  @IsNotEmpty()
  diagnosis: string;

  @ApiProperty({ description: 'Planned solution or repair action' })
  @IsString()
  @IsNotEmpty()
  solution: string;

  @ApiProperty({ description: 'Cause ID from CAUSE table', example: 1 })
  @IsInt()
  @IsNotEmpty()
  causeId: number;

  @ApiProperty({ description: 'Tech Category ID from TECH_CATEGORY table', example: 1 })
  @IsInt()
  @IsNotEmpty()
  techCategoryId: number;

  @ApiProperty({ description: 'Job Type ID from JOB_TYPE table', example: 1 })
  @IsInt()
  @IsNotEmpty()
  jobTypeId: number;

  @ApiProperty({
    enum: ActionType,
    description: 'ประเภทการดำเนินการ: REPAIR (ตรวจซ่อม), FABRICATE (สร้างใหม่), MODIFY (ปรับปรุง), PREVENTIVE (เชิงรุก)',
    default: ActionType.REPAIR,
  })
  @IsEnum(ActionType)
  @IsNotEmpty()
  actionType: ActionType;

  @ApiProperty({
    enum: StepActionType,
    description:
      'ประเภทขั้นตอนการจัดหา/ดำเนินการ (Step Master): SELF_REPAIR, INTERNAL_STOCK, EXTERNAL_STOCK, OUTSOURCE, PURCHASE_REPLACEMENT',
  })
  @IsEnum(StepActionType)
  @IsNotEmpty()
  stepActionType: StepActionType;

  @ApiPropertyOptional({ description: 'Estimated completion date (ISO string)' })
  @IsDateString({ strict: true })
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Is this a repeated repair for the same issue?', default: false })
  @IsBoolean()
  @IsOptional()
  isRepeatRepair?: boolean;

  @ApiPropertyOptional({ description: 'Company ID (required for OUTSOURCE)', example: 'uuid' })
  @IsUUID()
  @IsOptional()
  companyId?: string;

  @ApiPropertyOptional({ description: 'Invoice / Bill number (for OUTSOURCE)' })
  @IsString()
  @IsOptional()
  billNo?: string;

  @ApiPropertyOptional({
    description: 'Array of mechanic User IDs assigned to this job',
    type: [String],
  })
  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  mechanicIds?: string[];

  @ApiPropertyOptional({
    description: 'List of spare parts required (for INTERNAL_STOCK or EXTERNAL_STOCK)',
    type: [SparePartRequisitionItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SparePartRequisitionItemDto)
  @IsOptional()
  spareParts?: SparePartRequisitionItemDto[];
}
