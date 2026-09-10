import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, IsNotEmpty, IsUUID } from 'class-validator';

export class AssignRepairJobDto {
  @ApiProperty({ description: 'Tech Category ID from TECH_CATEGORY table', example: 1 })
  @IsInt()
  @IsNotEmpty()
  techCategoryId: number;

  @ApiProperty({
    description: 'Array of mechanic user UUIDs assigned to this job (at least 1)',
    type: [String],
    example: ['uuid-1', 'uuid-2'],
  })
  @IsArray()
  @IsUUID('all', { each: true })
  @IsNotEmpty()
  mechanicIds: string[];
}
