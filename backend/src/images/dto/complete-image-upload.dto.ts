import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsObject,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class CompleteImageUploadDto {
  @ApiPropertyOptional({
    description:
      'Temporary compatibility fields for the original Cloudinary client',
    maxLength: 255,
  })
  @ValidateIf((dto: CompleteImageUploadDto) => dto.proof === undefined)
  @IsString()
  @MaxLength(255)
  readonly publicId?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @ValidateIf((dto: CompleteImageUploadDto) => dto.proof === undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  readonly version?: number;

  @ApiPropertyOptional({ pattern: '^[a-fA-F0-9]{40}$' })
  @ValidateIf((dto: CompleteImageUploadDto) => dto.proof === undefined)
  @IsString()
  @Matches(/^[a-f\d]{40}$/i)
  readonly signature?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Opaque provider proof returned by the upload transport',
  })
  @ValidateIf((dto: CompleteImageUploadDto) => dto.proof !== undefined)
  @IsObject()
  readonly proof?: Readonly<Record<string, unknown>>;
}
