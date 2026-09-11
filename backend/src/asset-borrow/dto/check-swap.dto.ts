import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class CheckSwapDto {
  @ApiProperty({
    description: 'UUID of the asset selected by the borrower to check for better alternatives',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsNotEmpty()
  @IsUUID()
  assetId: string;
}
