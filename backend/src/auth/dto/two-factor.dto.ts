import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length, Matches, IsBoolean, IsOptional } from 'class-validator';

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

export class EnableTwoFactorDto {
  @ApiProperty({ description: 'Current password', example: 'Password@1234' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class ReplaceAuthenticatorDto {
  @ApiProperty({ description: 'Current account password' })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({ description: 'Current six-digit TOTP code', example: '123456' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  currentTotpCode: string;
}

export class VerifyTotpCodeDto {
  @ApiProperty({ description: 'Current six-digit TOTP code', example: '123456' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code: string;
}

export class AcknowledgeRecoveryCodesDto {
  @ApiProperty({ description: 'The user saved the displayed recovery codes', example: true })
  @IsBoolean()
  acknowledged: boolean;
}

export class VerifyChallengeCodeDto {
  @ApiProperty({
    description: '6-digit authenticator code or 8-character recovery code',
    example: '123456',
  })
  @IsString()
  @Matches(/^(?:\d{6}|[A-F0-9]{8})$/i)
  code: string;

  @ApiProperty({
    description: 'Whether to trust this browser after successful verification',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  trustBrowser?: boolean;
}
