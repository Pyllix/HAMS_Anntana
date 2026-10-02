import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import {
  ApiCookieAuth,
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
import { AdminResetTwoFactorDto } from './dto/admin-reset-two-factor.dto';
import { auth } from '../auth/auth';
import { ImageReadService } from '../images/image-read.service';

@ApiTags('Users')
@ApiCookieAuth()
@UseGuards(AuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly imageReadService: ImageReadService,
  ) {}

  private requireAdminSession(session: UserSession<typeof auth> | null): {
    userId: string;
    sessionId: string;
  } {
    const userId = session?.user?.id;
    const sessionId = session?.session?.id;
    if (!userId || !sessionId) {
      throw new UnauthorizedException('No active session');
    }
    if (session.user.role !== 'ADMIN') {
      throw new ForbiddenException('ADMIN role required');
    }
    return { userId, sessionId };
  }

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
  create(
    @Body() createUserDto: CreateUserDto,
    @Session() session: UserSession<typeof auth> | null,
  ) {
    const { userId } = this.requireAdminSession(session);
    return this.usersService.create(createUserDto, userId);
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
  @ApiQuery({
    name: 'role',
    required: false,
    enum: UserRole,
    description: 'Filter by role (e.g. MAINTENANCE_STAFF)',
  })
  @ApiQuery({
    name: 'section_id',
    required: false,
    type: String,
    description: 'Filter by Section/Department UUID',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of users' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(@Query() query: QueryUserDto) {
    return this.usersService.findAll(query);
  }

  // ─── Read One ──────────────────────────────────────────────────────────────

  @Get(':id/photo')
  @ApiOperation({
    summary: 'Get a short-lived read grant for an Employee Photo',
    description:
      'Any authenticated user may request the current photo by user ID or employee code. The response contains a short-lived provider-enforced URL and is never cacheable.',
  })
  @ApiParam({
    name: 'id',
    description: 'User ID (CUID/UUID) or Employee Code',
  })
  @ApiResponse({
    status: 200,
    description: 'Current photo grant, or explicit no-photo result',
  })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 503, description: 'Photo provider is unavailable' })
  getPhoto(@Param('id') id: string) {
    return this.imageReadService.readEmployeePhoto(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get User by ID' })
  @ApiParam({
    name: 'id',
    description: 'User ID (CUID/UUID) or Employee Code (รหัสพนักงาน)',
  })
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
      'Update user profile, role, or account status. Role and status changes revoke all sessions and trusted browsers; profile-only changes do not.',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({
    status: 409,
    description: 'Email/username already in use or last active enrolled ADMIN',
  })
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Session() session: UserSession<typeof auth> | null,
  ) {
    const { userId } = this.requireAdminSession(session);
    return this.usersService.update(id, updateUserDto, userId);
  }

  // ─── Admin Reset Password ──────────────────────────────────────────────────

  @Patch(':id/reset-password')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Admin Reset Password',
    description:
      'Requires a current five-minute, session-bound ADMIN Step-up even on a trusted browser. Resets the password and revokes all target sessions and trusted browsers.',
  })
  @ApiParam({ name: 'id', description: 'User ID or Employee Code' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'ADMIN Step-up is required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  adminResetPassword(
    @Param('id') id: string,
    @Body() dto: AdminResetPasswordDto,
    @Session() session: UserSession<typeof auth> | null,
  ) {
    const admin = this.requireAdminSession(session);
    return this.usersService.adminResetPassword(
      id,
      dto.newPassword,
      admin.userId,
      admin.sessionId,
    );
  }

  @Post(':id/reset-2fa')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Assisted 2FA reset',
    description:
      'Another ADMIN must have a current five-minute Step-up and attest that the account owner was identified outside HAMS. The target role must require 2FA enrollment.',
  })
  @ApiParam({ name: 'id', description: 'User ID or Employee Code' })
  @ApiResponse({ status: 200, description: '2FA reset and notification sent' })
  @ApiResponse({
    status: 400,
    description: 'Invalid reset request or self-reset',
  })
  @ApiResponse({ status: 403, description: 'ADMIN Step-up is required' })
  @ApiResponse({
    status: 409,
    description:
      '2FA is not enrolled, the role does not require it, or this is the last active enrolled ADMIN',
  })
  async adminResetTwoFactor(
    @Param('id') id: string,
    @Body() dto: AdminResetTwoFactorDto,
    @Session() session: UserSession<typeof auth> | null,
  ) {
    const admin = this.requireAdminSession(session);
    return this.usersService.adminResetTwoFactor(
      id,
      dto,
      admin.userId,
      admin.sessionId,
    );
  }

  // ─── Soft Delete ───────────────────────────────────────────────────────────

  @Delete(':id')
  @Roles(UserRole.ADMIN)
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
  @ApiResponse({
    status: 409,
    description: 'The last active enrolled ADMIN cannot be deleted',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  remove(
    @Param('id') id: string,
    @Session() session: UserSession<typeof auth> | null,
  ) {
    const { userId } = this.requireAdminSession(session);
    return this.usersService.remove(id, userId);
  }

  // ─── Restore ───────────────────────────────────────────────────────────────

  @Patch(':id/restore')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Restore a soft-deleted User',
    description: 'Restore a soft-deleted user back to active status',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User restored successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Deleted user not found' })
  restore(
    @Param('id') id: string,
    @Session() session: UserSession<typeof auth> | null,
  ) {
    const { userId } = this.requireAdminSession(session);
    return this.usersService.restore(id, userId);
  }
}
