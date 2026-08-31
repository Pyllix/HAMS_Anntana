import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateSparePartGroupDto {
  @ApiProperty({ example: 'อะไหล่ระบบไฟฟ้า', description: 'ชื่อกลุ่ม/หมวดหมู่อะไหล่' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;
}
