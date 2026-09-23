import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { RepairsController } from './repairs.controller';
import { RepairsService } from './repairs.service';
import { ReportType, UrgencyStatus } from '@prisma/client';

describe('RepairsController', () => {
  let controller: RepairsController;

  const mockRepairsService = {
    createRequest: jest.fn(),
    getLookups: jest.fn(),
    getMechanicWorkloads: jest.fn(),
    findAll: jest.fn(),
  };

  const mockSession = {
    session: {
      id: 'session-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: 'user-uuid-1',
      expiresAt: new Date(),
      token: 'mock-token',
    },
    user: {
      id: 'user-uuid-1',
      role: 'DEPARTMENT_STAFF',
      section_id: 'sec-1',
      email: 'staff@example.com',
      emailVerified: true,
      name: 'Staff User',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  } as unknown as UserSession;

  const createDto = {
    assetId: 'asset-uuid-1',
    symptom: 'Broken display',
    urgencyStatus: UrgencyStatus.NORMAL,
    reportType: ReportType.Repair,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RepairsController],
      providers: [
        {
          provide: RepairsService,
          useValue: mockRepairsService,
        },
      ],
    }).compile();

    controller = module.get<RepairsController>(RepairsController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createRequest', () => {
    it('should delegate createRequest to repairsService.createRequest', async () => {
      const mockResult = { id: 'job-1', jobNo: 'REP-202609-0001' };
      mockRepairsService.createRequest.mockResolvedValue(mockResult);

      const result = await controller.createRequest(createDto, mockSession);

      expect(mockRepairsService.createRequest).toHaveBeenCalledWith(
        createDto,
        mockSession.user,
      );
      expect(result).toEqual(mockResult);
    });

    it('should propagate BadRequestException when asset is BORROWED or RESERVED', async () => {
      mockRepairsService.createRequest.mockRejectedValue(
        new BadRequestException(
          'Cannot request repair for an asset that is currently on loan or reserved',
        ),
      );

      await expect(
        controller.createRequest(createDto, mockSession),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
