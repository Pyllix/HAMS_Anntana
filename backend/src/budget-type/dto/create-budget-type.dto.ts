import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateBudgetTypeDto {
  @ApiProperty({ description: 'Name of the budget type', example: 'เงินงบประมาณแผ่นดิน ปี 2567' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Fiscal year in Buddhist calendar (e.g. 2567)', example: 2567 })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  fiscalYear?: number;

  @ApiPropertyOptional({ description: 'Detailed description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Active status', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
