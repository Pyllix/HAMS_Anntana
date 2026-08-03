import { Test, TestingModule } from '@nestjs/testing';
import { AssetStatusController } from './asset-status.controller';
import { AssetStatusService } from './asset-status.service';

describe('AssetStatusController', () => {
  let controller: AssetStatusController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssetStatusController],
      providers: [AssetStatusService],
    }).compile();

    controller = module.get<AssetStatusController>(AssetStatusController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
