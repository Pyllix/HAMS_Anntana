import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
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
}
