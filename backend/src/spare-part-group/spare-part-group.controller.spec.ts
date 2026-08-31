import { Test, TestingModule } from '@nestjs/testing';
import { SparePartGroupController } from './spare-part-group.controller';
import { SparePartGroupService } from './spare-part-group.service';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { RolesGuard } from 'src/common/guards/roles.guard';

describe('SparePartGroupController', () => {
  let controller: SparePartGroupController;
  let service: SparePartGroupService;

  const mockSparePartGroupService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SparePartGroupController],
      providers: [
        { provide: SparePartGroupService, useValue: mockSparePartGroupService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SparePartGroupController>(SparePartGroupController);
    service = module.get<SparePartGroupService>(SparePartGroupService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create group', async () => {
    mockSparePartGroupService.create.mockResolvedValue({ id: 1, name: 'Group A' });

    const res = await controller.create({ name: 'Group A' });
    expect(res).toEqual({ id: 1, name: 'Group A' });
    expect(service.create).toHaveBeenCalledWith({ name: 'Group A' });
  });
});
