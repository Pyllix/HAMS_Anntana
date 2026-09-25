import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';

export class GenerateSecretDto {
  // No fields needed - userId comes from session
}

export class VerifyEnrollmentDto {
  @ApiProperty({
    description: 'The TOTP secret (temporary, from generate step)',
    example: 'JBSWY3DPEHPK3PXP',
  })
  @IsString()
  @IsNotEmpty()
  secret: string;

  @ApiProperty({
    description: '6-digit TOTP code from authenticator app',
    example: '123456',
  })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'Token must be 6 digits' })
  token: string;
}

export class ConfirmBackupCodesDto {
  @ApiProperty({
    description: 'Confirmation that backup codes have been saved',
    example: true,
  })
  confirmed: boolean;
}

export class VerifyTwoFactorDto {
  @ApiProperty({
    description: '6-digit TOTP code from authenticator app',
    example: '123456',
  })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'Token must be 6 digits' })
  token: string;
}
