import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateTechCategoryDto {
  @ApiProperty({ description: 'Category code', example: 'MED_EQ' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ description: 'Category name', example: 'งานเครื่องมือแพทย์' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Active status', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
