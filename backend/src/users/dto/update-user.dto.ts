import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

// Allow updating all fields except password (Admin can update email)
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password'] as const),
) {
  @ApiPropertyOptional({
    description:
      'Disable or re-enable the account; disabling revokes all sessions',
  })
  @IsOptional()
  @IsBoolean()
  banned?: boolean;
}
