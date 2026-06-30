import { IsUUID, IsOptional, IsEnum, IsString } from 'class-validator';
import { ReturnMethod } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAssetBorrowDto {
  @ApiProperty({ description: 'The UUID of the asset to borrow' })
  @IsUUID()
  assetId: string;

  @ApiPropertyOptional({ description: 'The UUID of the user borrowing the asset (required if staff-assisted)' })
  @IsOptional()
  @IsUUID()
  borrowerId?: string;

  @ApiProperty({ enum: ReturnMethod, description: 'How the asset will be received' })
  @IsEnum(ReturnMethod)
  returnMethod: ReturnMethod;
}
