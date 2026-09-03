import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RejectRepairStepDto {
  @ApiProperty({
    description: 'Reason for rejecting this step / proposal',
    example: 'งบประมาณเกินกำหนด / แนะนำให้เปลี่ยนวิธีการซ่อมหรือจัดซื้อทดแทน',
  })
  @IsNotEmpty()
  @IsString()
  reason: string;
}
