import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { UsersService } from './users.service';

import { UserRole } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';

import { AdminResetPasswordDto } from './dto/admin-reset-password.dto';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  // ─── Create ────────────────────────────────────────────────────────────────

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Create new User',
    description:
      'Create a new user via better-auth (automatic password hashing) — Admin only',
  })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  // ─── Read All (paginated & role filter) ──────────────────────────────────────

  @Get()
  @ApiOperation({
    summary: 'Get all Users (paginated with optional role filter)',
    description:
      'Retrieve active users with pagination, optional role filter (e.g. MAINTENANCE_STAFF for mechanics), and optional search by name or email',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'role', required: false, enum: UserRole, description: 'Filter by role (e.g. MAINTENANCE_STAFF)' })
  @ApiQuery({ name: 'section_id', required: false, type: String, description: 'Filter by Section/Department UUID' })
  @ApiResponse({ status: 200, description: 'Paginated list of users' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(@Query() query: QueryUserDto) {
    return this.usersService.findAll(query);
  }

  // ─── Read One ──────────────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get User by ID' })
  @ApiParam({ name: 'id', description: 'User ID (CUID/UUID) or Employee Code (รหัสพนักงาน)' })
  @ApiResponse({ status: 200, description: 'User data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  // ─── Update ────────────────────────────────────────────────────────────────

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update User Profile / Email (Admin only)',
    description:
      'Update user data including corporate email (excluding password) — Admin only',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  // ─── Admin Reset Password ──────────────────────────────────────────────────

  @Patch(':id/reset-password')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Admin Reset Password',
    description:
      'Admin sets a new password for a user without needing old password — revokes all user sessions',
  })
  @ApiParam({ name: 'id', description: 'User ID or Employee Code' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  adminResetPassword(
    @Param('id') id: string,
    @Body() dto: AdminResetPasswordDto,
    @Req() req: Request,
  ) {
    return this.usersService.adminResetPassword(id, dto.newPassword, req);
  }

  // ─── Soft Delete ───────────────────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Soft Delete User',
    description:
      'Soft delete user (sets deletedAt to now) — actual record is not removed',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'User deleted successfully (soft delete)',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  // ─── Restore ───────────────────────────────────────────────────────────────

  @Patch(':id/restore')
  @ApiOperation({
    summary: 'Restore a soft-deleted User',
    description: 'Restore a soft-deleted user back to active status',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User restored successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Deleted user not found' })
  restore(@Param('id') id: string) {
    return this.usersService.restore(id);
  }
}
