import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateEquipmentTypeDto {
  @ApiProperty({ description: 'Name of the equipment type', example: 'เครื่องมือช่วยชีวิต' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Detailed description' })
  @IsString()
  @IsOptional()
  description?: string;
}
