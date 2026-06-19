import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateAssetTypeDto {
  @ApiProperty({ example: 'Computer', description: 'Name of the asset type' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 5, description: 'Useful life of the asset type in years' })
  @IsNotEmpty()
  @IsNumber()
  useful_life: number;
}
