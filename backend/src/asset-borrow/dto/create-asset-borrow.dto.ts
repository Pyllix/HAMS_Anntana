import { IsUUID, IsOptional, IsEnum } from 'class-validator';
import { DeliveryMethod } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAssetBorrowDto {
  @ApiProperty({ description: 'The UUID of the asset to borrow' })
  @IsUUID()
  assetId: string;

  @ApiPropertyOptional({ description: 'The UUID of the user borrowing the asset (required if staff-assisted)' })
  @IsOptional()
  @IsUUID()
  borrowerId?: string;

  @ApiProperty({ enum: DeliveryMethod, description: 'How the asset will be received (Pickup or Delivery)' })
  @IsEnum(DeliveryMethod)
  deliveryMethod: DeliveryMethod;
}

