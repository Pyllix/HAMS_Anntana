import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsPositive } from 'class-validator';

export class ReturnRepairSparePartDto {
  @ApiProperty({ description: 'Spare part ID to return back to inventory', example: 1 })
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  sparepartId: number;

  @ApiProperty({ description: 'Quantity of unused parts to return back into stock', example: 1 })
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  qty: number;
}
