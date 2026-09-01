import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ReportType, UrgencyStatus } from '@prisma/client';

export class CreateRepairRequestDto {
  @ApiProperty({ description: 'Asset UUID to request repair for' })
  @IsUUID()
  @IsNotEmpty()
  assetId: string;

  @ApiProperty({ description: 'Symptom or problem description' })
  @IsString()
  @IsNotEmpty()
  symptom: string;

  @ApiProperty({ enum: UrgencyStatus, default: UrgencyStatus.NORMAL })
  @IsEnum(UrgencyStatus)
  @IsNotEmpty()
  urgencyStatus: UrgencyStatus;

  @ApiProperty({ enum: ReportType, default: ReportType.Repair })
  @IsEnum(ReportType)
  @IsNotEmpty()
  reportType: ReportType;
}
