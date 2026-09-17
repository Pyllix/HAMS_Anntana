import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
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

  @ApiProperty({
    description: 'Source of the spare part: INTERNAL (in-warehouse) or EXTERNAL (procure from outside)',
    enum: ['INTERNAL', 'EXTERNAL'],
    example: 'INTERNAL',
  })
  @IsEnum(['INTERNAL', 'EXTERNAL'], {
    message: 'stockType must be either INTERNAL or EXTERNAL',
  })
  @IsNotEmpty()
  stockType: 'INTERNAL' | 'EXTERNAL';
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

  @ApiPropertyOptional({ description: 'Tech Category ID from TECH_CATEGORY table', example: 1 })
  @IsInt()
  @IsOptional()
  techCategoryId?: number;

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
      'ประเภทขั้นตอนการจัดหา/ดำเนินการ (Step Master): SELF_REPAIR, WITH_PARTS, OUTSOURCE, UNREPAIRABLE',
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

  @ApiPropertyOptional({ description: 'Reason equipment is unrepairable (required for UNREPAIRABLE)' })
  @IsString()
  @IsOptional()
  unrepairableReason?: string;

  @ApiPropertyOptional({
    description: 'List of spare parts required (for WITH_PARTS with mixed internal/external requisition)',
    type: [SparePartRequisitionItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SparePartRequisitionItemDto)
  @IsOptional()
  spareParts?: SparePartRequisitionItemDto[];
}
