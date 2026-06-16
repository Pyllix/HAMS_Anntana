import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreateSectionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  tel?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  building?: string;
}
