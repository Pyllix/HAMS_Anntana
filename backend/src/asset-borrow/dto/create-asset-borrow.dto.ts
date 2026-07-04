import { IsUUID, IsOptional, IsEnum, IsString } from 'class-validator';
import { RequestSource, DeliveryMethod } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAssetBorrowDto {
  @ApiProperty({ description: 'The UUID of the asset to borrow' })
  @IsUUID()
  assetId: string;

  @ApiPropertyOptional({ description: 'The UUID of the user borrowing the asset (required if staff-assisted)' })
  @IsOptional()
  @IsUUID()
  borrowerId?: string;

  @ApiPropertyOptional({ enum: RequestSource, description: 'Source of the request (Self service or Center service)' })
  @IsOptional()
  @IsEnum(RequestSource)
  requestSource?: RequestSource;

  @ApiProperty({ enum: DeliveryMethod, description: 'How the asset will be received (Pickup or Delivery)' })
  @IsEnum(DeliveryMethod)
  deliveryMethod: DeliveryMethod;
}
