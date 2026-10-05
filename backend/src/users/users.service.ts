import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { auth } from '../auth/auth';
import { PaginatedResult, paginate } from 'src/common/utils/paginate.util';
import { Prisma, UserRole } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';
import { AdminStepUpService } from '../auth/admin-step-up.service';
import { TwoFactorService } from '../auth/two-factor.service';
import { mailService } from '../common/mail/mail.service';
import { AdminResetTwoFactorDto } from './dto/admin-reset-two-factor.dto';
import {
  ImageAttachmentService,
  imageClaimFingerprint,
  managedImageLocator,
  type ImageClaimRequest,
} from '../images/image-attachment.service';
import {
  ImageReadService,
  PRIVATE_USER_IMAGE_FIELDS,
} from '../images/image-read.service';

type SecurityAuditAction =
  | 'USER_CREATED'
  | 'USER_ROLE_CHANGED'
  | 'USER_DISABLED'
  | 'USER_ENABLED'
  | 'USER_SOFT_DELETED'
  | 'USER_RESTORED'
  | 'ADMIN_PASSWORD_RESET'
  | 'ADMIN_2FA_RESET';

interface SecurityAuditInput {
  actorUserId: string;
  targetUserId: string;
  action: SecurityAuditAction;
  reason?: string;
  details?: Prisma.InputJsonValue;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminStepUpService: AdminStepUpService,
    private readonly twoFactorService: TwoFactorService,
    private readonly imageAttachmentService: ImageAttachmentService,
    private readonly imageReadService: ImageReadService,
  ) {}

  // ─── Auto-generate Employee ID ───────────────────────────────────────────────

  /** Generate next employee ID formatted as GOV-YYNNNN (resets annually by Thai Buddhist year) */
  async generateEmployeeId(tx?: Prisma.TransactionClient): Promise<string> {
    const client = tx || this.prisma;
    const now = new Date();
    const thaiYear = String((now.getFullYear() + 543) % 100).padStart(2, '0');
    const prefix = `GOV-${thaiYear}`;

    const latest = await client.user.findFirst({
      where: { employeeId: { startsWith: prefix } },
      orderBy: { employeeId: 'desc' },
      select: { employeeId: true },
    });

    let nextSeq = 1;
    if (latest && latest.employeeId) {
      const seqStr = latest.employeeId.replace(prefix, '');
      const parsed = parseInt(seqStr, 10);
      if (!isNaN(parsed)) {
        nextSeq = parsed + 1;
      }
    }

    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  // ─── Create ──────────────────────────────────────────────────────────────────

  /** Create a new user via better-auth with pre-validation and compensating rollback */
  async create(dto: CreateUserDto, actorUserId: string) {
    this.imageAttachmentService.assertAttachmentPayload({
      purpose: 'EMPLOYEE_PHOTO',
      uploadId: dto.imageUploadId,
      creationContextToken: dto.imageCreationContextToken,
    });
    let imageClaimRequest: ImageClaimRequest | undefined;
    if (dto.imageUploadId) {
      imageClaimRequest = {
        actorUserId,
        purpose: 'EMPLOYEE_PHOTO',
        uploadId: dto.imageUploadId,
        operation: 'CREATE',
        targetId: 'pending-user-target',
        creationContextToken: dto.imageCreationContextToken,
        fingerprint: imageClaimFingerprint({
          actorUserId,
          purpose: 'EMPLOYEE_PHOTO',
          operation: 'CREATE',
          targetId: null,
          fields: dto,
        }),
      };
      const priorTargetId =
        await this.imageAttachmentService.committedTargetForRetry(
          imageClaimRequest,
        );
      if (priorTargetId) {
        const prior = await this.prisma.user.findFirst({
          where: { id: priorTargetId, deletedAt: null },
          omit: { deletedAt: true },
        });
        if (!prior) {
          throw new NotFoundException({
            code: 'IMAGE_TARGET_NOT_FOUND',
            message: 'The created account is no longer available',
          });
        }
        return this.imageReadService.projectUser(prior);
      }
      await this.imageAttachmentService.preflightClaim(imageClaimRequest);
    }
    // 1. Pre-validation: Email uniqueness
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingEmail) {
      throw new ConflictException(`Email ${dto.email} is already in use`);
    }

    // 2. Pre-validation: Username uniqueness
    if (dto.userName) {
      const existingUserName = await this.prisma.user.findFirst({
        where: { userName: dto.userName },
      });

      if (existingUserName) {
        throw new ConflictException(
          `Username ${dto.userName} is already in use`,
        );
      }
    }

    // 3. Pre-validation: Section existence (if provided)
    if (dto.sectionId) {
      const section = await this.prisma.section.findUnique({
        where: { id: dto.sectionId },
      });

      if (!section) {
        throw new BadRequestException(
          `Section not found with ID: ${dto.sectionId}`,
        );
      }
    }

    // 4. Auto-generate next sequential Employee ID
    const employeeId = await this.generateEmployeeId();

    // 5. Use better-auth to hash password and create user + account record
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

    // 6. Update additional fields with compensating rollback on failure
    try {
      const user = await this.prisma.$transaction(async (tx) => {
        let imageFields = {};
        if (imageClaimRequest) {
          await this.imageAttachmentService.lockTargetRow(
            tx,
            'EMPLOYEE_PHOTO',
            result.user.id,
          );
          const claim = await this.imageAttachmentService.claimInTransaction(
            tx,
            { ...imageClaimRequest, targetId: result.user.id },
            null,
          );
          if (claim.kind === 'REPLAY') {
            if (claim.targetId !== result.user.id) {
              throw new ConflictException({
                code: 'IMAGE_UPLOAD_ALREADY_CLAIMED',
                message:
                  'The upload has already been attached to another account',
              });
            }
            const prior = await tx.user.findFirst({
              where: { id: claim.targetId, deletedAt: null },
              omit: { deletedAt: true },
            });
            if (!prior) throw new NotFoundException('Created user not found');
            return prior;
          }
          if (claim.attachment.purpose !== 'EMPLOYEE_PHOTO') {
            throw new BadRequestException('Image purpose does not match User');
          }
          imageFields = {
            imageUrl: null,
            imageStorageProvider: claim.attachment.storageProvider,
            imageStorageAccountId: claim.attachment.storageAccountId,
            imagePublicId: claim.attachment.publicId,
            imageResourceType: claim.attachment.resourceType,
            imageDeliveryType: claim.attachment.deliveryType,
            imageVersion: claim.attachment.version,
          };
        }
        const created = await tx.user.update({
          where: { id: result.user.id },
          data: {
            employeeId,
            userName: dto.userName,
            firstname: dto.firstname,
            lastname: dto.lastname,
            role: dto.role ?? UserRole.DEPARTMENT_STAFF,
            ...(imageClaimRequest ? imageFields : {}),
            section_id: dto.sectionId,
          },
          omit: { deletedAt: true },
        });

        await this.recordSecurityAudit(tx, {
          actorUserId,
          targetUserId: created.id,
          action: 'USER_CREATED',
          details: { role: created.role },
        });
        return created;
      });

      return this.imageReadService.projectUser(user);
    } catch (error) {
      // Compensating rollback: clean up orphaned Better-Auth records
      await this.prisma.account.deleteMany({
        where: { userId: result.user.id },
      });
      await this.prisma.user.delete({
        where: { id: result.user.id },
      });
      throw error;
    }
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

    return paginate(
      data.map((user) => this.imageReadService.projectUser(user)),
      total,
      page,
      limit,
    );
  }

  // ─── Read One ─────────────────────────────────────────────────────────────────

  /** Retrieve a user by ID or Employee Code (excludes soft-deleted users) */
  async findOne(idOrEmployeeId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [{ id: idOrEmployeeId }, { employeeId: idOrEmployeeId }],
      },
      omit: { deletedAt: true },
    });

    if (!user) {
      throw new NotFoundException(
        `User not found with ID or Employee Code: ${idOrEmployeeId}`,
      );
    }

    return this.imageReadService.projectUser(user);
  }

  // ─── Update ───────────────────────────────────────────────────────────────────

  /** Update user data (Admin only for email, password changed via dedicated endpoints) */
  async update(
    idOrEmployeeId: string,
    dto: UpdateUserDto,
    actorUserId: string,
  ) {
    const user = await this.findOne(idOrEmployeeId); // throws NotFoundException if not found

    this.imageAttachmentService.assertAttachmentPayload({
      purpose: 'EMPLOYEE_PHOTO',
      uploadId: dto.imageUploadId,
      creationContextToken: dto.imageCreationContextToken,
    });
    let imageClaimRequest: ImageClaimRequest | undefined;
    if (dto.imageUploadId) {
      imageClaimRequest = {
        actorUserId,
        purpose: 'EMPLOYEE_PHOTO',
        uploadId: dto.imageUploadId,
        operation: 'UPDATE',
        targetId: user.id,
        creationContextToken: dto.imageCreationContextToken,
        fingerprint: imageClaimFingerprint({
          actorUserId,
          purpose: 'EMPLOYEE_PHOTO',
          operation: 'UPDATE',
          targetId: user.id,
          fields: dto,
        }),
      };
      const priorTargetId =
        await this.imageAttachmentService.committedTargetForRetry(
          imageClaimRequest,
        );
      if (priorTargetId) return user;
      await this.imageAttachmentService.preflightClaim(imageClaimRequest);
    }

    const profileDto = { ...dto };
    delete profileDto.imageUploadId;
    delete profileDto.imageCreationContextToken;
    const { sectionId, email, userName } = profileDto;

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

    if (userName !== undefined && userName !== user.userName) {
      const userNameExists = await this.prisma.user.findFirst({
        where: {
          userName,
          id: { not: user.id },
        },
      });

      if (userNameExists) {
        throw new ConflictException(`Username ${userName} is already in use`);
      }
    }

    if (sectionId) {
      const section = await this.prisma.section.findUnique({
        where: { id: sectionId },
      });

      if (!section) {
        throw new BadRequestException(
          `Section not found with ID: ${sectionId}`,
        );
      }
    }

    // Employee IDs are immutable through profile updates.
    const profileFields: Record<string, unknown> = { ...profileDto };
    for (const field of [
      'sectionId',
      'email',
      'userName',
      'role',
      'banned',
      'employeeId',
      ...PRIVATE_USER_IMAGE_FIELDS,
    ]) {
      delete profileFields[field];
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Lock all ADMIN rows before changes that can remove an active ADMIN.
      // This serializes concurrent demotions/disables against the same count.
      if (dto.role !== undefined || dto.banned !== undefined) {
        await this.lockAdminRows(tx);
      }

      if (imageClaimRequest) {
        await this.imageAttachmentService.lockTargetRow(
          tx,
          'EMPLOYEE_PHOTO',
          user.id,
        );
      }

      const current = await tx.user.findFirst({
        where: { id: user.id, deletedAt: null },
      });
      if (!current) {
        throw new NotFoundException(
          `User not found with ID: ${idOrEmployeeId}`,
        );
      }

      const safeProfileFields = { ...profileFields };
      let imageFields: Prisma.UserUncheckedUpdateInput = {};
      if (imageClaimRequest) {
        const claim = await this.imageAttachmentService.claimInTransaction(
          tx,
          imageClaimRequest,
          managedImageLocator(current),
          current.imageUrl,
        );
        if (claim.kind === 'REPLAY') {
          if (claim.targetId !== current.id) {
            throw new ConflictException({
              code: 'IMAGE_UPLOAD_ALREADY_CLAIMED',
              message:
                'The upload has already been attached to another account',
            });
          }
          return current;
        }
        if (claim.attachment.purpose !== 'EMPLOYEE_PHOTO') {
          throw new BadRequestException('Image purpose does not match User');
        }
        imageFields = {
          imageUrl: null,
          imageStorageProvider: claim.attachment.storageProvider,
          imageStorageAccountId: claim.attachment.storageAccountId,
          imagePublicId: claim.attachment.publicId,
          imageResourceType: claim.attachment.resourceType,
          imageDeliveryType: claim.attachment.deliveryType,
          imageVersion: claim.attachment.version,
        };
      }

      const roleChanged = dto.role !== undefined && dto.role !== current.role;
      const accountStateChanged =
        dto.banned !== undefined && dto.banned !== (current.banned === true);
      const disabling = dto.banned === true && current.banned !== true;

      if (
        current.role === UserRole.ADMIN &&
        ((roleChanged && dto.role !== UserRole.ADMIN) || disabling)
      ) {
        await this.assertNotLastActiveEnrolledAdmin(tx, current.id);
      }

      const updateData: Prisma.UserUncheckedUpdateInput = {
        ...safeProfileFields,
        ...imageFields,
        ...(email !== undefined ? { email } : {}),
        ...(userName !== undefined ? { userName } : {}),
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.banned !== undefined ? { banned: dto.banned } : {}),
        ...(sectionId !== undefined ? { section_id: sectionId } : {}),
      };

      const updated = await tx.user.update({
        where: { id: current.id },
        data: updateData,
        omit: { deletedAt: true },
      });

      if (roleChanged || accountStateChanged) {
        const { revokedSessions, revokedTrustedDevices } =
          await this.revokeAccess(tx, current.id);

        if (roleChanged) {
          await this.recordSecurityAudit(tx, {
            actorUserId,
            targetUserId: current.id,
            action: 'USER_ROLE_CHANGED',
            details: {
              from: current.role,
              to: updated.role,
              revokedSessions: revokedSessions.count,
              revokedTrustedDevices: revokedTrustedDevices.count,
            },
          });
        }

        if (dto.banned === true && current.banned !== true) {
          await this.recordSecurityAudit(tx, {
            actorUserId,
            targetUserId: current.id,
            action: 'USER_DISABLED',
            details: {
              revokedSessions: revokedSessions.count,
              revokedTrustedDevices: revokedTrustedDevices.count,
            },
          });
        } else if (dto.banned === false && current.banned === true) {
          await this.recordSecurityAudit(tx, {
            actorUserId,
            targetUserId: current.id,
            action: 'USER_ENABLED',
          });
        }
      }

      return updated;
    });
    return this.imageReadService.projectUser(updated);
  }

  // ─── Admin Reset Password ──────────────────────────────────────────────────

  /** Admin resets/sets a user's password and revokes all active sessions and trusted browsers */
  async adminResetPassword(
    idOrEmployeeId: string,
    newPassword: string,
    actorUserId: string,
    sessionId: string,
  ) {
    const user = await this.findOne(idOrEmployeeId);
    await this.adminStepUpService.requireActive(actorUserId, sessionId);
    if (newPassword.length < 8 || newPassword.length > 128) {
      throw new BadRequestException('Password must be 8 to 128 characters');
    }
    // BetterAuth's default credential hash and password length policy.
    const passwordHash = await hashPassword(newPassword);

    await this.prisma.$transaction(async (tx) => {
      await this.assertStepUpStillActive(tx, actorUserId, sessionId);
      const credentialAccounts = await tx.account.updateMany({
        where: { userId: user.id, providerId: 'credential' },
        data: { password: passwordHash },
      });
      if (credentialAccounts.count === 0) {
        throw new ConflictException('The target has no password credential');
      }
      const { revokedSessions, revokedTrustedDevices } =
        await this.revokeAccess(tx, user.id);
      await this.recordSecurityAudit(tx, {
        actorUserId,
        targetUserId: user.id,
        action: 'ADMIN_PASSWORD_RESET',
        details: {
          revokedSessions: revokedSessions.count,
          revokedTrustedDevices: revokedTrustedDevices.count,
        },
      });
    });

    return {
      message: `Password for user ${user.userName || user.email} has been successfully reset`,
    };
  }

  async adminResetTwoFactor(
    idOrEmployeeId: string,
    dto: AdminResetTwoFactorDto,
    actorUserId: string,
    sessionId: string,
  ) {
    const target = await this.findOne(idOrEmployeeId);
    if (target.id === actorUserId) {
      throw new BadRequestException({
        code: 'SELF_2FA_RESET_NOT_ALLOWED',
        message: 'An ADMIN cannot use assisted recovery to reset their own 2FA',
      });
    }

    await this.adminStepUpService.requireActive(actorUserId, sessionId);
    const resetAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await this.lockAdminRows(tx);
      await this.assertStepUpStillActive(tx, actorUserId, sessionId);

      const current = await tx.user.findFirst({
        where: { id: target.id, deletedAt: null },
        select: {
          id: true,
          email: true,
          firstname: true,
          lastname: true,
          role: true,
        },
      });
      if (!current) {
        throw new NotFoundException(
          `User not found with ID: ${idOrEmployeeId}`,
        );
      }
      if (!this.twoFactorService.requiresTwoFactor(current.role)) {
        throw new ConflictException({
          code: 'TWO_FACTOR_NOT_REQUIRED',
          message:
            'Assisted 2FA reset is available only for roles with enforced 2FA enrollment',
        });
      }

      const existingTwoFactor = await tx.twoFactorAuth.findUnique({
        where: { userId: current.id },
        select: { enrollmentComplete: true },
      });
      if (!existingTwoFactor) {
        throw new ConflictException({
          code: 'TWO_FACTOR_NOT_ENROLLED',
          message: 'The target user has no 2FA enrollment to reset',
        });
      }

      if (
        current.role === UserRole.ADMIN &&
        existingTwoFactor.enrollmentComplete
      ) {
        await this.assertNotLastActiveEnrolledAdmin(tx, current.id);
      }

      await tx.twoFactorAuth.delete({ where: { userId: current.id } });
      const { revokedSessions, revokedTrustedDevices } =
        await this.revokeAccess(tx, current.id);
      await this.recordSecurityAudit(tx, {
        actorUserId,
        targetUserId: current.id,
        action: 'ADMIN_2FA_RESET',
        reason: dto.reason,
        details: {
          identityVerifiedOutsideHams: dto.identityVerifiedOutsideHams,
          revokedSessions: revokedSessions.count,
          revokedTrustedDevices: revokedTrustedDevices.count,
        },
      });
    });

    await mailService.sendTwoFactorResetNotice({
      to: target.email,
      name: `${target.firstname} ${target.lastname}`,
      resetAt,
    });

    return {
      message: '2FA was reset; the user must enroll an authenticator again',
    };
  }

  // ─── Soft Delete ──────────────────────────────────────────────────────────────

  /** Soft delete: sets deletedAt instead of actual deletion */
  async remove(idOrEmployeeId: string, actorUserId: string) {
    const user = await this.findOne(idOrEmployeeId); // throws NotFoundException if not found or already deleted

    await this.prisma.$transaction(async (tx) => {
      await this.lockAdminRows(tx);
      const current = await tx.user.findFirst({
        where: { id: user.id, deletedAt: null },
      });
      if (!current) {
        throw new NotFoundException(
          `User not found with ID: ${idOrEmployeeId}`,
        );
      }
      await this.assertNotLastActiveEnrolledAdmin(tx, current.id);

      await tx.user.update({
        where: { id: current.id },
        data: { deletedAt: new Date() },
      });
      const { revokedSessions, revokedTrustedDevices } =
        await this.revokeAccess(tx, current.id);
      await this.recordSecurityAudit(tx, {
        actorUserId,
        targetUserId: current.id,
        action: 'USER_SOFT_DELETED',
        details: {
          revokedSessions: revokedSessions.count,
          revokedTrustedDevices: revokedTrustedDevices.count,
        },
      });
    });

    return { message: `User ID: ${user.id} successfully deleted` };
  }

  // ─── Restore ──────────────────────────────────────────────────────────────────

  /** Restore a soft-deleted user */
  async restore(idOrEmployeeId: string, actorUserId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        deletedAt: { not: null },
        OR: [{ id: idOrEmployeeId }, { employeeId: idOrEmployeeId }],
      },
    });

    if (!user) {
      throw new NotFoundException(
        `Deleted user not found with ID or Employee Code: ${idOrEmployeeId} (may not exist or not deleted)`,
      );
    }

    const restored = await this.prisma.$transaction(async (tx) => {
      const restored = await tx.user.update({
        where: { id: user.id },
        data: { deletedAt: null },
        omit: { deletedAt: true },
      });
      const { revokedSessions, revokedTrustedDevices } =
        await this.revokeAccess(tx, user.id);
      await this.recordSecurityAudit(tx, {
        actorUserId,
        targetUserId: user.id,
        action: 'USER_RESTORED',
        details: {
          role: restored.role,
          revokedSessions: revokedSessions.count,
          revokedTrustedDevices: revokedTrustedDevices.count,
        },
      });
      return restored;
    });
    return this.imageReadService.projectUser(restored);
  }

  private async revokeAccess(tx: Prisma.TransactionClient, userId: string) {
    const revokedSessions = await tx.session.deleteMany({ where: { userId } });
    const revokedTrustedDevices = await tx.trustedDevice.deleteMany({
      where: { userId },
    });
    return { revokedSessions, revokedTrustedDevices };
  }

  private async lockAdminRows(tx: Prisma.TransactionClient): Promise<void> {
    await tx.$queryRawUnsafe<Array<{ id: string }>>(
      'SELECT id FROM users WHERE role::text = $1 FOR UPDATE',
      UserRole.ADMIN,
    );
  }

  private async assertNotLastActiveEnrolledAdmin(
    tx: Prisma.TransactionClient,
    targetUserId: string,
  ): Promise<void> {
    const targetEnrollment = await tx.twoFactorAuth.findUnique({
      where: { userId: targetUserId },
      select: { enrollmentComplete: true },
    });
    if (!targetEnrollment?.enrollmentComplete) return;

    const activeAdmins = await tx.user.findMany({
      where: {
        role: UserRole.ADMIN,
        deletedAt: null,
        OR: [{ banned: false }, { banned: null }],
      },
      select: { id: true },
    });
    if (!activeAdmins.some(({ id }) => id === targetUserId)) return;

    const enrolledAdminCount = await tx.twoFactorAuth.count({
      where: {
        userId: { in: activeAdmins.map(({ id }) => id) },
        enrollmentComplete: true,
      },
    });
    if (enrolledAdminCount <= 1) {
      throw new ConflictException({
        code: 'LAST_ACTIVE_ENROLLED_ADMIN',
        message:
          'The last active enrolled ADMIN cannot be disabled, deleted, or demoted',
      });
    }
  }

  private async assertStepUpStillActive(
    tx: Prisma.TransactionClient,
    actorUserId: string,
    sessionId: string,
  ): Promise<void> {
    const now = new Date();
    const actor = await tx.user.findFirst({
      where: {
        id: actorUserId,
        role: UserRole.ADMIN,
        deletedAt: null,
        OR: [{ banned: false }, { banned: null }],
      },
      select: { id: true },
    });
    const session = await tx.session.findFirst({
      where: { id: sessionId, userId: actorUserId, expiresAt: { gt: now } },
      select: { adminStepUp: { select: { expiresAt: true } } },
    });
    if (
      !actor ||
      !session?.adminStepUp ||
      session.adminStepUp.expiresAt <= now
    ) {
      throw new ForbiddenException({
        code: 'STEP_UP_REQUIRED',
        message: 'Fresh ADMIN TOTP verification is required',
      });
    }
  }

  private async recordSecurityAudit(
    tx: Prisma.TransactionClient,
    input: SecurityAuditInput,
  ): Promise<void> {
    await tx.securityAuditLog.create({
      data: {
        actorUserId: input.actorUserId,
        targetUserId: input.targetUserId,
        action: input.action,
        ...(input.reason !== undefined ? { reason: input.reason } : {}),
        ...(input.details !== undefined ? { details: input.details } : {}),
      },
    });
  }
}
