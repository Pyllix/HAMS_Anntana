import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'jdoe', description: 'Unique username' })
  @IsString()
  userName: string;

  @ApiProperty({ example: 'John', description: 'First name' })
  @IsString()
  firstname: string;

  @ApiProperty({ example: 'Doe', description: 'Last name' })
  @IsString()
  lastname: string;

  @ApiProperty({ example: 'john.doe@hospital.go.th', description: 'Unique email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'P@ssword123', description: 'Password (minimum 8 characters)', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({
    enum: UserRole,
    enumName: 'UserRole',
    default: UserRole.DEPARTMENT_STAFF,
    description: 'User role',
  })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole = UserRole.DEPARTMENT_STAFF;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.png', description: 'Profile image URL' })
  @IsUrl()
  @IsOptional()
  imageUrl?: string;
}
