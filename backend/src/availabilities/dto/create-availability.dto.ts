import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateAvailabilityDto {
  @ApiProperty({ example: 'AVAILIABLE', description: 'Code of the availability status' })
  @IsNotEmpty()
  @IsString()
  code: string;

  @ApiProperty({ example: 'ว่าง', description: 'Name of the availability status' })
  @IsNotEmpty()
  @IsString()
  name: string;
}
