import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { UserRole } from '@prisma/client';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export class QueryUserDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: UserRole,
    description: 'Filter users by role (e.g. MAINTENANCE_STAFF for mechanics)',
  })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @ApiPropertyOptional({
    description: 'Filter users by Section/Department UUID',
  })
  @IsUUID()
  @IsOptional()
  section_id?: string;

  @ApiPropertyOptional({
    description:
      'Filter accounts by ban state: true for banned, false for active',
    type: Boolean,
  })
  @Transform(({ value }) => {
    if (value === true || value === 'true' || value === '1') return true;
    if (value === false || value === 'false' || value === '0') return false;
    return value;
  })
  @IsBoolean()
  @IsOptional()
  readonly banned?: boolean;
}
