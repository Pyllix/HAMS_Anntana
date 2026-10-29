import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import { EMPLOYEE_PHOTO_PUBLIC_ID_PATTERN } from '../image-identities';
import {
  EMPLOYEE_PHOTO_EXPIRY_PATTERN,
  EMPLOYEE_PHOTO_SIGNATURE_PATTERN,
  EMPLOYEE_PHOTO_VERSION_PATH_PATTERN,
} from '../employee-photo-read-grant';

export class EmployeePhotoImageReadParamsDto {
  @ApiProperty({
    example: 'hams-employee-photo-8ec777e7-357b-4f1b-bc6b-343eeaa76903',
  })
  @IsString()
  @Matches(EMPLOYEE_PHOTO_PUBLIC_ID_PATTERN)
  readonly publicId!: string;

  @ApiProperty({ example: 'v1.jpg' })
  @IsString()
  @Matches(EMPLOYEE_PHOTO_VERSION_PATH_PATTERN)
  readonly version!: string;
}

export class EmployeePhotoImageReadQueryDto {
  @ApiProperty({ example: '1792281900' })
  @IsString()
  @Matches(EMPLOYEE_PHOTO_EXPIRY_PATTERN)
  readonly expiresAt!: string;

  @ApiProperty({
    description: 'Base64url HMAC read grant signature',
    example: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  })
  @IsString()
  @Matches(EMPLOYEE_PHOTO_SIGNATURE_PATTERN)
  readonly signature!: string;
}
