import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ReturnCondition, ReturnMethod } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReturnAssetBorrowDto {
  @ApiProperty({ enum: ReturnCondition, description: 'The condition of the asset when returned' })
  @IsEnum(ReturnCondition)
  returnCondition: ReturnCondition;

  @ApiProperty({ enum: ReturnMethod, description: 'How the asset was returned' })
  @IsEnum(ReturnMethod)
  returnMethod: ReturnMethod;

  @ApiPropertyOptional({ description: 'Any remarks regarding the return' })
  @IsOptional()
  @IsString()
  returnRemark?: string;

  @ApiPropertyOptional({ description: 'UUID of the user who returned the asset (used when AC staff processes return)' })
  @IsOptional()
  @IsString() // Use IsString or IsUUID if IsUUID is imported
  returnedByUserId?: string;
}
