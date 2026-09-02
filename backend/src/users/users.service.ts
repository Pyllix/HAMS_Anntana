import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { auth } from '../auth/auth';
import { PaginatedResult, paginate } from 'src/common/utils/paginate.util';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) { }

  // ─── Create ──────────────────────────────────────────────────────────────────

  /** Create a new user via better-auth (automatic password hashing) */
  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException(`Email ${dto.email} is already in use`);
    }

    // Use better-auth to hash password and create user + account record
    const result = await auth.api.signUpEmail({
      body: {
        name: `${dto.firstname} ${dto.lastname}`,
        email: dto.email,
        password: dto.password,
      },
    });

    if (!result?.user?.id) {
      throw new ConflictException('Failed to create user');
    }

    // Update additional fields not directly supported by better-auth
    const user = await this.prisma.user.update({
      where: { id: result.user.id },
      data: {
        employeeId: dto.employeeId,
        userName: dto.userName,
        firstname: dto.firstname,
        lastname: dto.lastname,
        role: dto.role ?? 'DEPARTMENT_STAFF',
        imageUrl: dto.imageUrl,
        section_id: dto.sectionId,
      },
      omit: { deletedAt: true },
    });

    return user;
  }

  // ─── Read All (paginated & role filter) ───────────────────────────────────────

  /** Retrieve all active users (not soft-deleted), with optional pagination, role filter, and search */
  async findAll(
    query: QueryUserDto,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(query.role ? { role: query.role } : {}),
      ...(query.section_id ? { section_id: query.section_id } : {}),
      ...(query.search
        ? {
          OR: [
            { employeeId: { contains: query.search, mode: 'insensitive' } },
            { userName: { contains: query.search, mode: 'insensitive' } },
            { firstname: { contains: query.search, mode: 'insensitive' } },
            { lastname: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
          ],
        }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        omit: { deletedAt: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return paginate(data as Record<string, unknown>[], total, page, limit);
  }

  // ─── Read One ─────────────────────────────────────────────────────────────────

  /** Retrieve a user by ID or Employee Code (excludes soft-deleted users) */
  async findOne(idOrEmployeeId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { id: idOrEmployeeId },
          { employeeId: idOrEmployeeId },
        ],
      },
      omit: { deletedAt: true },
    });

    if (!user) {
      throw new NotFoundException(
        `User not found with ID or Employee Code: ${idOrEmployeeId}`,
      );
    }

    return user;
  }

  // ─── Update ───────────────────────────────────────────────────────────────────

  /** Update user data (Admin only for email, password changed via dedicated endpoints) */
  async update(idOrEmployeeId: string, dto: UpdateUserDto) {
    const user = await this.findOne(idOrEmployeeId); // throws NotFoundException if not found

    const { sectionId, email, ...rest } = dto;

    if (email && email !== user.email) {
      const emailExists = await this.prisma.user.findFirst({
        where: {
          email,
          id: { not: user.id },
        },
      });

      if (emailExists) {
        throw new ConflictException(`Email ${email} is already in use`);
      }
    }

    return this.prisma.user.update({
      where: { id: user.id },
      data: {
        ...rest,
        ...(email !== undefined && { email }),
        ...(sectionId !== undefined && { section_id: sectionId }),
      },
      omit: { deletedAt: true },
    });
  }

  // ─── Admin Reset Password ──────────────────────────────────────────────────

  /** Admin resets/sets a user's password and revokes all active sessions */
  async adminResetPassword(
    idOrEmployeeId: string,
    newPassword: string,
    req?: Request,
  ) {
    const user = await this.findOne(idOrEmployeeId);

    // Forward headers so better-auth admin plugin can verify admin session
    const headers = new Headers();
    if (req?.headers) {
      for (const [key, value] of Object.entries(req.headers)) {
        if (value)
          headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      }
    }

    // Use better-auth admin API to update the user password
    await auth.api.setUserPassword({
      headers,
      body: {
        userId: user.id,
        newPassword,
      },
    });

    // Revoke all existing sessions for this user for security
    await this.prisma.session.deleteMany({
      where: { userId: user.id },
    });

    return {
      message: `Password for user ${user.userName || user.email} has been successfully reset`,
    };
  }

  // ─── Soft Delete ──────────────────────────────────────────────────────────────

  /** Soft delete: sets deletedAt instead of actual deletion */
  async remove(idOrEmployeeId: string) {
    const user = await this.findOne(idOrEmployeeId); // throws NotFoundException if not found or already deleted

    await this.prisma.user.update({
      where: { id: user.id },
      data: { deletedAt: new Date() },
    });

    return { message: `User ID: ${user.id} successfully deleted` };
  }

  // ─── Restore ──────────────────────────────────────────────────────────────────

  /** Restore a soft-deleted user */
  async restore(idOrEmployeeId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        deletedAt: { not: null },
        OR: [
          { id: idOrEmployeeId },
          { employeeId: idOrEmployeeId },
        ],
      },
    });

    if (!user) {
      throw new NotFoundException(
        `Deleted user not found with ID or Employee Code: ${idOrEmployeeId} (may not exist or not deleted)`,
      );
    }

    return this.prisma.user.update({
      where: { id: user.id },
      data: { deletedAt: null },
      omit: { deletedAt: true },
    });
  }
}
