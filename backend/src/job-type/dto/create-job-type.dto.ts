import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateJobTypeDto {
  @ApiProperty({ description: 'Job type name', example: 'ตรวจเช็คและซ่อมทั่วไป' })
  @IsString()
  @IsNotEmpty()
  name: string;
}
