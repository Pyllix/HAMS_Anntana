import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma.service';
import { UserRole } from '@prisma/client';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { AdminStepUpService } from '../auth/admin-step-up.service';
import { TwoFactorService } from '../auth/two-factor.service';
import { plainToInstance } from 'class-transformer';
import { UpdateUserDto } from './dto/update-user.dto';
import { ImageAttachmentService } from '../images/image-attachment.service';
import { ImageReadService } from '../images/image-read.service';

jest.mock('better-auth/crypto', () => ({
  hashPassword: jest.fn().mockResolvedValue('hashed-password'),
}));

jest.mock('../common/mail/mail.service', () => ({
  mailService: { sendTwoFactorResetNotice: jest.fn() },
}));

// ─── Mock better-auth ────────────────────────────────────────────────────────
jest.mock('../auth/auth', () => ({
  auth: {
    api: {
      signUpEmail: jest.fn(),
      setUserPassword: jest.fn(),
    },
  },
}));

import { auth } from '../auth/auth';
import { mailService } from '../common/mail/mail.service';

// ─── Mock PrismaService ───────────────────────────────────────────────────────
const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  section: {
    findUnique: jest.fn(),
  },
  account: {
    deleteMany: jest.fn(),
    updateMany: jest.fn(),
  },
  session: {
    deleteMany: jest.fn(),
    findFirst: jest.fn(),
  },
  trustedDevice: { deleteMany: jest.fn() },
  twoFactorAuth: { findUnique: jest.fn(), count: jest.fn(), delete: jest.fn() },
  securityAuditLog: { create: jest.fn() },
  $queryRawUnsafe: jest.fn(),
  $transaction: jest.fn(),
};

const mockAdminStepUpService = { requireActive: jest.fn() };
const mockTwoFactorService = { requiresTwoFactor: jest.fn() };
const mockImageAttachmentService = {
  assertFeatureActive: jest.fn(),
  assertAttachmentPayload: jest.fn(),
  committedTargetForRetry: jest.fn(),
  preflightClaim: jest.fn(),
  claimInTransaction: jest.fn(),
  lockTargetRow: jest.fn(),
};
const mockImageReadService = {
  projectUser: jest.fn((user: Record<string, unknown>) => ({
    ...user,
    imageUrl: null,
    hasEmployeePhoto: false,
    photoRevision: null,
  })),
};

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const mockUser = {
  id: 'user-uuid-1',
  userName: 'jdoe',
  firstname: 'John',
  lastname: 'Doe',
  email: 'john.doe@hospital.go.th',
  role: UserRole.DEPARTMENT_STAFF,
  imageUrl: null,
  emailVerified: false,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

// ─── Suite ────────────────────────────────────────────────────────────────────
describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AdminStepUpService, useValue: mockAdminStepUpService },
        { provide: TwoFactorService, useValue: mockTwoFactorService },
        {
          provide: ImageAttachmentService,
          useValue: mockImageAttachmentService,
        },
        { provide: ImageReadService, useValue: mockImageReadService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);

    // Reset all mocks before each test
    jest.clearAllMocks();
    mockAdminStepUpService.requireActive
      .mockReset()
      .mockResolvedValue(undefined);
    mockPrismaService.$transaction.mockImplementation(
      async (action: unknown) =>
        typeof action === 'function'
          ? (action as (tx: typeof mockPrismaService) => Promise<unknown>)(
              mockPrismaService,
            )
          : Promise.all(action as Promise<unknown>[]),
    );
    mockPrismaService.twoFactorAuth.findUnique.mockResolvedValue(null);
    mockPrismaService.session.deleteMany.mockResolvedValue({ count: 0 });
    mockPrismaService.trustedDevice.deleteMany.mockResolvedValue({ count: 0 });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // generateEmployeeId()
  // ───────────────────────────────────────────────────────────────────────────
  describe('generateEmployeeId()', () => {
    it('should generate first sequence code GOV-YY0001 when no previous record exists for year', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      const id = await service.generateEmployeeId();
      expect(id).toMatch(/^GOV-\d{2}0001$/);
    });

    it('should increment next sequence code when previous codes exist in current year', async () => {
      const now = new Date();
      const thaiYear = String((now.getFullYear() + 543) % 100).padStart(2, '0');
      mockPrismaService.user.findFirst.mockResolvedValue({
        employeeId: `GOV-${thaiYear}0042`,
      });
      const id = await service.generateEmployeeId();
      expect(id).toBe(`GOV-${thaiYear}0043`);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // create()
  // ───────────────────────────────────────────────────────────────────────────
  describe('create()', () => {
    const createDto = {
      userName: 'jdoe',
      firstname: 'John',
      lastname: 'Doe',
      email: 'john.doe@hospital.go.th',
      password: 'P@ssword123',
      role: UserRole.DEPARTMENT_STAFF,
      sectionId: undefined,
    };

    it('should create a user and return the updated record with auto-generated employeeId', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      jest.mocked(auth.api.signUpEmail).mockResolvedValue({
        user: { id: 'user-uuid-1' },
      } as any);
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      const result = await service.create(createDto as any, 'admin-1');

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: createDto.email },
      });
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: { userName: createDto.userName },
      });
      expect(auth.api.signUpEmail).toHaveBeenCalledWith({
        body: {
          name: `${createDto.firstname} ${createDto.lastname}`,
          email: createDto.email,
          password: createDto.password,
        },
      });
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
        data: {
          employeeId: expect.stringMatching(/^GOV-\d{6}$/),
          userName: createDto.userName,
          firstname: createDto.firstname,
          lastname: createDto.lastname,
          role: createDto.role,
          section_id: createDto.sectionId,
        },
        omit: { deletedAt: true },
      });
      expect(result).toEqual({
        ...mockUser,
        hasEmployeePhoto: false,
        photoRevision: null,
      });
    });

    it('should use default role DEPARTMENT_STAFF when role is not provided', async () => {
      const dtoWithoutRole = { ...createDto, role: undefined };
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      jest.mocked(auth.api.signUpEmail).mockResolvedValue({
        user: { id: 'user-uuid-1' },
      } as any);
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      await service.create(dtoWithoutRole as any, 'admin-1');

      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: 'DEPARTMENT_STAFF' }),
        }),
      );
    });

    it('should throw ConflictException if email already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.create(createDto as any, 'admin-1')).rejects.toThrow(
        new ConflictException(`Email ${createDto.email} is already in use`),
      );

      expect(auth.api.signUpEmail).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if userName already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.findFirst.mockResolvedValue({ id: 'existing-id' });

      await expect(service.create(createDto as any, 'admin-1')).rejects.toThrow(
        new ConflictException(
          `Username ${createDto.userName} is already in use`,
        ),
      );

      expect(auth.api.signUpEmail).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if sectionId does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.section.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          { ...createDto, sectionId: 'nonexistent-sec' } as any,
          'admin-1',
        ),
      ).rejects.toThrow(
        new BadRequestException('Section not found with ID: nonexistent-sec'),
      );

      expect(auth.api.signUpEmail).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if better-auth returns no user id', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      jest.mocked(auth.api.signUpEmail).mockResolvedValue({ user: {} } as any);

      await expect(service.create(createDto as any, 'admin-1')).rejects.toThrow(
        new ConflictException('Failed to create user'),
      );

      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if better-auth returns null', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      jest.mocked(auth.api.signUpEmail).mockResolvedValue(null as any);

      await expect(service.create(createDto as any, 'admin-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should perform compensating rollback (delete account and user) if user.update fails', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      jest.mocked(auth.api.signUpEmail).mockResolvedValue({
        user: { id: 'user-uuid-1' },
      } as any);
      mockPrismaService.user.update.mockRejectedValue(
        new Error('DB Update Error'),
      );

      await expect(service.create(createDto as any, 'admin-1')).rejects.toThrow(
        'DB Update Error',
      );

      expect(mockPrismaService.account.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-uuid-1' },
      });
      expect(mockPrismaService.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // findAll()
  // ───────────────────────────────────────────────────────────────────────────
  describe('findAll()', () => {
    it('should return paginated users with default page and limit', async () => {
      const query: PaginationDto = {};
      mockPrismaService.$transaction.mockResolvedValue([[mockUser], 1]);

      const result = await service.findAll(query);

      expect(mockPrismaService.$transaction).toHaveBeenCalledWith([
        mockPrismaService.user.findMany(expect.anything()),
        mockPrismaService.user.count(expect.anything()),
      ]);
      expect(result.data).toHaveLength(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
      expect(result.meta.hasNextPage).toBe(false);
      expect(result.meta.hasPrevPage).toBe(false);
    });

    it('should apply pagination skip/take correctly', async () => {
      const query: PaginationDto = { page: 2, limit: 5 };
      mockPrismaService.$transaction.mockResolvedValue([[], 10]);

      const result = await service.findAll(query);

      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(5);
      expect(result.meta.total).toBe(10);
      expect(result.meta.totalPages).toBe(2);
      expect(result.meta.hasNextPage).toBe(false);
      expect(result.meta.hasPrevPage).toBe(true);
    });

    it('should build a search filter on OR fields when search is provided', async () => {
      const query: PaginationDto = { search: 'john' };
      mockPrismaService.$transaction.mockResolvedValue([[mockUser], 1]);

      await service.findAll(query);

      // Verify findMany was called with an OR search clause
      const [[findManyCall]] = mockPrismaService.user.findMany.mock.calls;
      expect(findManyCall.where).toMatchObject({
        deletedAt: null,
        OR: expect.arrayContaining([
          { userName: { contains: 'john', mode: 'insensitive' } },
          { email: { contains: 'john', mode: 'insensitive' } },
        ]),
      });
    });

    it('should NOT include OR clause when search is absent', async () => {
      const query: PaginationDto = {};
      mockPrismaService.$transaction.mockResolvedValue([[mockUser], 1]);

      await service.findAll(query);

      const [[findManyCall]] = mockPrismaService.user.findMany.mock.calls;
      expect(findManyCall.where).not.toHaveProperty('OR');
    });

    it('should filter by role when role is provided', async () => {
      const query = { role: UserRole.MAINTENANCE_STAFF };
      mockPrismaService.$transaction.mockResolvedValue([[mockUser], 1]);

      await service.findAll(query);

      const [[findManyCall]] = mockPrismaService.user.findMany.mock.calls;
      expect(findManyCall.where).toMatchObject({
        deletedAt: null,
        role: UserRole.MAINTENANCE_STAFF,
      });
    });

    it('should filter by section_id when section_id is provided', async () => {
      const query = { section_id: 'sec-opd-uuid' };
      mockPrismaService.$transaction.mockResolvedValue([[mockUser], 1]);

      await service.findAll(query);

      const [[findManyCall]] = mockPrismaService.user.findMany.mock.calls;
      expect(findManyCall.where).toMatchObject({
        deletedAt: null,
        section_id: 'sec-opd-uuid',
      });
    });

    it('should return empty data when no users match', async () => {
      const query: PaginationDto = { search: 'nonexistent' };
      mockPrismaService.$transaction.mockResolvedValue([[], 0]);

      const result = await service.findAll(query);

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // findOne()
  // ───────────────────────────────────────────────────────────────────────────
  describe('findOne()', () => {
    it('should return a user when found', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

      const result = await service.findOne('user-uuid-1');

      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          OR: [{ id: 'user-uuid-1' }, { employeeId: 'user-uuid-1' }],
        },
        omit: { deletedAt: true },
      });
      expect(result).toEqual({
        ...mockUser,
        hasEmployeePhoto: false,
        photoRevision: null,
      });
    });

    it('should throw NotFoundException when user is not found', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(
        new NotFoundException(
          'User not found with ID or Employee Code: nonexistent-id',
        ),
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // update()
  // ───────────────────────────────────────────────────────────────────────────
  describe('update()', () => {
    const updateDto = { firstname: 'Jane', lastname: 'Smith' };

    it('does not inject a role into a profile-only DTO', () => {
      const dto = plainToInstance(UpdateUserDto, { firstname: 'Jane' });
      expect(dto.role).toBeUndefined();
    });

    it('does not demote an ADMIN or revoke sessions for a profile edit', async () => {
      const admin = { ...mockUser, role: UserRole.ADMIN };
      mockPrismaService.user.findFirst.mockResolvedValue(admin);
      mockPrismaService.user.update.mockResolvedValue({
        ...admin,
        firstname: 'Jane',
      });
      const dto = plainToInstance(UpdateUserDto, { firstname: 'Jane' });

      await service.update('user-uuid-1', dto, 'another-admin');

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: admin.id },
        data: { firstname: 'Jane' },
        omit: { deletedAt: true },
      });
      expect(mockPrismaService.session.deleteMany).not.toHaveBeenCalled();
      expect(mockPrismaService.trustedDevice.deleteMany).not.toHaveBeenCalled();
    });

    it('prevents demoting the last active enrolled ADMIN', async () => {
      const admin = { ...mockUser, role: UserRole.ADMIN, banned: false };
      mockPrismaService.user.findFirst.mockResolvedValue(admin);
      mockPrismaService.twoFactorAuth.findUnique.mockResolvedValue({
        enrollmentComplete: true,
      });
      mockPrismaService.user.findMany.mockResolvedValue([{ id: admin.id }]);
      mockPrismaService.twoFactorAuth.count.mockResolvedValue(1);

      await expect(
        service.update(
          admin.id,
          { role: UserRole.DEPARTMENT_STAFF },
          'another-admin',
        ),
      ).rejects.toThrow(ConflictException);
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });

    it('prevents disabling the last active enrolled ADMIN', async () => {
      const admin = { ...mockUser, role: UserRole.ADMIN, banned: false };
      mockPrismaService.user.findFirst.mockResolvedValue(admin);
      mockPrismaService.twoFactorAuth.findUnique.mockResolvedValue({
        enrollmentComplete: true,
      });
      mockPrismaService.user.findMany.mockResolvedValue([{ id: admin.id }]);
      mockPrismaService.twoFactorAuth.count.mockResolvedValue(1);

      await expect(
        service.update(admin.id, { banned: true }, 'another-admin'),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'LAST_ACTIVE_ENROLLED_ADMIN',
        }),
      });
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
      expect(mockPrismaService.session.deleteMany).not.toHaveBeenCalled();
    });

    it('should update and return the updated user', async () => {
      const updatedUser = { ...mockUser, ...updateDto };
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.update('user-uuid-1', updateDto, 'admin-1');

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
        data: updateDto,
        omit: { deletedAt: true },
      });
      expect(result).toEqual({
        ...updatedUser,
        hasEmployeePhoto: false,
        photoRevision: null,
      });
    });

    it('should ignore employeeId in update payload to enforce immutability', async () => {
      const updatedUser = { ...mockUser, firstname: 'Jane' };
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      await service.update(
        'user-uuid-1',
        {
          firstname: 'Jane',
          employeeId: 'GOV-679999',
        } as any,
        'admin-1',
      );

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
        data: { firstname: 'Jane' },
        omit: { deletedAt: true },
      });
    });

    it('should throw ConflictException if new email is already in use by another user', async () => {
      mockPrismaService.user.findFirst
        .mockResolvedValueOnce(mockUser) // findOne
        .mockResolvedValueOnce({
          id: 'other-uuid',
          email: 'taken@hospital.go.th',
        }); // findFirst email check

      await expect(
        service.update(
          'user-uuid-1',
          { email: 'taken@hospital.go.th' } as any,
          'admin-1',
        ),
      ).rejects.toThrow(
        new ConflictException('Email taken@hospital.go.th is already in use'),
      );

      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if new userName is already in use by another user', async () => {
      mockPrismaService.user.findFirst
        .mockResolvedValueOnce(mockUser) // findOne
        .mockResolvedValueOnce({ id: 'other-uuid', userName: 'takenuser' }); // findFirst userName check

      await expect(
        service.update(
          'user-uuid-1',
          { userName: 'takenuser' } as any,
          'admin-1',
        ),
      ).rejects.toThrow(
        new ConflictException('Username takenuser is already in use'),
      );

      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if sectionId does not exist on update', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      mockPrismaService.section.findUnique.mockResolvedValue(null);

      await expect(
        service.update(
          'user-uuid-1',
          { sectionId: 'invalid-sec' } as any,
          'admin-1',
        ),
      ).rejects.toThrow(
        new BadRequestException('Section not found with ID: invalid-sec'),
      );

      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(
        service.update('nonexistent-id', updateDto as any, 'admin-1'),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // adminResetPassword()
  // ───────────────────────────────────────────────────────────────────────────
  describe('adminResetPassword()', () => {
    it('rejects an expired Step-up before changing credentials', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      mockAdminStepUpService.requireActive.mockRejectedValue(
        new Error('STEP_UP_REQUIRED'),
      );

      await expect(
        service.adminResetPassword(
          'user-uuid-1',
          'NewPassword123',
          'admin-1',
          'session-1',
        ),
      ).rejects.toThrow('STEP_UP_REQUIRED');
      expect(mockPrismaService.account.updateMany).not.toHaveBeenCalled();
    });
    it('updates the credential and revokes sessions in one transaction', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      mockPrismaService.user.findFirst
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce({ id: 'admin-1' });
      mockPrismaService.session.findFirst.mockResolvedValue({
        adminStepUp: { expiresAt: new Date(Date.now() + 60_000) },
      });
      mockPrismaService.account.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.session.deleteMany.mockResolvedValue({
        count: 2,
      });

      const result = await service.adminResetPassword(
        'user-uuid-1',
        'NewPassword123',
        'admin-1',
        'session-1',
      );

      expect(mockAdminStepUpService.requireActive).toHaveBeenCalledWith(
        'admin-1',
        'session-1',
      );
      expect(mockPrismaService.account.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-uuid-1', providerId: 'credential' },
        data: { password: 'hashed-password' },
      });
      expect(mockPrismaService.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-uuid-1' },
      });
      expect(mockPrismaService.securityAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorUserId: 'admin-1',
          targetUserId: 'user-uuid-1',
          action: 'ADMIN_PASSWORD_RESET',
          details: { revokedSessions: 2, revokedTrustedDevices: 0 },
        }),
      });
      expect(
        JSON.stringify(mockPrismaService.securityAuditLog.create.mock.calls),
      ).not.toContain('NewPassword123');
      expect(result).toEqual({
        message: 'Password for user jdoe has been successfully reset',
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(
        service.adminResetPassword(
          'nonexistent-id',
          'NewPassword123',
          'admin-1',
          'session-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('adminResetTwoFactor()', () => {
    const reason = 'Identity checked outside HAMS';

    it('rejects an ADMIN resetting their own 2FA', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({
        ...mockUser,
        id: 'admin-1',
        role: UserRole.ADMIN,
      });

      await expect(
        service.adminResetTwoFactor(
          'admin-1',
          { reason, identityVerifiedOutsideHams: true },
          'admin-1',
          'session-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.twoFactorAuth.delete).not.toHaveBeenCalled();
    });

    it('destroys enrollment and access, records the reason, and notifies the owner', async () => {
      const target = { ...mockUser, role: UserRole.MANAGER };
      mockPrismaService.user.findFirst.mockResolvedValue(target);
      mockPrismaService.session.findFirst.mockResolvedValue({
        adminStepUp: { expiresAt: new Date(Date.now() + 60_000) },
      });
      mockPrismaService.twoFactorAuth.findUnique.mockResolvedValue({
        enrollmentComplete: true,
      });
      mockTwoFactorService.requiresTwoFactor.mockReturnValue(true);

      await service.adminResetTwoFactor(
        target.id,
        { reason, identityVerifiedOutsideHams: true },
        'admin-1',
        'session-1',
      );

      expect(mockPrismaService.twoFactorAuth.delete).toHaveBeenCalledWith({
        where: { userId: target.id },
      });
      expect(mockPrismaService.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: target.id },
      });
      expect(mockPrismaService.trustedDevice.deleteMany).toHaveBeenCalledWith({
        where: { userId: target.id },
      });
      expect(mockPrismaService.securityAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorUserId: 'admin-1',
          targetUserId: target.id,
          reason,
        }),
      });
      expect(mailService.sendTwoFactorResetNotice).toHaveBeenCalledWith(
        expect.objectContaining({ to: target.email }),
      );
    });

    it('allows resetting one ADMIN while another active enrolled ADMIN remains', async () => {
      const target = { ...mockUser, role: UserRole.ADMIN, banned: false };
      mockPrismaService.user.findFirst.mockResolvedValue(target);
      mockPrismaService.user.findMany.mockResolvedValue([
        { id: target.id },
        { id: 'admin-2' },
      ]);
      mockPrismaService.session.findFirst.mockResolvedValue({
        adminStepUp: { expiresAt: new Date(Date.now() + 60_000) },
      });
      mockPrismaService.twoFactorAuth.findUnique.mockResolvedValue({
        enrollmentComplete: true,
      });
      mockPrismaService.twoFactorAuth.count.mockResolvedValue(2);
      mockTwoFactorService.requiresTwoFactor.mockReturnValue(true);

      await expect(
        service.adminResetTwoFactor(
          target.id,
          { reason, identityVerifiedOutsideHams: true },
          'admin-2',
          'session-2',
        ),
      ).resolves.toMatchObject({
        message: expect.stringContaining('must enroll'),
      });
      expect(mockPrismaService.twoFactorAuth.delete).toHaveBeenCalledWith({
        where: { userId: target.id },
      });
    });

    it('prevents resetting the last active enrolled ADMIN', async () => {
      const target = { ...mockUser, role: UserRole.ADMIN, banned: false };
      mockPrismaService.user.findFirst.mockResolvedValue(target);
      mockPrismaService.user.findMany.mockResolvedValue([{ id: target.id }]);
      mockPrismaService.session.findFirst.mockResolvedValue({
        adminStepUp: { expiresAt: new Date(Date.now() + 60_000) },
      });
      mockPrismaService.twoFactorAuth.findUnique.mockResolvedValue({
        enrollmentComplete: true,
      });
      mockPrismaService.twoFactorAuth.count.mockResolvedValue(1);
      mockTwoFactorService.requiresTwoFactor.mockReturnValue(true);

      await expect(
        service.adminResetTwoFactor(
          target.id,
          { reason, identityVerifiedOutsideHams: true },
          'admin-2',
          'session-2',
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'LAST_ACTIVE_ENROLLED_ADMIN',
        }),
      });
      expect(mockPrismaService.twoFactorAuth.delete).not.toHaveBeenCalled();
      expect(mockPrismaService.session.deleteMany).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // remove()
  // ───────────────────────────────────────────────────────────────────────────
  describe('remove()', () => {
    it('should soft-delete a user and return a success message', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue(undefined);

      const result = await service.remove('user-uuid-1', 'admin-1');

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(result).toEqual({
        message: 'User ID: user-uuid-1 successfully deleted',
      });
    });

    it('should throw NotFoundException when user does not exist or is already deleted', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(service.remove('nonexistent-id', 'admin-1')).rejects.toThrow(
        NotFoundException,
      );

      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });

    it('prevents deleting the last active enrolled ADMIN', async () => {
      const admin = { ...mockUser, role: UserRole.ADMIN, banned: false };
      mockPrismaService.user.findFirst.mockResolvedValue(admin);
      mockPrismaService.twoFactorAuth.findUnique.mockResolvedValue({
        enrollmentComplete: true,
      });
      mockPrismaService.user.findMany.mockResolvedValue([{ id: admin.id }]);
      mockPrismaService.twoFactorAuth.count.mockResolvedValue(1);

      await expect(
        service.remove(admin.id, 'another-admin'),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'LAST_ACTIVE_ENROLLED_ADMIN',
        }),
      });
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
      expect(mockPrismaService.session.deleteMany).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // restore()
  // ───────────────────────────────────────────────────────────────────────────
  describe('restore()', () => {
    const deletedUser = { ...mockUser, deletedAt: new Date('2024-06-01') };

    it('should restore a soft-deleted user', async () => {
      const restoredUser = { ...mockUser };
      mockPrismaService.user.findFirst.mockResolvedValue(deletedUser);
      mockPrismaService.user.update.mockResolvedValue(restoredUser);

      const result = await service.restore('user-uuid-1', 'admin-1');

      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          deletedAt: { not: null },
          OR: [{ id: 'user-uuid-1' }, { employeeId: 'user-uuid-1' }],
        },
      });
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
        data: { deletedAt: null },
        omit: { deletedAt: true },
      });
      expect(result).toEqual({
        ...restoredUser,
        hasEmployeePhoto: false,
        photoRevision: null,
      });
    });

    it('should throw NotFoundException when no soft-deleted user is found', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(
        service.restore('nonexistent-id', 'admin-1'),
      ).rejects.toThrow(
        new NotFoundException(
          'Deleted user not found with ID or Employee Code: nonexistent-id (may not exist or not deleted)',
        ),
      );

      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });
  });
});
