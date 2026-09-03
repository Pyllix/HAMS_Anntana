import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
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
}

