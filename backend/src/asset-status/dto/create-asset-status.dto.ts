import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateAssetStatusDto {
  @ApiProperty({ example: 'NORMAL', description: 'Code of the asset status' })
  @IsNotEmpty()
  @IsString()
  code: string;

  @ApiProperty({ example: 'ใช้งานปกติ', description: 'Name of the asset status' })
  @IsNotEmpty()
  @IsString()
  name: string;
}
