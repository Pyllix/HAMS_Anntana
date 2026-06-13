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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  // ─── Create ────────────────────────────────────────────────────────────────

  // 🔴 Temporarily public to allow creating the first Admin user
  @Post()
  @ApiOperation({
    summary: 'Create new User',
    description: 'Create a new user via better-auth (automatic password hashing) — Admin only',
  })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  // ─── Read All ──────────────────────────────────────────────────────────────

  @Get()
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Get all Users',
    description: 'Retrieve all active users (excludes soft-deleted)',
  })
  @ApiResponse({ status: 200, description: 'List of users' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll() {
    return this.usersService.findAll();
  }

  // ─── Read One ──────────────────────────────────────────────────────────────

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get User by ID' })
  @ApiParam({ name: 'id', description: 'User ID (CUID/UUID)' })
  @ApiResponse({ status: 200, description: 'User data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  // ─── Update ────────────────────────────────────────────────────────────────

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Update User',
    description: 'Update user data excluding email and password (use better-auth for those)',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  // ─── Soft Delete ───────────────────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Soft Delete User',
    description: 'Soft delete user (sets deletedAt to now) — actual record is not removed',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User deleted successfully (soft delete)' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  // ─── Restore ───────────────────────────────────────────────────────────────

  @Patch(':id/restore')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
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
