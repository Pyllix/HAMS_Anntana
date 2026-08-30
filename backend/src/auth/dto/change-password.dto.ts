import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    example: 'OldP@ssword123',
    description: 'Current password for verification',
  })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({
    example: 'NewP@ssword456',
    description: 'New password (minimum 8 characters)',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
