import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CancelRepairJobDto {
  @ApiProperty({
    description: 'Reason for cancelling the repair job ticket',
    example: 'เครื่องไม่ได้เสียจริง (User Error) / แจ้งผิดเครื่อง',
  })
  @IsNotEmpty()
  @IsString()
  reason: string;
}
