import {
  IsUUID,
  IsOptional,
  IsEnum,
  IsString,
  IsDateString,
} from 'class-validator';
import { DeliveryMethod } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAssetBorrowDto {
  @ApiProperty({ description: 'The UUID of the asset to borrow' })
  @IsUUID()
  assetId: string;

  @ApiPropertyOptional({
    description:
      'The UUID or Employee Code (รหัสพนักงาน) of the user borrowing the asset (required if staff-assisted)',
  })
  @IsOptional()
  @IsString()
  borrowerId?: string;

  @ApiProperty({
    enum: DeliveryMethod,
    description: 'How the asset will be received (Pickup or Delivery)',
  })
  @IsEnum(DeliveryMethod)
  deliveryMethod: DeliveryMethod;

  @ApiPropertyOptional({
    description:
      'Expected return date/time (ISO 8601). A date without a time means the end of that day in Asia/Bangkok.',
    example: '2026-09-30T23:59:59.999+07:00',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  expectedReturnDate?: string;
}
