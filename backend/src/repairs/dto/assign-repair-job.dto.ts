import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
} from 'class-validator';

export class AssignRepairJobDto {
  @ApiProperty({
    description: 'Tech Category ID from TECH_CATEGORY table',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  techCategoryId: number;

  @ApiProperty({
    description: 'Array of mechanic user IDs assigned to this job (at least 1)',
    type: [String],
    example: ['aB12cD34eF56gH78iJ90kL12mN34oP56'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  mechanicIds: string[];
}
