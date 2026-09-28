import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsString, IsOptional } from 'class-validator';

export class GrantTrustDto {
  @ApiProperty({
    description: 'Whether to trust this browser for 14 days',
    example: true,
  })
  @IsBoolean()
  trustBrowser: boolean;
}

export class RevokeTrustDto {
  @ApiProperty({
    description: 'Token of the trusted browser to revoke',
    example: 'abc123...',
  })
  @IsString()
  token: string;
}

export class VerifyTwoFactorDto {
  @ApiProperty({
    description: 'TOTP code (6 digits) or Recovery code (8 hex chars)',
    example: '123456',
  })
  @IsString()
  token: string;

  @ApiProperty({
    description:
      'Whether to trust this browser for 14 days after successful verification',
    example: false,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  trustBrowser?: boolean;
}
