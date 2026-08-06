import { Test, TestingModule } from '@nestjs/testing';
import { AssetStatusService } from './asset-status.service';
import { PrismaService } from '../prisma.service';

describe('AssetStatusService', () => {
  let service: AssetStatusService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetStatusService,
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<AssetStatusService>(AssetStatusService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
