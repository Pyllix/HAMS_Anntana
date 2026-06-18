import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma.service';
import { UserRole } from '@prisma/client';
import { PaginationDto } from 'src/common/dto/pagination.dto';

// ─── Mock better-auth ────────────────────────────────────────────────────────
jest.mock('../auth/auth', () => ({
  auth: {
    api: {
      signUpEmail: jest.fn(),
    },
  },
}));

import { auth } from '../auth/auth';

// ─── Mock PrismaService ───────────────────────────────────────────────────────
const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
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
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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
      imageUrl: undefined,
      sectionId: undefined,
    };

    it('should create a user and return the updated record', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      jest.mocked(auth.api.signUpEmail).mockResolvedValue({
        user: { id: 'user-uuid-1' },
      } as any);
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      const result = await service.create(createDto as any);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: createDto.email },
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
          userName: createDto.userName,
          firstname: createDto.firstname,
          lastname: createDto.lastname,
          role: createDto.role,
          imageUrl: createDto.imageUrl,
        },
        omit: { deletedAt: true },
      });
      expect(result).toEqual(mockUser);
    });

    it('should use default role DEPARTMENT_STAFF when role is not provided', async () => {
      const dtoWithoutRole = { ...createDto, role: undefined };
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      jest.mocked(auth.api.signUpEmail).mockResolvedValue({
        user: { id: 'user-uuid-1' },
      } as any);
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      await service.create(dtoWithoutRole as any);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: 'DEPARTMENT_STAFF' }),
        }),
      );
    });

    it('should throw ConflictException if email already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.create(createDto as any)).rejects.toThrow(
        new ConflictException(`Email ${createDto.email} is already in use`),
      );

      expect(auth.api.signUpEmail).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if better-auth returns no user id', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      jest.mocked(auth.api.signUpEmail).mockResolvedValue({ user: {} } as any);

      await expect(service.create(createDto as any)).rejects.toThrow(
        new ConflictException('Failed to create user'),
      );

      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if better-auth returns null', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      jest.mocked(auth.api.signUpEmail).mockResolvedValue(null as any);

      await expect(service.create(createDto as any)).rejects.toThrow(
        ConflictException,
      );
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
        where: { id: 'user-uuid-1', deletedAt: null },
        omit: { deletedAt: true },
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user is not found', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(
        new NotFoundException('User not found with ID: nonexistent-id'),
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // update()
  // ───────────────────────────────────────────────────────────────────────────
  describe('update()', () => {
    const updateDto = { firstname: 'Jane', lastname: 'Smith' };

    it('should update and return the updated user', async () => {
      const updatedUser = { ...mockUser, ...updateDto };
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.update('user-uuid-1', updateDto as any);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
        data: updateDto,
        omit: { deletedAt: true },
      });
      expect(result).toEqual(updatedUser);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(
        service.update('nonexistent-id', updateDto as any),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // remove()
  // ───────────────────────────────────────────────────────────────────────────
  describe('remove()', () => {
    it('should soft-delete a user and return a success message', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue(undefined);

      const result = await service.remove('user-uuid-1');

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(result).toEqual({ message: 'User ID: user-uuid-1 successfully deleted' });
    });

    it('should throw NotFoundException when user does not exist or is already deleted', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(service.remove('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );

      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
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

      const result = await service.restore('user-uuid-1');

      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1', deletedAt: { not: null } },
      });
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
        data: { deletedAt: null },
        omit: { deletedAt: true },
      });
      expect(result).toEqual(restoredUser);
    });

    it('should throw NotFoundException when no soft-deleted user is found', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(service.restore('nonexistent-id')).rejects.toThrow(
        new NotFoundException(
          'Deleted user not found with ID: nonexistent-id (may not exist or not deleted)',
        ),
      );

      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });
  });
});
