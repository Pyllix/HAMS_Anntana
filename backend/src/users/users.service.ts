import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { auth } from '../auth/auth';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { paginate, PaginatedResult } from 'src/common/utils/paginate.util';
import { Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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

  // ─── Read All (paginated) ───────────────────────────────────────────────────

  /** Retrieve all active users (not soft-deleted), with optional pagination and search */
  async findAll(
    query: PaginationDto,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
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

  /** Retrieve a user by ID (excludes soft-deleted users) */
  async findOne(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      omit: { deletedAt: true },
    });

    if (!user) {
      throw new NotFoundException(`User not found with ID: ${id}`);
    }

    return user;
  }

  // ─── Update ───────────────────────────────────────────────────────────────────

  /** Update user data (excluding email and password - use better-auth for those) */
  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id); // throws NotFoundException if not found

    return this.prisma.user.update({
      where: { id },
      data: dto,
      omit: { deletedAt: true },
    });
  }

  // ─── Soft Delete ──────────────────────────────────────────────────────────────

  /** Soft delete: sets deletedAt instead of actual deletion */
  async remove(id: string) {
    await this.findOne(id); // throws NotFoundException if not found or already deleted

    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: `User ID: ${id} successfully deleted` };
  }

  // ─── Restore ──────────────────────────────────────────────────────────────────

  /** Restore a soft-deleted user */
  async restore(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: { not: null } },
    });

    if (!user) {
      throw new NotFoundException(
        `Deleted user not found with ID: ${id} (may not exist or not deleted)`,
      );
    }

    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: null },
      omit: { deletedAt: true },
    });
  }
}
