import { Test, TestingModule } from '@nestjs/testing';
import { AssetTypeService } from './asset-type.service';
import { PrismaService } from '../prisma.service';

describe('AssetTypeService', () => {
  let service: AssetTypeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetTypeService,
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<AssetTypeService>(AssetTypeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
