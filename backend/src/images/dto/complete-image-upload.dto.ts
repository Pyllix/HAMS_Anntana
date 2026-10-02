import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsString, Matches, MaxLength, Min } from 'class-validator';

export class CompleteImageUploadDto {
  @ApiProperty({ maxLength: 255 })
  @IsString()
  @MaxLength(255)
  readonly publicId!: string;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  readonly version!: number;

  @ApiProperty({ pattern: '^[a-fA-F0-9]{40}$' })
  @IsString()
  @Matches(/^[a-f\d]{40}$/i)
  readonly signature!: string;
}
