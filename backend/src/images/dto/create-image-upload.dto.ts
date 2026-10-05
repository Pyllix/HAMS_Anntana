import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ACCEPTED_SOURCE_MIME_TYPES } from '../image-upload-policy';

export class CreateImageUploadDto {
  @ApiProperty({ enum: ['ASSET_IMAGE', 'EMPLOYEE_PHOTO'] })
  @IsIn(['ASSET_IMAGE', 'EMPLOYEE_PHOTO'])
  readonly purpose!: 'ASSET_IMAGE' | 'EMPLOYEE_PHOTO';

  @ApiProperty({ enum: ACCEPTED_SOURCE_MIME_TYPES })
  @IsIn(ACCEPTED_SOURCE_MIME_TYPES)
  readonly sourceContentType!: (typeof ACCEPTED_SOURCE_MIME_TYPES)[number];

  @ApiProperty({ minimum: 1, maximum: 10_000_000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000_000)
  readonly sourceSizeBytes!: number;

  @ApiPropertyOptional({
    description:
      'Canonical existing Asset ID or User ID; omit for create forms.',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  readonly targetId?: string;
}
