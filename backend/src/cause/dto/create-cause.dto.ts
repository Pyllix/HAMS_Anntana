import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateCauseDto {
  @ApiProperty({ description: 'Cause code', example: '01' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ description: 'Cause description name', example: 'การเสื่อมสภาพตามอายุการใช้งาน' })
  @IsString()
  @IsNotEmpty()
  name: string;
}
