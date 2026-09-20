import { IsIn, IsOptional, IsString, ValidateIf, IsNotEmpty } from 'class-validator';
import { BorrowExtensionStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReviewBorrowExtensionDto {
  @ApiProperty({
    enum: [BorrowExtensionStatus.APPROVED, BorrowExtensionStatus.REJECTED],
    description: 'Review decision: APPROVED or REJECTED',
    example: BorrowExtensionStatus.APPROVED,
  })
  @IsIn([BorrowExtensionStatus.APPROVED, BorrowExtensionStatus.REJECTED], {
    message: 'สถานะการพิจารณาต้องเป็น APPROVED หรือ REJECTED เท่านั้น',
  })
  status: BorrowExtensionStatus;

  @ApiPropertyOptional({
    description: 'Reason for rejection (required if status is REJECTED)',
    example: 'มีคิวจองใช้งานจากหน่วยงานอื่นรออยู่',
  })
  @ValidateIf((o) => o.status === BorrowExtensionStatus.REJECTED)
  @IsNotEmpty({ message: 'กรุณาระบุเหตุผลการปฏิเสธคำขอต่อเวลา' })
  @IsString()
  rejectReason?: string;
}

