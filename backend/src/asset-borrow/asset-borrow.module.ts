import { Module } from '@nestjs/common';
import { AssetBorrowService } from './asset-borrow.service';
import { AssetBorrowController } from './asset-borrow.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [AssetBorrowController],
  providers: [AssetBorrowService, PrismaService],
})
export class AssetBorrowModule {}
