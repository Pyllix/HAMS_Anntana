import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SendVerificationEmailDto {
  @ApiProperty({
    description: 'อีเมลของผู้ใช้งานที่ต้องการรับลิงก์ยืนยันตัวตน',
    example: 'user@hospital.go.th',
  })
  @IsEmail({}, { message: 'รูปแบบอีเมลไม่ถูกต้อง' })
  @IsNotEmpty({ message: 'กรุณากรอกอีเมล' })
  email: string;

  @ApiPropertyOptional({
    description: 'Callback URL สำหรับ redirect ไปยังหน้า Frontend หลังยืนยันสำเร็จ',
    example: 'http://localhost:5173/login?verified=true',
  })
  @IsString()
  @IsOptional()
  callbackURL?: string;
}