import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreateSectionDto {
  @ApiProperty({ example: 'IT-01', description: 'รหัสแผนก/ฝ่าย' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string;

  @ApiProperty({ example: 'Information Technology', description: 'ชื่อแผนก/ฝ่าย' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: '1130', description: 'เบอร์โทรศัพท์ติดต่อ' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  tel?: string;

  @ApiPropertyOptional({ example: 'Main Building', description: 'สถานที่ตั้ง/อาคาร' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  building?: string;
}
