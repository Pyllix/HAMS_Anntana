import { ApiProperty } from '@nestjs/swagger';
import {
  Equals,
  IsBoolean,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class AdminResetTwoFactorDto {
  @ApiProperty({
    description:
      'Reason for the assisted 2FA reset; do not include secrets or sensitive identity data',
    minLength: 10,
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(500)
  reason: string;

  @ApiProperty({
    description:
      'Confirm that the account owner was identified outside HAMS',
    example: true,
  })
  @IsBoolean()
  @Equals(true)
  identityVerifiedOutsideHams: boolean;
}
