import { Test, TestingModule } from '@nestjs/testing';
import { AssetBorrowController } from './asset-borrow.controller';
import { AssetBorrowService } from './asset-borrow.service';

describe('AssetBorrowController', () => {
  let controller: AssetBorrowController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssetBorrowController],
      providers: [AssetBorrowService],
    }).compile();

    controller = module.get<AssetBorrowController>(AssetBorrowController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
