import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CancelBorrowDto {
  @ApiProperty({ description: 'Reason for cancellation', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cancelReason?: string;
}
