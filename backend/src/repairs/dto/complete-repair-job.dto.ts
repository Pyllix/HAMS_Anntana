import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CompleteRepairJobDto {
  @ApiProperty({ description: 'Warranty end date (e.g. 2027-12-31)' })
  @IsString()
  @IsNotEmpty()
  warrantyDate: string;

  @ApiProperty({ description: 'User ID of the receiver who took the asset back' })
  @IsUUID()
  @IsNotEmpty()
  receiverId: string;

  @ApiPropertyOptional({ description: 'Return handover date (ISO string), defaults to now if omitted' })
  @IsDateString()
  @IsOptional()
  returnDate?: string;
}
