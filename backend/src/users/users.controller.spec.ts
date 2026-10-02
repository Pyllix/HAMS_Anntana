import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ImageReadService } from '../images/image-read.service';

const mockImageReadService = {
  readEmployeePhoto: jest.fn(),
};

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {},
        },
        { provide: ImageReadService, useValue: mockImageReadService },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('requests an Employee Photo grant using the supplied user identifier', async () => {
    mockImageReadService.readEmployeePhoto.mockResolvedValue({
      hasEmployeePhoto: false,
      photoRevision: null,
      url: null,
      expiresAt: null,
    });

    await expect(controller.getPhoto('GOV-260001')).resolves.toEqual({
      hasEmployeePhoto: false,
      photoRevision: null,
      url: null,
      expiresAt: null,
    });
    expect(mockImageReadService.readEmployeePhoto).toHaveBeenCalledWith(
      'GOV-260001',
    );
  });
});
